from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
import models
import config
import httpx
import logging

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)

@router.post("/connect")
async def connect_whatsapp(
    company_id: int,
    access_token: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Automated onboarding for WhatsApp Embedded Signup.
    Exchanges a short-lived user token for a long-lived one, 
    detects the WABA and Phone Number ID, and saves them.
    """
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    async with httpx.AsyncClient() as client:
        # 1. Exchange short-lived token for long-lived session access token
        # Note: For Embedded Signup, the token received is often a User Access Token.
        # We want to exchange it for a long-lived one if possible, 
        # but Meta's Cloud API often uses System User tokens for BSPs.
        # However, for simple Embedded Signup, the User Token (long-lived) works too.
        
        token_exchange_url = "https://graph.facebook.com/v18.0/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": config.settings.FB_APP_ID,
            "client_secret": config.settings.FB_APP_SECRET,
            "fb_exchange_token": access_token
        }
        
        resp = await client.get(token_exchange_url, params=params)
        if resp.status_code != 200:
            logger.error(f"Token exchange failed: {resp.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange Meta access token")
        
        long_lived_token = resp.json().get("access_token")

        # 2. Fetch the linked WhatsApp Business Accounts (WABA)
        # We look for the WABA that was just linked.
        waba_url = "https://graph.facebook.com/v18.0/me/whatsapp_business_accounts"
        waba_resp = await client.get(waba_url, headers={"Authorization": f"Bearer {long_lived_token}"})
        
        if waba_resp.status_code != 200:
            logger.error(f"Failed to fetch WABAs: {waba_resp.text}")
            raise HTTPException(status_code=400, detail="Failed to fetch WhatsApp Business Accounts")
        
        wabas = waba_resp.json().get("data", [])
        if not wabas:
            raise HTTPException(status_code=400, detail="No WhatsApp Business Accounts found for this user")
        
        # For simplicity, we take the first one or the one most recently updated
        primary_waba = wabas[0]
        waba_id = primary_waba.get("id")

        # 3. Fetch Phone Numbers for this WABA
        phone_url = f"https://graph.facebook.com/v18.0/{waba_id}/phone_numbers"
        phone_resp = await client.get(phone_url, headers={"Authorization": f"Bearer {long_lived_token}"})
        
        if phone_resp.status_code != 200:
            logger.error(f"Failed to fetch phone numbers: {phone_resp.text}")
            raise HTTPException(status_code=400, detail="Failed to fetch WhatsApp phone numbers")
        
        phones = phone_resp.json().get("data", [])
        if not phones:
            raise HTTPException(status_code=400, detail="No phone numbers found in the WhatsApp Business Account")
        
        # Take the first verified phone number
        primary_phone = phones[0]
        phone_id = primary_phone.get("id")

        # 4. Subscribe the App to the WABA webhooks
        # This ensures we receive messages for this specific WABA
        subscribe_url = f"https://graph.facebook.com/v18.0/{waba_id}/subscribed_apps"
        sub_resp = await client.post(subscribe_url, headers={"Authorization": f"Bearer {long_lived_token}"})
        
        if sub_resp.status_code != 200:
            logger.warning(f"Failed to subscribe app to WABA: {sub_resp.text}")
            # We don't fail the whole process if subscription fails, 
            # as it might already be subscribed or require manual check

        # 5. Save credentials to Company
        company.whatsapp_access_token = long_lived_token
        company.whatsapp_business_account_id = waba_id
        company.whatsapp_phone_number_id = phone_id
        # Use default verify token from config if not already set
        if not company.whatsapp_verify_token:
            company.whatsapp_verify_token = config.settings.WHATSAPP_VERIFY_TOKEN
            
        db.commit()
        
        return {
            "status": "success",
            "waba_id": waba_id,
            "phone_number_id": phone_id,
            "message": "WhatsApp connected successfully"
        }
