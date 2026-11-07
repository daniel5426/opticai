from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Company, Clinic, User, Client, ExamLayout, OpticalExam, ExamLayoutInstance
from schemas import ExamWorkspaceSave
from services.exam_workspace import save_workspace, save_token


@pytest.fixture
def context():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False)()
    company = Company(name="Synthetic", owner_full_name="Owner")
    db.add(company); db.flush()
    clinic = Clinic(company_id=company.id, name="Synthetic", unique_id="save-test")
    db.add(clinic); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, role_level=2, username="save-test")
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Synthetic")
    layout = ExamLayout(clinic_id=clinic.id, name="Synthetic", layout_data='[]', is_active=True)
    db.add_all([user, client, layout]); db.commit()
    request = SimpleNamespace(headers={"X-Prysm-Exam-Write": "replace-v1", "X-Prysm-Exam-Components": "notes,final-prescription"})
    yield db, user, clinic, client, layout, request
    db.close(); engine.dispose()


def create(context, count=1, key="create"):
    db, user, clinic, client, layout, request = context
    payload = {"exam": {"client_id": client.id, "clinic_id": clinic.id, "user_id": user.id,
                        "test_name": "Initial", "exam_date": "2026-11-07"},
               "instances": [{"client_key": str(-i-1), "layout_id": layout.id,
                              "exam_data": {"notes": {"text": str(i)}}} for i in range(count)],
               "instance_order": [str(-i-1) for i in range(count)]}
    return save_workspace(db, user, ExamWorkspaceSave(**payload), request, creation_key=key), payload


def test_create_is_one_commit_and_replay_is_idempotent(context):
    db, user, *_, request = context
    commits = []
    event.listen(db, "after_commit", lambda *_: commits.append(True))
    result, payload = create(context, 4)
    assert len(commits) == 1
    assert len(result['instances']) == 4
    assert len(set(result['client_keys'].values())) == 4
    repeated = save_workspace(db, user, ExamWorkspaceSave(**payload), request, creation_key="create")
    assert repeated['exam']['id'] == result['exam']['id']
    assert db.query(OpticalExam).count() == 1
    assert db.query(ExamLayoutInstance).count() == 4
    payload['exam']['test_name'] = 'Changed'
    with pytest.raises(HTTPException) as exc:
        save_workspace(db, user, ExamWorkspaceSave(**payload), request, creation_key="create")
    assert exc.value.status_code == 409


def test_delta_save_preserves_omitted_and_unknown_components(context):
    db, user, *_, request = context
    result, _ = create(context, 2)
    first = db.get(ExamLayoutInstance, result['client_keys']['-1'])
    first.exam_data = {**first.exam_data, 'future-card': {'value': 42}}
    db.commit()
    exam = db.get(OpticalExam, result['exam']['id'])
    rows = db.query(ExamLayoutInstance).filter_by(exam_id=exam.id).all()
    token = save_token(exam, rows)
    saved = save_workspace(db, user, ExamWorkspaceSave(exam={'test_name': 'Updated'}, save_token=token,
        instances=[{'id': first.id, 'client_key': str(first.id), 'exam_data': {}}]), request, exam_id=exam.id)
    assert len(saved['instances']) == 1
    assert db.get(ExamLayoutInstance, first.id).exam_data == {'future-card': {'value': 42}}
    second = db.get(ExamLayoutInstance, result['client_keys']['-2'])
    assert second.exam_data == {'notes': {'text': '1'}}
    assert saved['save_token'] != token


def test_stale_token_cannot_overwrite_anything(context):
    db, user, *_, request = context
    result, _ = create(context)
    save_workspace(db, user, ExamWorkspaceSave(exam={'test_name': 'First'}, save_token=result['save_token']), request, exam_id=result['exam']['id'])
    with pytest.raises(HTTPException) as exc:
        save_workspace(db, user, ExamWorkspaceSave(exam={'test_name': 'Stale'}, save_token=result['save_token']), request, exam_id=result['exam']['id'])
    assert exc.value.status_code == 409
    assert db.get(OpticalExam, result['exam']['id']).test_name == 'First'


def test_failure_rolls_back_metadata_and_all_instances(context, monkeypatch):
    db, user, *_, request = context
    result, _ = create(context, 2)
    import services.exam_workspace as service
    monkeypatch.setattr(service, 'rebuild_exam_instance_index', lambda *_: (_ for _ in ()).throw(RuntimeError('index failure')))
    with pytest.raises(RuntimeError):
        save_workspace(db, user, ExamWorkspaceSave(exam={'test_name': 'Never committed'}, save_token=result['save_token'],
            instances=[{'id': result['client_keys']['-1'], 'client_key': 'first', 'exam_data': {'notes': {'text': 'New'}}}]),
            request, exam_id=result['exam']['id'])
    assert db.get(OpticalExam, result['exam']['id']).test_name == 'Initial'
    assert db.get(ExamLayoutInstance, result['client_keys']['-1']).exam_data == {'notes': {'text': '0'}}


def test_cross_exam_instance_and_read_only_rejected(context):
    db, user, *_, request = context
    first, _ = create(context)
    other, _ = create(context, key='other')
    with pytest.raises(HTTPException) as exc:
        save_workspace(db, user, ExamWorkspaceSave(exam={}, save_token=first['save_token'],
            instances=[{'id': other['client_keys']['-1'], 'client_key': 'bad', 'exam_data': {}}]), request, exam_id=first['exam']['id'])
    assert exc.value.status_code == 422
    user.role_level = 1
    with pytest.raises(HTTPException) as exc:
        save_workspace(db, user, ExamWorkspaceSave(exam={}, save_token=first['save_token']), request, exam_id=first['exam']['id'])
    assert exc.value.status_code == 403


def test_removal_ordering_and_tab_selection_token(context):
    db, user, *_, request = context
    result, _ = create(context, 3)
    ids = [result['client_keys'][str(-i-1)] for i in range(3)]
    rows = db.query(ExamLayoutInstance).all()
    rows[0].is_active = True
    db.commit()
    assert save_token(db.get(OpticalExam, result['exam']['id']), rows) == result['save_token']
    saved = save_workspace(db, user, ExamWorkspaceSave(exam={}, save_token=result['save_token'],
        removed_instance_ids=[ids[1]], instance_order=[str(ids[2]), str(ids[0])]), request, exam_id=result['exam']['id'])
    assert saved['removed_instance_ids'] == [ids[1]]
    assert db.get(ExamLayoutInstance, ids[1]) is None
    assert db.get(ExamLayoutInstance, ids[2]).order == 0
