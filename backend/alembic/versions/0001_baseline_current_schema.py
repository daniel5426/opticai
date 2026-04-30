"""baseline current SQLAlchemy schema

Revision ID: 0001_baseline_current_schema
Revises:
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_baseline_current_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('companies',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('owner_full_name', sa.String(), nullable=False),
    sa.Column('contact_email', sa.String(), nullable=True),
    sa.Column('contact_phone', sa.String(), nullable=True),
    sa.Column('logo_path', sa.String(), nullable=True),
    sa.Column('address', sa.String(), nullable=True),
    sa.Column('primary_theme_color', sa.String(), nullable=True),
    sa.Column('secondary_theme_color', sa.String(), nullable=True),
    sa.Column('whatsapp_access_token', sa.String(), nullable=True),
    sa.Column('whatsapp_phone_number_id', sa.String(), nullable=True),
    sa.Column('whatsapp_business_account_id', sa.String(), nullable=True),
    sa.Column('whatsapp_verify_token', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'], unique=False)
    op.create_table('lookup_advisor',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_advisor_id'), 'lookup_advisor', ['id'], unique=False)
    op.create_table('lookup_cleaning_solution',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_cleaning_solution_id'), 'lookup_cleaning_solution', ['id'], unique=False)
    op.create_table('lookup_clinic',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_clinic_id'), 'lookup_clinic', ['id'], unique=False)
    op.create_table('lookup_coating',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_coating_id'), 'lookup_coating', ['id'], unique=False)
    op.create_table('lookup_color',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_color_id'), 'lookup_color', ['id'], unique=False)
    op.create_table('lookup_contact_eye_lens_type',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_contact_eye_lens_type_id'), 'lookup_contact_eye_lens_type', ['id'], unique=False)
    op.create_table('lookup_contact_eye_material',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_contact_eye_material_id'), 'lookup_contact_eye_material', ['id'], unique=False)
    op.create_table('lookup_contact_lens_model',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_contact_lens_model_id'), 'lookup_contact_lens_model', ['id'], unique=False)
    op.create_table('lookup_contact_lens_type',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_contact_lens_type_id'), 'lookup_contact_lens_type', ['id'], unique=False)
    op.create_table('lookup_disinfection_solution',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_disinfection_solution_id'), 'lookup_disinfection_solution', ['id'], unique=False)
    op.create_table('lookup_frame_model',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_frame_model_id'), 'lookup_frame_model', ['id'], unique=False)
    op.create_table('lookup_lens_model',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_lens_model_id'), 'lookup_lens_model', ['id'], unique=False)
    op.create_table('lookup_manufacturer',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_manufacturer_id'), 'lookup_manufacturer', ['id'], unique=False)
    op.create_table('lookup_manufacturing_lab',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_manufacturing_lab_id'), 'lookup_manufacturing_lab', ['id'], unique=False)
    op.create_table('lookup_material',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_material_id'), 'lookup_material', ['id'], unique=False)
    op.create_table('lookup_order_type',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_order_type_id'), 'lookup_order_type', ['id'], unique=False)
    op.create_table('lookup_referral_type',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_referral_type_id'), 'lookup_referral_type', ['id'], unique=False)
    op.create_table('lookup_rinsing_solution',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_rinsing_solution_id'), 'lookup_rinsing_solution', ['id'], unique=False)
    op.create_table('lookup_supplier',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_supplier_id'), 'lookup_supplier', ['id'], unique=False)
    op.create_table('lookup_va_decimal',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_va_decimal_id'), 'lookup_va_decimal', ['id'], unique=False)
    op.create_table('lookup_va_meter',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_lookup_va_meter_id'), 'lookup_va_meter', ['id'], unique=False)
    op.create_table('clinics',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('location', sa.String(), nullable=True),
    sa.Column('phone_number', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('clinic_name', sa.String(), nullable=True),
    sa.Column('clinic_position', sa.String(), nullable=True),
    sa.Column('clinic_address', sa.String(), nullable=True),
    sa.Column('clinic_city', sa.String(), nullable=True),
    sa.Column('clinic_postal_code', sa.String(), nullable=True),
    sa.Column('clinic_directions', sa.String(), nullable=True),
    sa.Column('clinic_website', sa.String(), nullable=True),
    sa.Column('manager_name', sa.String(), nullable=True),
    sa.Column('license_number', sa.String(), nullable=True),
    sa.Column('unique_id', sa.String(), nullable=False),
    sa.Column('entry_pin_hash', sa.String(), nullable=True),
    sa.Column('entry_pin_version', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('unique_id')
    )
    op.create_index(op.f('ix_clinics_id'), 'clinics', ['id'], unique=False)
    op.create_table('campaigns',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('filters', sa.Text(), nullable=True),
    sa.Column('email_enabled', sa.Boolean(), nullable=True),
    sa.Column('email_content', sa.Text(), nullable=True),
    sa.Column('sms_enabled', sa.Boolean(), nullable=True),
    sa.Column('sms_content', sa.Text(), nullable=True),
    sa.Column('whatsapp_enabled', sa.Boolean(), nullable=True),
    sa.Column('whatsapp_template_name', sa.String(), nullable=True),
    sa.Column('whatsapp_content', sa.Text(), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=True),
    sa.Column('active_since', sa.DateTime(timezone=True), nullable=True),
    sa.Column('mail_sent', sa.Boolean(), nullable=True),
    sa.Column('sms_sent', sa.Boolean(), nullable=True),
    sa.Column('whatsapp_sent', sa.Boolean(), nullable=True),
    sa.Column('emails_sent_count', sa.Integer(), nullable=True),
    sa.Column('sms_sent_count', sa.Integer(), nullable=True),
    sa.Column('whatsapp_sent_count', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('cycle_type', sa.String(), nullable=True),
    sa.Column('cycle_custom_days', sa.Integer(), nullable=True),
    sa.Column('last_executed', sa.DateTime(timezone=True), nullable=True),
    sa.Column('execute_once_per_client', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_campaigns_id'), 'campaigns', ['id'], unique=False)
    op.create_table('chats',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chats_id'), 'chats', ['id'], unique=False)
    op.create_table('exam_layouts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('layout_data', sa.Text(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('sort_index', sa.Integer(), nullable=False),
    sa.Column('parent_layout_id', sa.Integer(), nullable=True),
    sa.Column('is_group', sa.Boolean(), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['parent_layout_id'], ['exam_layouts.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exam_layouts_id'), 'exam_layouts', ['id'], unique=False)
    op.create_table('families',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=True),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_families_clinic_created', 'families', ['clinic_id', sa.text('created_date DESC')], unique=False)
    op.create_index('ix_families_clinic_id', 'families', ['clinic_id'], unique=False)
    op.create_index('ix_families_clinic_name', 'families', ['clinic_id', 'name'], unique=False)
    op.create_index('ix_families_company_clinic_id', 'families', ['company_id', 'clinic_id', 'id'], unique=False)
    op.create_index('ix_families_company_clinic_name', 'families', ['company_id', 'clinic_id', 'name'], unique=False)
    op.create_index(op.f('ix_families_id'), 'families', ['id'], unique=False)
    op.create_table('migration_source_links',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('source_system', sa.String(), nullable=False),
    sa.Column('source_table', sa.String(), nullable=False),
    sa.Column('raw_row_ref', sa.String(), nullable=False),
    sa.Column('source_primary_key_parts', sa.JSON(), nullable=False),
    sa.Column('source_per_id', sa.Integer(), nullable=True),
    sa.Column('source_user_id', sa.Integer(), nullable=True),
    sa.Column('target_model', sa.String(), nullable=False),
    sa.Column('target_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source_system', 'target_model', 'clinic_id', 'raw_row_ref', name='uq_migration_source_links_source_target')
    )
    op.create_index(op.f('ix_migration_source_links_id'), 'migration_source_links', ['id'], unique=False)
    op.create_index('ix_migration_source_links_source', 'migration_source_links', ['source_system', 'source_table', 'clinic_id'], unique=False)
    op.create_index('ix_migration_source_links_target', 'migration_source_links', ['target_model', 'target_id'], unique=False)
    op.create_table('settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('clinic_name', sa.String(), nullable=True),
    sa.Column('clinic_position', sa.String(), nullable=True),
    sa.Column('clinic_email', sa.String(), nullable=True),
    sa.Column('clinic_phone', sa.String(), nullable=True),
    sa.Column('clinic_address', sa.String(), nullable=True),
    sa.Column('clinic_city', sa.String(), nullable=True),
    sa.Column('clinic_postal_code', sa.String(), nullable=True),
    sa.Column('clinic_directions', sa.String(), nullable=True),
    sa.Column('clinic_website', sa.String(), nullable=True),
    sa.Column('manager_name', sa.String(), nullable=True),
    sa.Column('license_number', sa.String(), nullable=True),
    sa.Column('clinic_logo_path', sa.String(), nullable=True),
    sa.Column('primary_theme_color', sa.String(), nullable=True),
    sa.Column('secondary_theme_color', sa.String(), nullable=True),
    sa.Column('work_start_time', sa.String(), nullable=True),
    sa.Column('work_end_time', sa.String(), nullable=True),
    sa.Column('appointment_duration', sa.Integer(), nullable=True),
    sa.Column('send_email_before_appointment', sa.Boolean(), nullable=True),
    sa.Column('email_days_before', sa.Integer(), nullable=True),
    sa.Column('email_time', sa.String(), nullable=True),
    sa.Column('working_days', sa.String(), nullable=True),
    sa.Column('break_start_time', sa.String(), nullable=True),
    sa.Column('break_end_time', sa.String(), nullable=True),
    sa.Column('max_appointments_per_day', sa.Integer(), nullable=True),
    sa.Column('email_provider', sa.String(), nullable=True),
    sa.Column('email_smtp_host', sa.String(), nullable=True),
    sa.Column('email_smtp_port', sa.Integer(), nullable=True),
    sa.Column('email_smtp_secure', sa.Boolean(), nullable=True),
    sa.Column('email_username', sa.String(), nullable=True),
    sa.Column('email_password', sa.String(), nullable=True),
    sa.Column('email_from_name', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_settings_clinic_id', 'settings', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_settings_id'), 'settings', ['id'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('full_name', sa.String(), nullable=True),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('password', sa.String(), nullable=True),
    sa.Column('role_level', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('profile_picture', sa.String(), nullable=True),
    sa.Column('primary_theme_color', sa.String(), nullable=True),
    sa.Column('secondary_theme_color', sa.String(), nullable=True),
    sa.Column('theme_preference', sa.String(), nullable=True),
    sa.Column('google_account_connected', sa.Boolean(), nullable=True),
    sa.Column('google_account_email', sa.String(), nullable=True),
    sa.Column('google_access_token', sa.String(), nullable=True),
    sa.Column('google_refresh_token', sa.String(), nullable=True),
    sa.Column('google_calendar_sync_enabled', sa.Boolean(), nullable=True),
    sa.Column('va_format', sa.String(), nullable=True),
    sa.Column('cyl_format', sa.String(), nullable=True),
    sa.Column('system_vacation_dates', sa.JSON(), nullable=True),
    sa.Column('added_vacation_dates', sa.JSON(), nullable=True),
    sa.Column('sync_subjective_to_final_subjective', sa.Boolean(), nullable=True),
    sa.Column('import_order_to_old_refraction_default', sa.Boolean(), nullable=True),
    sa.Column('auth_provider', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('username')
    )
    op.create_index('ix_users_clinic_id', 'users', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index('ix_users_is_active', 'users', ['is_active'], unique=False)
    op.create_table('chat_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('chat_id', sa.Integer(), nullable=False),
    sa.Column('type', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('data', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_messages_id'), 'chat_messages', ['id'], unique=False)
    op.create_table('clients',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('first_name', sa.String(), nullable=True),
    sa.Column('last_name', sa.String(), nullable=True),
    sa.Column('gender', sa.String(), nullable=True),
    sa.Column('national_id', sa.String(), nullable=True),
    sa.Column('date_of_birth', sa.Date(), nullable=True),
    sa.Column('health_fund', sa.String(), nullable=True),
    sa.Column('address_city', sa.String(), nullable=True),
    sa.Column('address_street', sa.String(), nullable=True),
    sa.Column('address_number', sa.String(), nullable=True),
    sa.Column('postal_code', sa.String(), nullable=True),
    sa.Column('phone_home', sa.String(), nullable=True),
    sa.Column('phone_work', sa.String(), nullable=True),
    sa.Column('phone_mobile', sa.String(), nullable=True),
    sa.Column('fax', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('service_center', sa.String(), nullable=True),
    sa.Column('file_creation_date', sa.Date(), nullable=True),
    sa.Column('membership_end', sa.Date(), nullable=True),
    sa.Column('service_end', sa.Date(), nullable=True),
    sa.Column('price_list', sa.String(), nullable=True),
    sa.Column('discount_percent', sa.Integer(), nullable=True),
    sa.Column('blocked_checks', sa.Boolean(), nullable=True),
    sa.Column('blocked_credit', sa.Boolean(), nullable=True),
    sa.Column('sorting_group', sa.String(), nullable=True),
    sa.Column('referring_party', sa.String(), nullable=True),
    sa.Column('file_location', sa.String(), nullable=True),
    sa.Column('occupation', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('hidden_note', sa.Text(), nullable=True),
    sa.Column('profile_picture', sa.String(), nullable=True),
    sa.Column('family_id', sa.Integer(), nullable=True),
    sa.Column('family_role', sa.String(), nullable=True),
    sa.Column('ai_updated_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('client_updated_date', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('ai_exam_state', sa.String(), nullable=True),
    sa.Column('ai_order_state', sa.String(), nullable=True),
    sa.Column('ai_referral_state', sa.String(), nullable=True),
    sa.Column('ai_contact_lens_state', sa.String(), nullable=True),
    sa.Column('ai_appointment_state', sa.String(), nullable=True),
    sa.Column('ai_file_state', sa.String(), nullable=True),
    sa.Column('ai_medical_state', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.ForeignKeyConstraint(['family_id'], ['families.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_clients_clinic_id', 'clients', ['clinic_id'], unique=False)
    op.create_index('ix_clients_clinic_id_id_desc', 'clients', ['clinic_id', sa.text('id DESC')], unique=False)
    op.create_index('ix_clients_family_id', 'clients', ['family_id'], unique=False)
    op.create_index('ix_clients_family_id_id', 'clients', ['family_id', 'id'], unique=False)
    op.create_index(op.f('ix_clients_id'), 'clients', ['id'], unique=False)
    op.create_table('work_shifts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('start_time', sa.String(), nullable=False),
    sa.Column('end_time', sa.String(), nullable=True),
    sa.Column('duration_minutes', sa.Integer(), nullable=True),
    sa.Column('date', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_work_shifts_id'), 'work_shifts', ['id'], unique=False)
    op.create_table('appointments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('date', sa.Date(), nullable=True),
    sa.Column('time', sa.String(), nullable=True),
    sa.Column('duration', sa.Integer(), nullable=True),
    sa.Column('exam_name', sa.String(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('google_calendar_event_id', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_appointments_client_id', 'appointments', ['client_id'], unique=False)
    op.create_index('ix_appointments_clinic_date', 'appointments', ['clinic_id', sa.text('date DESC')], unique=False)
    op.create_index('ix_appointments_clinic_date_time', 'appointments', ['clinic_id', 'date', 'time'], unique=False)
    op.create_index('ix_appointments_clinic_id', 'appointments', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_appointments_id'), 'appointments', ['id'], unique=False)
    op.create_index('ix_appointments_user_id', 'appointments', ['user_id'], unique=False)
    op.create_table('campaign_client_executions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('campaign_id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('executed_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('channel', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_campaign_client_executions_id'), 'campaign_client_executions', ['id'], unique=False)
    op.create_table('contact_lens_orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('order_date', sa.Date(), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.Column('l_lens_type', sa.String(), nullable=True),
    sa.Column('l_model', sa.String(), nullable=True),
    sa.Column('l_supplier', sa.String(), nullable=True),
    sa.Column('l_material', sa.String(), nullable=True),
    sa.Column('l_color', sa.String(), nullable=True),
    sa.Column('l_quantity', sa.Integer(), nullable=True),
    sa.Column('l_order_quantity', sa.Integer(), nullable=True),
    sa.Column('l_dx', sa.Boolean(), nullable=True),
    sa.Column('r_lens_type', sa.String(), nullable=True),
    sa.Column('r_model', sa.String(), nullable=True),
    sa.Column('r_supplier', sa.String(), nullable=True),
    sa.Column('r_material', sa.String(), nullable=True),
    sa.Column('r_color', sa.String(), nullable=True),
    sa.Column('r_quantity', sa.Integer(), nullable=True),
    sa.Column('r_order_quantity', sa.Integer(), nullable=True),
    sa.Column('r_dx', sa.Boolean(), nullable=True),
    sa.Column('supply_in_clinic_id', sa.Integer(), nullable=True),
    sa.Column('order_status', sa.String(), nullable=True),
    sa.Column('advisor', sa.String(), nullable=True),
    sa.Column('deliverer', sa.String(), nullable=True),
    sa.Column('delivery_date', sa.Date(), nullable=True),
    sa.Column('priority', sa.String(), nullable=True),
    sa.Column('guaranteed_date', sa.Date(), nullable=True),
    sa.Column('approval_date', sa.Date(), nullable=True),
    sa.Column('cleaning_solution', sa.String(), nullable=True),
    sa.Column('disinfection_solution', sa.String(), nullable=True),
    sa.Column('rinsing_solution', sa.String(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('supplier_notes', sa.Text(), nullable=True),
    sa.Column('order_data', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['supply_in_clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_contact_lens_orders_client_id', 'contact_lens_orders', ['client_id'], unique=False)
    op.create_index('ix_contact_lens_orders_clinic_date', 'contact_lens_orders', ['clinic_id', sa.text('order_date DESC')], unique=False)
    op.create_index('ix_contact_lens_orders_clinic_id', 'contact_lens_orders', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_contact_lens_orders_id'), 'contact_lens_orders', ['id'], unique=False)
    op.create_index('ix_contact_lens_orders_user_id', 'contact_lens_orders', ['user_id'], unique=False)
    op.create_table('files',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('file_name', sa.String(), nullable=False),
    sa.Column('file_path', sa.String(), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=True),
    sa.Column('file_type', sa.String(), nullable=True),
    sa.Column('upload_date', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('uploaded_by', sa.Integer(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_files_client_id', 'files', ['client_id'], unique=False)
    op.create_index('ix_files_clinic_id', 'files', ['clinic_id'], unique=False)
    op.create_index('ix_files_clinic_upload_date', 'files', ['clinic_id', sa.text('upload_date DESC')], unique=False)
    op.create_index(op.f('ix_files_id'), 'files', ['id'], unique=False)
    op.create_table('medical_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('log_date', sa.Date(), nullable=True),
    sa.Column('log', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_medical_logs_id'), 'medical_logs', ['id'], unique=False)
    op.create_table('optical_exams',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('clinic', sa.String(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('exam_date', sa.Date(), nullable=True),
    sa.Column('test_name', sa.String(), nullable=True),
    sa.Column('dominant_eye', sa.String(), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_optical_exams_clinic_id', 'optical_exams', ['clinic_id'], unique=False)
    op.create_index('ix_optical_exams_clinic_type_date', 'optical_exams', ['clinic_id', 'type', 'exam_date'], unique=False)
    op.create_index(op.f('ix_optical_exams_id'), 'optical_exams', ['id'], unique=False)
    op.create_index('ix_optical_exams_type', 'optical_exams', ['type'], unique=False)
    op.create_table('orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('order_date', sa.Date(), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.Column('dominant_eye', sa.String(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('lens_id', sa.Integer(), nullable=True),
    sa.Column('frame_id', sa.Integer(), nullable=True),
    sa.Column('order_data', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_orders_client_id', 'orders', ['client_id'], unique=False)
    op.create_index('ix_orders_clinic_date', 'orders', ['clinic_id', sa.text('order_date DESC')], unique=False)
    op.create_index('ix_orders_clinic_id', 'orders', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)
    op.create_index('ix_orders_user_id', 'orders', ['user_id'], unique=False)
    op.create_table('referrals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('referral_notes', sa.Text(), nullable=False),
    sa.Column('prescription_notes', sa.Text(), nullable=True),
    sa.Column('date', sa.Date(), nullable=True),
    sa.Column('type', sa.String(), nullable=True),
    sa.Column('urgency_level', sa.String(), nullable=True),
    sa.Column('recipient', sa.String(), nullable=True),
    sa.Column('referral_data', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_referrals_client_id', 'referrals', ['client_id'], unique=False)
    op.create_index('ix_referrals_clinic_date', 'referrals', ['clinic_id', sa.text('date DESC')], unique=False)
    op.create_index('ix_referrals_clinic_id', 'referrals', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_referrals_id'), 'referrals', ['id'], unique=False)
    op.create_index('ix_referrals_user_id', 'referrals', ['user_id'], unique=False)
    op.create_table('billings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('contact_lens_id', sa.Integer(), nullable=True),
    sa.Column('total_before_discount', sa.Float(), nullable=True),
    sa.Column('discount_amount', sa.Float(), nullable=True),
    sa.Column('discount_percent', sa.Float(), nullable=True),
    sa.Column('total_after_discount', sa.Float(), nullable=True),
    sa.Column('prepayment_amount', sa.Float(), nullable=True),
    sa.Column('installment_count', sa.Integer(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['contact_lens_id'], ['contact_lens_orders.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_billings_id'), 'billings', ['id'], unique=False)
    op.create_table('email_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('appointment_id', sa.Integer(), nullable=False),
    sa.Column('email_address', sa.String(), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_logs_id'), 'email_logs', ['id'], unique=False)
    op.create_table('exam_layout_instances',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('exam_id', sa.Integer(), nullable=False),
    sa.Column('layout_id', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('order', sa.Integer(), nullable=True),
    sa.Column('exam_data', sa.JSON(), nullable=False),
    sa.Column('layout_data', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['exam_id'], ['optical_exams.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['layout_id'], ['exam_layouts.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_exam_layout_instances_exam_id', 'exam_layout_instances', ['exam_id'], unique=False)
    op.create_index('ix_exam_layout_instances_exam_id_is_active', 'exam_layout_instances', ['exam_id', 'is_active'], unique=False)
    op.create_index('ix_exam_layout_instances_exam_id_order', 'exam_layout_instances', ['exam_id', 'order'], unique=False)
    op.create_index(op.f('ix_exam_layout_instances_id'), 'exam_layout_instances', ['id'], unique=False)
    op.create_table('referral_eye',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('referral_id', sa.Integer(), nullable=False),
    sa.Column('eye', sa.String(), nullable=True),
    sa.Column('sph', sa.Float(), nullable=True),
    sa.Column('cyl', sa.Float(), nullable=True),
    sa.Column('ax', sa.Integer(), nullable=True),
    sa.Column('pris', sa.Float(), nullable=True),
    sa.Column('base', sa.Float(), nullable=True),
    sa.Column('va', sa.Float(), nullable=True),
    sa.Column('add_power', sa.Float(), nullable=True),
    sa.Column('decent', sa.Float(), nullable=True),
    sa.Column('s_base', sa.Float(), nullable=True),
    sa.Column('high', sa.Float(), nullable=True),
    sa.Column('pd', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_referral_eye_id'), 'referral_eye', ['id'], unique=False)
    op.create_table('order_line_item',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('billings_id', sa.Integer(), nullable=False),
    sa.Column('sku', sa.String(), nullable=True),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('supplied_by', sa.String(), nullable=True),
    sa.Column('supplied', sa.Boolean(), nullable=True),
    sa.Column('price', sa.Float(), nullable=True),
    sa.Column('quantity', sa.Float(), nullable=True),
    sa.Column('discount', sa.Float(), nullable=True),
    sa.Column('line_total', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['billings_id'], ['billings.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_line_item_id'), 'order_line_item', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_order_line_item_id'), table_name='order_line_item')
    op.drop_table('order_line_item')
    op.drop_index(op.f('ix_referral_eye_id'), table_name='referral_eye')
    op.drop_table('referral_eye')
    op.drop_index(op.f('ix_exam_layout_instances_id'), table_name='exam_layout_instances')
    op.drop_index('ix_exam_layout_instances_exam_id_order', table_name='exam_layout_instances')
    op.drop_index('ix_exam_layout_instances_exam_id_is_active', table_name='exam_layout_instances')
    op.drop_index('ix_exam_layout_instances_exam_id', table_name='exam_layout_instances')
    op.drop_table('exam_layout_instances')
    op.drop_index(op.f('ix_email_logs_id'), table_name='email_logs')
    op.drop_table('email_logs')
    op.drop_index(op.f('ix_billings_id'), table_name='billings')
    op.drop_table('billings')
    op.drop_index('ix_referrals_user_id', table_name='referrals')
    op.drop_index(op.f('ix_referrals_id'), table_name='referrals')
    op.drop_index('ix_referrals_clinic_id', table_name='referrals')
    op.drop_index('ix_referrals_clinic_date', table_name='referrals')
    op.drop_index('ix_referrals_client_id', table_name='referrals')
    op.drop_table('referrals')
    op.drop_index('ix_orders_user_id', table_name='orders')
    op.drop_index(op.f('ix_orders_id'), table_name='orders')
    op.drop_index('ix_orders_clinic_id', table_name='orders')
    op.drop_index('ix_orders_clinic_date', table_name='orders')
    op.drop_index('ix_orders_client_id', table_name='orders')
    op.drop_table('orders')
    op.drop_index('ix_optical_exams_type', table_name='optical_exams')
    op.drop_index(op.f('ix_optical_exams_id'), table_name='optical_exams')
    op.drop_index('ix_optical_exams_clinic_type_date', table_name='optical_exams')
    op.drop_index('ix_optical_exams_clinic_id', table_name='optical_exams')
    op.drop_table('optical_exams')
    op.drop_index(op.f('ix_medical_logs_id'), table_name='medical_logs')
    op.drop_table('medical_logs')
    op.drop_index(op.f('ix_files_id'), table_name='files')
    op.drop_index('ix_files_clinic_upload_date', table_name='files')
    op.drop_index('ix_files_clinic_id', table_name='files')
    op.drop_index('ix_files_client_id', table_name='files')
    op.drop_table('files')
    op.drop_index('ix_contact_lens_orders_user_id', table_name='contact_lens_orders')
    op.drop_index(op.f('ix_contact_lens_orders_id'), table_name='contact_lens_orders')
    op.drop_index('ix_contact_lens_orders_clinic_id', table_name='contact_lens_orders')
    op.drop_index('ix_contact_lens_orders_clinic_date', table_name='contact_lens_orders')
    op.drop_index('ix_contact_lens_orders_client_id', table_name='contact_lens_orders')
    op.drop_table('contact_lens_orders')
    op.drop_index(op.f('ix_campaign_client_executions_id'), table_name='campaign_client_executions')
    op.drop_table('campaign_client_executions')
    op.drop_index('ix_appointments_user_id', table_name='appointments')
    op.drop_index(op.f('ix_appointments_id'), table_name='appointments')
    op.drop_index('ix_appointments_clinic_id', table_name='appointments')
    op.drop_index('ix_appointments_clinic_date_time', table_name='appointments')
    op.drop_index('ix_appointments_clinic_date', table_name='appointments')
    op.drop_index('ix_appointments_client_id', table_name='appointments')
    op.drop_table('appointments')
    op.drop_index(op.f('ix_work_shifts_id'), table_name='work_shifts')
    op.drop_table('work_shifts')
    op.drop_index(op.f('ix_clients_id'), table_name='clients')
    op.drop_index('ix_clients_family_id_id', table_name='clients')
    op.drop_index('ix_clients_family_id', table_name='clients')
    op.drop_index('ix_clients_clinic_id_id_desc', table_name='clients')
    op.drop_index('ix_clients_clinic_id', table_name='clients')
    op.drop_table('clients')
    op.drop_index(op.f('ix_chat_messages_id'), table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_users_is_active', table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index('ix_users_clinic_id', table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_settings_id'), table_name='settings')
    op.drop_index('ix_settings_clinic_id', table_name='settings')
    op.drop_table('settings')
    op.drop_index('ix_migration_source_links_target', table_name='migration_source_links')
    op.drop_index('ix_migration_source_links_source', table_name='migration_source_links')
    op.drop_index(op.f('ix_migration_source_links_id'), table_name='migration_source_links')
    op.drop_table('migration_source_links')
    op.drop_index(op.f('ix_families_id'), table_name='families')
    op.drop_index('ix_families_company_clinic_name', table_name='families')
    op.drop_index('ix_families_company_clinic_id', table_name='families')
    op.drop_index('ix_families_clinic_name', table_name='families')
    op.drop_index('ix_families_clinic_id', table_name='families')
    op.drop_index('ix_families_clinic_created', table_name='families')
    op.drop_table('families')
    op.drop_index(op.f('ix_exam_layouts_id'), table_name='exam_layouts')
    op.drop_table('exam_layouts')
    op.drop_index(op.f('ix_chats_id'), table_name='chats')
    op.drop_table('chats')
    op.drop_index(op.f('ix_campaigns_id'), table_name='campaigns')
    op.drop_table('campaigns')
    op.drop_index(op.f('ix_clinics_id'), table_name='clinics')
    op.drop_table('clinics')
    op.drop_index(op.f('ix_lookup_va_meter_id'), table_name='lookup_va_meter')
    op.drop_table('lookup_va_meter')
    op.drop_index(op.f('ix_lookup_va_decimal_id'), table_name='lookup_va_decimal')
    op.drop_table('lookup_va_decimal')
    op.drop_index(op.f('ix_lookup_supplier_id'), table_name='lookup_supplier')
    op.drop_table('lookup_supplier')
    op.drop_index(op.f('ix_lookup_rinsing_solution_id'), table_name='lookup_rinsing_solution')
    op.drop_table('lookup_rinsing_solution')
    op.drop_index(op.f('ix_lookup_referral_type_id'), table_name='lookup_referral_type')
    op.drop_table('lookup_referral_type')
    op.drop_index(op.f('ix_lookup_order_type_id'), table_name='lookup_order_type')
    op.drop_table('lookup_order_type')
    op.drop_index(op.f('ix_lookup_material_id'), table_name='lookup_material')
    op.drop_table('lookup_material')
    op.drop_index(op.f('ix_lookup_manufacturing_lab_id'), table_name='lookup_manufacturing_lab')
    op.drop_table('lookup_manufacturing_lab')
    op.drop_index(op.f('ix_lookup_manufacturer_id'), table_name='lookup_manufacturer')
    op.drop_table('lookup_manufacturer')
    op.drop_index(op.f('ix_lookup_lens_model_id'), table_name='lookup_lens_model')
    op.drop_table('lookup_lens_model')
    op.drop_index(op.f('ix_lookup_frame_model_id'), table_name='lookup_frame_model')
    op.drop_table('lookup_frame_model')
    op.drop_index(op.f('ix_lookup_disinfection_solution_id'), table_name='lookup_disinfection_solution')
    op.drop_table('lookup_disinfection_solution')
    op.drop_index(op.f('ix_lookup_contact_lens_type_id'), table_name='lookup_contact_lens_type')
    op.drop_table('lookup_contact_lens_type')
    op.drop_index(op.f('ix_lookup_contact_lens_model_id'), table_name='lookup_contact_lens_model')
    op.drop_table('lookup_contact_lens_model')
    op.drop_index(op.f('ix_lookup_contact_eye_material_id'), table_name='lookup_contact_eye_material')
    op.drop_table('lookup_contact_eye_material')
    op.drop_index(op.f('ix_lookup_contact_eye_lens_type_id'), table_name='lookup_contact_eye_lens_type')
    op.drop_table('lookup_contact_eye_lens_type')
    op.drop_index(op.f('ix_lookup_color_id'), table_name='lookup_color')
    op.drop_table('lookup_color')
    op.drop_index(op.f('ix_lookup_coating_id'), table_name='lookup_coating')
    op.drop_table('lookup_coating')
    op.drop_index(op.f('ix_lookup_clinic_id'), table_name='lookup_clinic')
    op.drop_table('lookup_clinic')
    op.drop_index(op.f('ix_lookup_cleaning_solution_id'), table_name='lookup_cleaning_solution')
    op.drop_table('lookup_cleaning_solution')
    op.drop_index(op.f('ix_lookup_advisor_id'), table_name='lookup_advisor')
    op.drop_table('lookup_advisor')
    op.drop_index(op.f('ix_companies_id'), table_name='companies')
    op.drop_table('companies')
