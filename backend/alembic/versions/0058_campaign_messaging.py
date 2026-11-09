"""Durable campaigns and separate prepaid messaging finance; legacy campaigns require review."""
from alembic import op
import sqlalchemy as sa

revision = "0058_campaign_messaging"
down_revision = "0057_exam_workspace_save"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('messaging_accounts',
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False, primary_key=True),
        sa.Column('balance', sa.BigInteger(), nullable=False),
        sa.Column('reserved', sa.BigInteger(), nullable=False),
        sa.Column('allowance', sa.Integer(), nullable=False),
        sa.Column('used', sa.Integer(), nullable=False),
        sa.Column('held', sa.Integer(), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('manual_anchor', sa.DateTime(timezone=True), nullable=True),
        sa.Column('allowance_override', sa.Integer(), nullable=True),
        sa.Column('low_balance', sa.BigInteger(), nullable=False),
    )
    op.create_table('messaging_catalog',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('allowances', sa.JSON(), nullable=False),
        sa.Column('email_rate', sa.BigInteger(), nullable=True),
        sa.Column('sms_rate', sa.BigInteger(), nullable=True),
        sa.Column('packs', sa.JSON(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('effective_at', sa.DateTime(timezone=True)),
        sa.Column('pending_config', sa.JSON()),
        sa.Column('worker_heartbeat', sa.DateTime(timezone=True)),
    )
    op.create_table('messaging_clinics',
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False, primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('budget', sa.BigInteger(), nullable=True),
        sa.Column('reply_to', sa.String(length=320), nullable=True),
        sa.Column('timezone', sa.String(length=64), nullable=False),
    )
    op.create_index('ix_messaging_clinics_company_id', 'messaging_clinics', ['company_id'], unique=False)
    op.create_table('messaging_ledger',
        sa.Column('id', sa.String(length=32), nullable=False, primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=True),
        sa.Column('key', sa.String(length=180), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('key', name=None),
    )
    op.create_index('ix_messaging_ledger_clinic_id', 'messaging_ledger', ['clinic_id'], unique=False)
    op.create_index('ix_messaging_ledger_company_id', 'messaging_ledger', ['company_id'], unique=False)
    op.create_table('messaging_topups',
        sa.Column('id', sa.String(length=32), nullable=False, primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('request_key', sa.String(length=80), nullable=False),
        sa.Column('amount_minor', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False),
        sa.Column('test_mode', sa.Boolean(), nullable=False),
        sa.Column('payment_url', sa.Text(), nullable=True),
        sa.Column('receipt_url', sa.Text(), nullable=True),
        sa.Column('reversed', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('company_id', 'request_key', name='uq_messaging_topup_request'),
    )
    op.create_index('ix_messaging_topups_company_id', 'messaging_topups', ['company_id'], unique=False)
    op.create_table('campaign_details',
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('campaigns.id'), nullable=False, primary_key=True),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(length=300), nullable=False),
        sa.Column('locale', sa.String(length=2), nullable=False),
        sa.Column('all_clients', sa.Boolean(), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False),
        sa.Column('schedule', sa.JSON(), nullable=False),
        sa.Column('next_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_catalog', sa.Integer(), nullable=True),
        sa.Column('max_cost', sa.BigInteger(), nullable=True),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('last_error', sa.String(length=80), nullable=True),
    )
    op.create_index('ix_campaign_details_next_run', 'campaign_details', ['next_run'], unique=False)
    op.create_table('campaign_runs',
        sa.Column('id', sa.String(length=32), nullable=False, primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('campaigns.id'), nullable=False),
        sa.Column('request_key', sa.String(length=180), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False),
        sa.Column('snapshot', sa.JSON(), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('campaign_id', 'request_key', name='uq_campaign_run_request'),
    )
    op.create_index('ix_campaign_runs_company_id', 'campaign_runs', ['company_id'], unique=False)
    op.create_index('ix_campaign_runs_campaign_id', 'campaign_runs', ['campaign_id'], unique=False)
    op.create_index('ix_campaign_runs_clinic_id', 'campaign_runs', ['clinic_id'], unique=False)
    op.create_table('campaign_deliveries',
        sa.Column('id', sa.String(length=32), nullable=False, primary_key=True),
        sa.Column('run_id', sa.String(length=32), sa.ForeignKey('campaign_runs.id'), nullable=False),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('campaigns.id'), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('clinic_id', sa.Integer(), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=True),
        sa.Column('channel', sa.String(length=12), nullable=False),
        sa.Column('destination', sa.String(length=320), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('subject', sa.String(length=300), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False),
        sa.Column('segments', sa.Integer(), nullable=False),
        sa.Column('cost', sa.BigInteger(), nullable=False),
        sa.Column('allowance', sa.Integer(), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('provider', sa.String(length=40), nullable=True),
        sa.Column('provider_id', sa.String(length=160), nullable=True),
        sa.Column('provider_cost', sa.JSON()),
        sa.Column('error', sa.String(length=80), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('lease_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_attempt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('settled', sa.Boolean(), nullable=False),
        sa.Column('test', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('run_id', 'channel', 'destination', name='uq_campaign_delivery_destination'),
    )
    op.create_index('ix_campaign_deliveries_clinic_id', 'campaign_deliveries', ['clinic_id'], unique=False)
    op.create_index('ix_campaign_deliveries_lease_until', 'campaign_deliveries', ['lease_until'], unique=False)
    op.create_index('ix_campaign_deliveries_company_id', 'campaign_deliveries', ['company_id'], unique=False)
    op.create_index('ix_campaign_deliveries_campaign_id', 'campaign_deliveries', ['campaign_id'], unique=False)
    op.create_index('ix_campaign_deliveries_provider_id', 'campaign_deliveries', ['provider_id'], unique=False)
    op.create_index('ix_campaign_deliveries_run_id', 'campaign_deliveries', ['run_id'], unique=False)
    op.create_index('ix_campaign_deliveries_status', 'campaign_deliveries', ['status'], unique=False)
    op.create_table('campaign_contact_claims',
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('campaigns.id'), nullable=False, primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False, primary_key=True),
        sa.Column('channel', sa.String(length=12), nullable=False, primary_key=True),
        sa.Column('delivery_id', sa.String(length=32), sa.ForeignKey('campaign_deliveries.id'), nullable=False),
    )
    op.create_table('messaging_suppressions',
        sa.Column('id', sa.String(length=32), nullable=False, primary_key=True),
        sa.Column('scope', sa.Integer(), nullable=False),
        sa.Column('channel', sa.String(length=12), nullable=False),
        sa.Column('destination', sa.String(length=320), nullable=False),
        sa.Column('reason', sa.String(length=40), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('scope', 'channel', 'destination', name='uq_messaging_suppression'),
    )
    op.create_table('messaging_events',
        sa.Column('key', sa.String(length=200), nullable=False, primary_key=True),
        sa.Column('delivery_id', sa.String(length=32), sa.ForeignKey('campaign_deliveries.id'), nullable=True),
        sa.Column('kind', sa.String(length=40), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table('messaging_refunds',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('topup_id', sa.String(32), sa.ForeignKey('messaging_topups.id'), nullable=False),
        sa.Column('amount_minor', sa.Integer(), nullable=False),
        sa.Column('reversed_before', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(24), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_messaging_refunds_topup_id', 'messaging_refunds', ['topup_id'])
    # Only the API database role accesses these tables; block Supabase Data API roles.
    if op.get_bind().dialect.name == 'postgresql':
        for name in ('messaging_accounts','messaging_catalog','messaging_clinics','messaging_ledger','messaging_topups','campaign_details','campaign_runs','campaign_deliveries','campaign_contact_claims','messaging_suppressions','messaging_events','messaging_refunds'):
            op.execute(sa.text('ALTER TABLE ' + name + ' ENABLE ROW LEVEL SECURITY'))
    op.execute("INSERT INTO messaging_catalog (id, revision, allowances, packs, enabled) VALUES (1, 1, '{}', '[10000,25000,50000]', false)")
    op.execute("INSERT INTO campaign_details (campaign_id, revision, subject, locale, all_clients, status, schedule) SELECT id, 1, name, 'he', false, 'needs_review', '{}' FROM campaigns")
    op.execute('UPDATE campaigns SET active = false')

def downgrade():
    op.drop_table('messaging_refunds')
    op.drop_table('messaging_events')
    op.drop_table('messaging_suppressions')
    op.drop_table('campaign_contact_claims')
    op.drop_table('campaign_deliveries')
    op.drop_table('campaign_runs')
    op.drop_table('campaign_details')
    op.drop_table('messaging_topups')
    op.drop_table('messaging_ledger')
    op.drop_table('messaging_clinics')
    op.drop_table('messaging_catalog')
    op.drop_table('messaging_accounts')
