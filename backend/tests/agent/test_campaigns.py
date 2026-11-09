import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from models import Campaign, Subscription
from campaign_models import MessagingCatalog, CampaignDetails
from agent import campaigns, changes


def seed(db, auth):
    db.add(MessagingCatalog(id=1,allowances={},packs=[10000],enabled=False,revision=1))
    db.add(Subscription(id='campaign-agent-sub',company_id=auth.user.company_id,plan_code='essential',provider='manual',status='legacy_active',campaigns_enabled=True))
    db.commit()


def test_campaign_draft_requires_approval_and_is_idempotent(clinic):
    db,auth,_,_=clinic;seed(db,auth)
    proposal=campaigns.prepare(db,auth,{'name':'Recall','filters':'[]','all_clients':True,'email_enabled':True,'email_content':'Hello {first_name}'})
    assert not db.query(Campaign).first()
    with pytest.raises(HTTPException) as error:changes.commit(db,auth,proposal['change_id'])
    assert error.value.status_code==403
    db.rollback()
    changes.approve(db,auth,proposal['change_id'])
    result=changes.commit(db,auth,proposal['change_id'])
    assert result['status']=='draft' and result['path'].startswith('/campaigns?campaign=')
    assert result['approval']['user_id']==auth.user.id and result['approval']['at']
    assert changes.commit(db,auth,proposal['change_id'])==result
    assert db.query(Campaign).count()==1
    assert not db.query(Campaign).one().active


def test_agent_cannot_activate_send_or_cross_clinic(clinic):
    db,auth,_,_=clinic;seed(db,auth)
    for fields in ({'name':'x','active':True},{'name':'x','clinic_id':999},{'name':'x','sms_rate':0}):
        with pytest.raises(HTTPException):campaigns.prepare(db,auth,fields)
        db.rollback()
    auth.user.role_level=2
    with pytest.raises(HTTPException):campaigns.prepare(db,auth,{'name':'x'})


def test_additive_manifest_is_an_explicit_rollout(monkeypatch):
    from agent.artifact import artifact_app
    monkeypatch.setenv('AGENTS24_ARTIFACT_SIGNING_SECRET','manifest-test-only')
    monkeypatch.setenv('PRYSM_CAMPAIGN_AGENT_ENABLED','true')
    client=TestClient(artifact_app())
    manifest=client.get('/.well-known/agents24/artifact').json()
    assert {g['key'] for g in manifest['toolsets']}=={'records','workflow','reporting','campaigns'}


@pytest.mark.asyncio
async def test_signed_campaign_tool_prepares_typed_audience_and_commits_only_after_approval(clinic, monkeypatch):
    import json
    from agent import artifact
    from test_artifact_contract import call, SECRET
    db,auth,_,sessions=clinic;seed(db,auth)
    monkeypatch.setattr(artifact,'SessionLocal',sessions)
    monkeypatch.setenv('AGENTS24_ARTIFACT_SIGNING_SECRET',SECRET)
    monkeypatch.setenv('PRYSM_CAMPAIGN_AGENT_ENABLED','true')
    fields={'name':'Annual recall','email_enabled':True,'email_content':'Hello {first_name}',
        'subject':'Book an exam','locale':'he','filters':[{'field':'last_exam_days','operator':'greater_equal','value':365}]}
    app=artifact.artifact_app()
    result=(await call(app,'prepare_campaign',{'fields':fields},{'external_session_id':auth.context_id})).json()
    assert result['status']=='completed',result
    proposal=result['result'];assert proposal['requires_approval'] is True
    assert json.loads(proposal['after']['filters'])[0]['value']==365
    assert db.query(Campaign).count()==0
    changes.approve(db,auth,proposal['change_id'])
    saved=changes.commit(db,auth,proposal['change_id'])
    assert saved['status']=='draft' and db.query(Campaign).count()==1
    assert db.query(Campaign).one().active is False
