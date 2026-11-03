import io
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from EndPoints.agent import authorized, get_db
from main import app
from agent.models import AgentJob
from services.supply_intake import prepare
from models import CatalogVariant, InventoryBalance


@pytest.fixture
def http(clinic, monkeypatch):
    db, auth, *_ = clinic
    monkeypatch.setenv('AGENTS24_SUPPLY_AGENT_ID', 'synthetic-mapper')
    app.dependency_overrides[authorized] = lambda: auth
    app.dependency_overrides[get_db] = lambda: db
    try: yield TestClient(app), db, auth
    finally: app.dependency_overrides.clear()


def test_upload_queue_and_repeated_upload_reuses_job(http):
    client, db, auth = http
    file = ('supplier.csv', b'category,brand,model,color,eye_size\nframe,Demo,A,Black,50', 'text/csv')
    first = client.post('/api/v1/agent/supply', files={'file': file}, data={'operation':'catalog'})
    second = client.post('/api/v1/agent/supply', files={'file': file}, data={'operation':'catalog'})
    assert first.status_code == second.status_code == 200
    assert first.json()['job_id'] == second.json()['job_id']
    assert db.query(AgentJob).count() == 1
    assert db.query(CatalogVariant).count() == 0


def test_apply_uses_reviewed_revision_and_ignores_injected_rows(http):
    client, db, auth = http
    proposal = prepare(db, auth, 'receipt', [{'source':{'row':2}, 'values':{'category':'frame','brand':'Demo','model':'A','color':'Black','eye_size':50,'quantity':3}}])
    path = '/api/v1/agent/supply/' + proposal['job_id']
    wrong = client.post(path + '/apply', json={'revision':'forged'})
    assert wrong.status_code == 409
    good = client.post(path + '/apply', json={'revision':proposal['revision'], 'rows':[{'quantity':999}]})
    assert good.status_code == 200
    assert db.query(InventoryBalance).one().on_hand == 3
    again = client.post(path + '/apply', json={'revision':proposal['revision']})
    assert again.status_code == 200
    assert db.query(InventoryBalance).one().on_hand == 3


def test_workbook_attachment_extract_is_read_only(http):
    client, db, _ = http
    book = Workbook(); book.active.append(['Barcode', 'Model']); book.active.append(['001', 'A'])
    data = io.BytesIO(); book.save(data)
    result = client.post('/api/v1/agent/supply/extract', files={'file':('supplier.xlsx', data.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
    assert result.status_code == 200
    assert '001' in result.json()['text']
    assert db.query(CatalogVariant).count() == 0
    assert db.query(AgentJob).count() == 0


def test_worker_prepare_requires_config_and_rejects_invalid_payload(http, monkeypatch):
    client, db, _ = http
    monkeypatch.delenv('AGENTS24_SUPPLY_AGENT_ID')
    response = client.post('/api/v1/agent/supply', data={'text':'Demo A'})
    assert response.status_code == 503
    assert db.query(AgentJob).count() == 0


def test_transcript_reads_the_processed_content_envelope():
    from EndPoints.agent import transcript_text
    value = [{'data': {'schema_version':'agents24.processed-content.v1', 'segments':[{'text':'Received three frames.'}]}, 'retention':{'inspection_days':7}}]
    assert transcript_text(value) == 'Received three frames.'


def test_chat_proposals_are_typed_and_excluded_from_legacy_recovery(http):
    client, db, auth = http
    proposal = prepare(db, auth, 'catalog', [{'source': {'row': 2}, 'values': {
        'category': 'frame', 'brand': 'Demo', 'model': 'Chat', 'color': 'Black', 'eye_size': 50}}])
    assert proposal['type'] == 'supply_proposal'
    chat = db.get(AgentJob, proposal['job_id'])
    assert chat.definition['origin'] == 'chat'
    assert client.get('/api/v1/agent/supply?legacy_only=true').json() == []
    assert client.get('/api/v1/agent/supply').json()[0]['id'] == chat.id
    chat.definition = {'title': 'Existing import'}
    db.commit()
    recovered = client.get('/api/v1/agent/supply?legacy_only=true').json()
    assert recovered[0]['id'] == chat.id and recovered[0]['origin'] is None
