"""Authorized measurement instances with template snapshots and search indexing."""
from fastapi import HTTPException
from hashlib import sha256
from models import ExamLayout, ExamLayoutInstance, OpticalExam, Client
from security.scope import get_scoped_client, assert_clinic_scope
from services.prism_axis_compatibility import normalize_prism_axis_exam_data
from services.prescription_search_index import rebuild_exam_instance_index
from services.ai_privacy import clean_nested
from agent.config import now


def template(db, clinic_id, layout_id):
    row = db.query(ExamLayout).filter(ExamLayout.id == layout_id, ExamLayout.clinic_id == clinic_id,
        ExamLayout.is_active.is_(True), ExamLayout.is_group.is_(False)).first()
    if not row:
        raise HTTPException(404, 'agent.recordNotFound')
    return row


def save(db, user, clinic_id, exam_id, fields, expected, action):
    assert_clinic_scope(db, user, clinic_id)
    if (user.role_level or 1) < 2:
        raise HTTPException(403, 'agent.editPermissionRequired')
    exam = db.query(OpticalExam).filter_by(id=exam_id, clinic_id=clinic_id).filter(OpticalExam.deleted_at.is_(None)).with_for_update().first()
    if not exam or get_scoped_client(db, user, exam.client_id).clinic_id != clinic_id:
        raise HTTPException(404, 'agent.recordNotFound')
    if action == 'create':
        layout = template(db, clinic_id, fields['layout_id'])
        if sha256(layout.layout_data.encode()).hexdigest() != expected['layout_digest']:
            raise HTTPException(409, 'agent.staleChange')
        active = not db.query(ExamLayoutInstance.id).filter_by(exam_id=exam.id, is_active=True).first()
        row = ExamLayoutInstance(exam_id=exam.id, layout_id=layout.id, layout_data=layout.layout_data,
            is_active=active, exam_data=normalize_prism_axis_exam_data(fields['exam_data']))
        db.add(row); db.flush()
    else:
        row = db.query(ExamLayoutInstance).filter_by(id=fields['layout_instance_id'], exam_id=exam.id).with_for_update().first()
        if not row or clean_nested(row.exam_data) != expected['data']:
            raise HTTPException(409, 'agent.staleChange')
        row.exam_data = normalize_prism_axis_exam_data({**(row.exam_data or {}), **fields['exam_data']})
    row.updated_at = now()
    rebuild_exam_instance_index(db, row)
    client = db.get(Client, exam.client_id)
    client.ai_exam_state, client.client_updated_date = None, now()
    return {'exam_id': exam.id, 'layout_instance_id': row.id, 'source': {'kind': 'exams', 'id': exam.id,
        'path': f'/clients/{exam.client_id}/exams/{exam.id}'}}
