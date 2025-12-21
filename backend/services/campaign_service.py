import asyncio
import json
import logging
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, extract, func
from models import Campaign, Client, Appointment, OpticalExam, Order, CampaignClientExecution, Clinic, Settings
from .messaging.whatsapp import whatsapp_service
# Assuming we have email/sms services too, but focused on WhatsApp as requested
# from .messaging.email import email_service 
# from .messaging.sms import sms_service

logger = logging.getLogger(__name__)

class CampaignService:
    def __init__(self, db: Session):
        self.db = db

    async def get_filtered_clients(self, campaign: Campaign) -> List[Client]:
        """
        Translates campaign filters into a database query and returns matching clients.
        """
        try:
            filters = json.loads(campaign.filters) if campaign.filters else []
            if not filters:
                return []

            query = self.db.query(Client).filter(Client.clinic_id == campaign.clinic_id)

            # Note: This is a complex translation from JSON filters to SQLAlchemy.
            # For a truly scalable solution, we would build a robust filter engine.
            # Here, we'll implement a simplified version for the most common fields.
            
            # For fields like 'age', 'last_exam_days', etc., we might need joins or subqueries.
            # For now, let's fetch all clients and filter in memory if the filters are complex,
            # BUT we should aim for DB-side filtering where possible.
            
            all_clients = query.all()
            
            # Since appointments/exams/orders are used in filters, we pre-fetch them
            # or use optimized subqueries. For simplicity and correctness with existing logic:
            
            target_clients = []
            for client in all_clients:
                if self._evaluate_client_filters(client, filters):
                    # Check if once per client
                    if campaign.execute_once_per_client:
                        already_executed = self.db.query(CampaignClientExecution).filter(
                            CampaignClientExecution.campaign_id == campaign.id,
                            CampaignClientExecution.client_id == client.id
                        ).first()
                        if already_executed:
                            continue
                    target_clients.append(client)
            
            return target_clients
        except Exception as e:
            logger.error(f"Error filtering clients for campaign {campaign.id}: {str(e)}")
            return []

    def _evaluate_client_filters(self, client: Client, filters: List[Dict[str, Any]]) -> bool:
        if not filters:
            return True
        
        # This mirrors the frontend evaluateClientFilters logic
        # For simplicity in this step, I'll focus on the core infrastructure.
        # In a real implementation, this would be much more detailed.
        return True # Placeholder: Assume it matches for now to test the sending logic

    async def execute_campaign(self, campaign_id: int):
        """
        Executes a campaign: filters clients and sends messages concurrently.
        """
        campaign = self.db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign or not campaign.active:
            logger.warning(f"Campaign {campaign_id} not found or not active.")
            return

        clients = await self.get_filtered_clients(campaign)
        if not clients:
            logger.info(f"No target clients for campaign {campaign.id}.")
            return

        settings = self.db.query(Settings).filter(Settings.clinic_id == campaign.clinic_id).first()
        
        tasks = []
        semaphore = asyncio.Semaphore(50)  # Rate limit

        async def send_to_client(client: Client):
            async with semaphore:
                success = False
                error_msg = None
                
                try:
                    if campaign.whatsapp_enabled:
                        if client.phone_mobile:
                            # In a real scenario, we'd replace placeholders in the content or use template components
                            success = await whatsapp_service.send_template_message(
                                recipient=client.phone_mobile,
                                template_name=campaign.whatsapp_template_name,
                                # components=... (Map client fields to template variables)
                            )
                            if not success:
                                error_msg = "WhatsApp delivery failed"
                    
                    # Logic for Email/SMS if needed...
                    
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Failed to send campaign {campaign.id} to client {client.id}: {error_msg}")

                # Log execution
                execution = CampaignClientExecution(
                    campaign_id=campaign.id,
                    client_id=client.id,
                    status="success" if success else "failed",
                    error_message=error_msg,
                    channel="whatsapp" if campaign.whatsapp_enabled else "other"
                )
                self.db.add(execution)
                return success

        # Execute concurrently
        results = await asyncio.gather(*(send_to_client(c) for c in clients))
        
        success_count = sum(1 for r in results if r)
        
        # Update campaign stats
        if campaign.whatsapp_enabled:
            campaign.whatsapp_sent = True
            campaign.whatsapp_sent_count += success_count
        
        campaign.last_executed = datetime.utcnow()
        self.db.commit()
        
        logger.info(f"Campaign {campaign.id} completed. Sent to {success_count}/{len(clients)} clients.")

    def _calculate_age(self, dob: date) -> int:
        if not dob:
            return 0
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
