"""Add phone scanner transport without rewriting clinical records."""
from alembic import op
import sqlalchemy as sa
revision = '0060_phone_scanner'
down_revision = '0059_micropay_units'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('scanner_devices',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('secret_hash', sa.String(length=64), nullable=False),
    sa.Column('lease', sa.String(length=64), nullable=True),
    sa.Column('session_id', sa.String(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('context', sa.String(length=64), nullable=True),
    sa.Column('destination', sa.String(length=32), nullable=True),
    sa.Column('seen_at', sa.Float(), nullable=False),
    sa.Column('phone_id', sa.String(length=64), nullable=True),
    sa.Column('phone_seen_at', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['auth_sessions.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scanner_devices_clinic_id'), 'scanner_devices', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_scanner_devices_company_id'), 'scanner_devices', ['company_id'], unique=False)
    op.create_table('scanner_phones',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('secret_hash', sa.String(length=64), nullable=False),
    sa.Column('seen_at', sa.Float(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('secret_hash')
    )
    op.create_table('scanner_grants',
    sa.Column('phone_id', sa.String(length=64), nullable=False),
    sa.Column('device_id', sa.String(length=64), nullable=False),
    sa.ForeignKeyConstraint(['device_id'], ['scanner_devices.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['phone_id'], ['scanner_phones.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('phone_id', 'device_id')
    )
    op.create_table('scanner_pairings',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('device_id', sa.String(length=64), nullable=False),
    sa.Column('secret_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['device_id'], ['scanner_devices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('secret_hash')
    )
    op.create_table('scanner_attempts',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.Float(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('scanner_scans',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('device_id', sa.String(length=64), nullable=False),
    sa.Column('request_id', sa.String(length=64), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('clinic_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('phone_id', sa.String(length=64), nullable=True),
    sa.Column('lease', sa.String(length=64), nullable=False),
    sa.Column('context', sa.String(length=64), nullable=False),
    sa.Column('barcode', sa.String(length=256), nullable=False),
    sa.Column('variant_id', sa.Integer(), nullable=True),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.Float(), nullable=False),
    sa.Column('summary', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['device_id'], ['scanner_devices.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('device_id', 'request_id', name='uq_scanner_request')
    )
    op.create_index('ix_scanner_history', 'scanner_scans', ['clinic_id', 'created_at'], unique=False)
    op.create_table('scanner_events',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('device_id', sa.String(length=64), nullable=False),
    sa.Column('phone_id', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.Float(), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scanner_events_phone_id'), 'scanner_events', ['phone_id'], unique=False)
    op.create_index(op.f('ix_scanner_events_device_id'), 'scanner_events', ['device_id'], unique=False)
    if op.get_bind().dialect.name == "postgresql":
        for table in ['scanner_devices', 'scanner_phones', 'scanner_grants', 'scanner_pairings', 'scanner_attempts', 'scanner_scans', 'scanner_events']:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
            op.execute(f"REVOKE ALL ON TABLE {table} FROM anon, authenticated")

def downgrade():
    for table in ['scanner_events', 'scanner_scans', 'scanner_attempts', 'scanner_pairings', 'scanner_grants', 'scanner_phones', 'scanner_devices']:
        op.drop_table(table)
