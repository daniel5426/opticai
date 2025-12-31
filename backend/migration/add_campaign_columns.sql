-- Migration to add missing columns to campaigns and campaign_client_executions tables

-- Add missing columns to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_template_name VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_content TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_sent_count INTEGER DEFAULT 0;

-- Add missing columns to campaign_client_executions table
ALTER TABLE campaign_client_executions ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'success';
ALTER TABLE campaign_client_executions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE campaign_client_executions ADD COLUMN IF NOT EXISTS channel VARCHAR;
