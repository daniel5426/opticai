"""Resumable per-source index replacement, never an empty clinic-wide index."""
from models import OpticalExam, ExamLayoutInstance, Order, ContactLensOrder, Referral
from agent.models import PrescriptionIndexState
from agent.config import now
from services.prescription_matching import eligible_index
from services.prescription_search_index import (rebuild_exam_instance_index, rebuild_order_index,
    rebuild_contact_lens_order_index, rebuild_referral_index)


def backfill(db, clinic_id, batch_size=500, max_batches=None):
    state = db.get(PrescriptionIndexState, clinic_id)
    if not state:
        state = PrescriptionIndexState(clinic_id=clinic_id, checkpoint={})
        db.add(state); db.commit()
    batches = 0
    for name, model, writer in [('exam', ExamLayoutInstance, rebuild_exam_instance_index), ('order', Order, rebuild_order_index),
        ('contact_lens_order', ContactLensOrder, rebuild_contact_lens_order_index), ('referral', Referral, rebuild_referral_index)]:
        progress = state.checkpoint.get(name, {})
        if progress.get('complete'):
            continue
        cursor = progress.get('after_id', 0)
        while True:
            query = db.query(model).filter(model.id > cursor)
            if name == 'exam':
                query = query.join(OpticalExam, OpticalExam.id == model.exam_id).filter(
                    OpticalExam.clinic_id == clinic_id, OpticalExam.deleted_at.is_(None))
            else:
                query = query.filter(model.clinic_id == clinic_id, model.deleted_at.is_(None))
            rows = query.order_by(model.id).limit(batch_size).with_for_update(of=model).all()
            for row in rows:
                writer(db, row)
                cursor = row.id
            complete = len(rows) < batch_size
            state.checkpoint = {**state.checkpoint, name: {'after_id': cursor, 'complete': complete}}
            state.updated_at = now()
            db.commit()
            batches += 1
            if max_batches and batches >= max_batches:
                return {'ready': state.ready, 'checkpoint': state.checkpoint}
            if complete:
                break
    from models import PrescriptionSearchIndex
    pending = eligible_index(db, [clinic_id]).filter(PrescriptionSearchIndex.component_key.is_(None)).count()
    state.ready, state.updated_at = pending == 0, now()
    db.commit()
    return {'ready': state.ready, 'checkpoint': state.checkpoint, 'pending_rows': pending}
