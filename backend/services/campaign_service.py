"""Retained import boundary for older integrations; delivery belongs to the durable engine."""
from fastapi import HTTPException

class CampaignService:
    def __init__(self, db, actor_user_id=None):
        self.db, self.actor_user_id = db, actor_user_id

    async def execute_campaign(self, campaign_id):
        raise HTTPException(409, detail={'code': 'campaign_upgrade_required'})
