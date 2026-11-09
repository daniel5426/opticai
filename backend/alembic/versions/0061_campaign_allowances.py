"""Monthly per-clinic channel allowances, explicit consent and provider monitoring."""
from alembic import op
import sqlalchemy as sa

revision = '0061_campaign_allowances'
down_revision = '0060_phone_scanner'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('messaging_accounts', sa.Column('sms_allowance_override', sa.Integer()))
    op.add_column('messaging_catalog', sa.Column('email_per_clinic', sa.Integer(), nullable=False, server_default='1000'))
    op.add_column('messaging_catalog', sa.Column('sms_per_clinic', sa.Integer(), nullable=False, server_default='200'))
    op.create_table('messaging_periods',
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), primary_key=True),
        sa.Column('period_start', sa.DateTime(timezone=True), primary_key=True),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        *[sa.Column(k, sa.Integer(), nullable=False, server_default=str(v)) for k, v in (
            ('eligible_clinics', 0), ('email_per_clinic', 1000), ('sms_per_clinic', 200),
            ('email_limit', 0), ('email_used', 0), ('email_held', 0), ('sms_limit', 0), ('sms_used', 0), ('sms_held', 0))])
    op.create_table('messaging_consents',
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), primary_key=True),
        sa.Column('channel', sa.String(12), primary_key=True),
        sa.Column('destination', sa.String(320), primary_key=True),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.Column('evidence', sa.String(1000), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('messaging_provider_states',
        sa.Column('provider', sa.String(40), primary_key=True),
        sa.Column('credit_units', sa.BigInteger()), sa.Column('usage', sa.JSON()),
        *[sa.Column(k, sa.DateTime(timezone=True)) for k in ('checked_at', 'next_request_at', 'blocked_until', 'last_callback_at')],
        sa.Column('error', sa.String(100)), sa.Column('blocked_reason', sa.String(100)))
    # Preserve all existing email usage and pending holds. No notification preference
    # is converted to marketing consent; imported patients require explicit evidence.
    op.execute("""INSERT INTO messaging_periods
        (company_id, period_start, period_end, eligible_clinics, email_limit, email_used, email_held, sms_limit)
        SELECT a.company_id, a.period_start, a.period_end, 0, a.allowance, a.used, a.held, 0
        FROM messaging_accounts a WHERE a.period_start IS NOT NULL AND a.period_end IS NOT NULL""")
    # Rates are the approved VAT-inclusive retail prices. Keep both kill switches,
    # pending price changes, wallets, and previously quoted delivery prices untouched.
    op.execute('UPDATE messaging_catalog SET email_rate=10000, sms_rate=50000, revision=revision+1')
    if op.get_bind().dialect.name == 'postgresql':
        for table in ('messaging_periods', 'messaging_consents', 'messaging_provider_states'):
            op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Include older periods still referenced by pending deliveries; they only
        # settle old holds and cannot grant fresh units.
        op.execute("""INSERT INTO messaging_periods
            (company_id, period_start, period_end, email_limit, email_used, email_held, sms_limit, sms_used, sms_held)
            SELECT company_id, period_start, period_start + interval '1 month',
                SUM(CASE WHEN channel='email' THEN allowance ELSE 0 END),
                SUM(CASE WHEN channel='email' AND settled AND status IN ('submitted','delivered','bounced','complained','undeliverable') THEN allowance ELSE 0 END),
                SUM(CASE WHEN channel='email' AND NOT settled THEN allowance ELSE 0 END),
                SUM(CASE WHEN channel='sms' THEN allowance ELSE 0 END),
                SUM(CASE WHEN channel='sms' AND settled AND status IN ('submitted','delivered','undeliverable') THEN allowance ELSE 0 END),
                SUM(CASE WHEN channel='sms' AND NOT settled THEN allowance ELSE 0 END)
            FROM campaign_deliveries WHERE period_start IS NOT NULL
            GROUP BY company_id, period_start ON CONFLICT DO NOTHING""")


def downgrade():
    for name in ('messaging_provider_states', 'messaging_consents', 'messaging_periods'):
        op.drop_table(name)
    op.drop_column('messaging_catalog', 'sms_per_clinic')
    op.drop_column('messaging_catalog', 'email_per_clinic')
    op.drop_column('messaging_accounts', 'sms_allowance_override')
