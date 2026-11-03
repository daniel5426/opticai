"""Report-owned durable callback retries never rerun report generation."""
from types import SimpleNamespace
from uuid import uuid4
from datetime import timedelta
from unittest.mock import Mock
import pytest
from agents24.errors import Agents24SDKError
from agents24.server import ArtifactInvocationError
from agent.models import AgentJob
from agent.config import now
from agent.report_completion import wait_for_report, deliver_one, queued_report


def job(db, auth):
    row = AgentJob(id=str(uuid4()), unique_key=str(uuid4()), company_id=auth.user.company_id,
        clinic_id=auth.clinic_id, user_id=auth.user.id, context_id=auth.context_id,
        kind='report', status='queued', definition={'version':1}, result=None)
    db.add(row); db.commit()
    return row


def context():
    return {'completion_reference':{key:str(uuid4()) for key in ('invocation_id','completion_ref','artifact_id')}}


def test_pending_report_is_explicit_and_completion_retries_exact_saved_result(clinic):
    db, auth, _, sessions = clinic
    row = job(db, auth); ctx = context()
    pending = wait_for_report(db, auth, row, ctx)
    assert pending == {'schema_version':'agents24.tool-pending.v1','external_job_ref':row.id}
    assert wait_for_report(db, auth, row, ctx) == pending
    assert len(row.platform_callbacks) == 1
    sdk = SimpleNamespace(embed=SimpleNamespace(complete_tool_invocation=Mock()))
    assert not deliver_one(sessions, sdk=sdk)  # Work has not completed.
    row.status='completed'; row.result={'rows':5}; db.commit()
    sdk.embed.complete_tool_invocation.side_effect = Agents24SDKError('temporary',kind='http',status=503)
    assert deliver_one(sessions, sdk=sdk)
    db.expire_all(); db.refresh(row)
    assert row.status=='completed' and row.completion_retry_at is not None
    callback = next(iter(row.platform_callbacks.values()))
    assert callback['attempts']==1 and not callback['delivered']
    row.completion_retry_at=now()-timedelta(seconds=1);row.result={'rows':999};db.commit()
    sdk.embed.complete_tool_invocation.side_effect = None
    assert deliver_one(sessions, sdk=sdk)
    args = sdk.embed.complete_tool_invocation.call_args_list
    assert args[0] == args[1]  # Ambiguous HTTP delivery resends the immutable receipt.
    assert args[1].args[1]['result']['rows']==5
    db.expire_all();db.refresh(row)
    assert row.completion_retry_at is None
    assert next(iter(row.platform_callbacks.values()))['delivered']
    assert not deliver_one(sessions, sdk=sdk)
    assert db.query(AgentJob).count()==1


def test_completion_respects_clinic_routing_and_permanent_rejection(clinic):
    db, auth, _, sessions = clinic
    row=job(db,auth);wait_for_report(db,auth,row,context())
    row.status='failed';row.result={'code':'report_failed'};db.commit()
    sdk=SimpleNamespace(embed=SimpleNamespace(complete_tool_invocation=Mock(side_effect=Agents24SDKError('denied',kind='http',status=403))))
    assert not deliver_one(sessions,clinic_ids=[auth.clinic_id+100],sdk=sdk)
    assert deliver_one(sessions,clinic_ids=[auth.clinic_id],sdk=sdk)
    db.expire_all();db.refresh(row)
    assert next(iter(row.platform_callbacks.values()))['blocked']
    assert row.status=='failed' and row.completion_retry_at is None


def test_missing_completion_contract_is_rejected_before_enqueue(clinic):
    db,auth,_,_=clinic;enqueue=Mock()
    with pytest.raises(ArtifactInvocationError): queued_report(db,auth,{},enqueue)
    enqueue.assert_not_called()
