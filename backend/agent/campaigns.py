"""The general agent can prepare and approve inactive campaign drafts only."""
from datetime import timedelta
from fastapi import HTTPException
from models import Campaign
from agent.models import PreparedChange
from agent.authority import owned_change, writable
from agent.config import now
from services import campaign_engine as engine, messaging_billing as money
from EndPoints.campaigns import CampaignWrite, save_draft


def scoped(db, auth, campaign_id):
    c = db.query(Campaign).filter_by(id=campaign_id, clinic_id=auth.clinic_id).first()
    if not c: raise HTTPException(404, 'agent.recordNotFound')
    return c


def prepare(db, auth, fields, campaign_id=None):
    writable(auth)
    engine.manager(auth.user)
    from security.entitlements import campaign_delivery
    campaign_delivery(db, auth.clinic_id, auth.user.id)
    if set(fields) - set(CampaignWrite.model_fields) or fields.get('clinic_id', auth.clinic_id) != auth.clinic_id:
        raise HTTPException(422, 'agent.invalidFields')
    before, expected = {}, {}
    if campaign_id:
        c = scoped(db, auth, campaign_id)
        before = engine.serialize(db, c)
        expected = {'revision': before['revision']}
        fields = {**{k:v for k,v in before.items() if k in CampaignWrite.model_fields}, **fields}
        if before['status'] in ('scheduled', 'completed', 'blocked'):
            campaign_id = None  # Active campaigns are never edited by agent tools.
    values = CampaignWrite.model_validate({**fields, 'clinic_id': auth.clinic_id})
    engine.filters.validate_filters(values.filters)
    proposal = PreparedChange(kind='campaigns', action='update' if campaign_id else 'create', context_id=auth.context_id,
        payload={'fields': values.model_dump(mode='json'), 'record_id': campaign_id},
        expected=expected, expires_at=now()+timedelta(hours=24))
    db.add(proposal)
    db.commit()
    return {'change_id': proposal.id, 'kind': 'campaigns', 'action': proposal.action, 'before': before,
        'after': proposal.payload['fields'], 'requires_approval': True}


def commit(db, auth, proposal):
    engine.manager(auth.user)
    money.account(db, auth.user.company_id)
    campaign = scoped(db, auth, proposal.payload['record_id']) if proposal.payload['record_id'] else None
    values = CampaignWrite.model_validate(proposal.payload['fields'])
    if campaign and engine.details(db, campaign).revision != proposal.expected['revision']:
        raise HTTPException(409, 'agent.staleChange')
    result = save_draft(db, auth.user, values, campaign, commit=False)
    proposal.status = 'committed'
    proposal.result = {'kind': 'campaigns', 'id': result['id'], 'path': f"/campaigns?campaign={result['id']}", 'status': 'draft', 'approval': proposal.result['approval']}
    db.commit()
    return proposal.result
