"""Build component lookup without blocking writes to the existing prescription index."""
from alembic import op
import sqlalchemy as sa

revision = '0046_prescription_components'
down_revision = '0045_agent_search_reports'
branch_labels = None
depends_on = None

INDEX = 'ix_prescription_component'
TABLE = 'prescription_search_index'
COLUMNS = ['source_type', 'source_id', 'component_key', 'eye']


def upgrade():
    bind = op.get_bind()
    postgres = bind.dialect.name == 'postgresql'
    schema = bind.execute(sa.text('SELECT current_schema()')).scalar() if postgres else None
    existing = next((item for item in sa.inspect(bind).get_indexes(TABLE, schema=schema) if item['name'] == INDEX), None)
    if existing and (existing['column_names'] != COLUMNS or existing.get('unique') or existing.get('dialect_options', {}).get('postgresql_where')):
        raise RuntimeError('Existing prescription component index has an unexpected definition')
    if not postgres:
        if not existing:
            op.create_index(INDEX, TABLE, COLUMNS)
        return
    valid = bind.execute(sa.text('SELECT indisvalid AND indisready FROM pg_index WHERE indexrelid=to_regclass(:name)'),
        {'name': f'{schema}.{INDEX}'}).scalar() if existing else False
    if valid:
        return  # An earlier local 0045 draft already created the identical index.
    # 0045 commits before this block; a failed/interrupted concurrent build can
    # resume from 0045 without repeating its schema changes.
    with op.get_context().autocommit_block():
        if existing:
            op.drop_index(INDEX, table_name=TABLE, schema=schema, postgresql_concurrently=True)
        op.create_index(INDEX, TABLE, COLUMNS, schema=schema, postgresql_concurrently=True)


def downgrade():
    if op.get_bind().dialect.name == 'postgresql':
        with op.get_context().autocommit_block():
            op.drop_index(INDEX, table_name=TABLE, if_exists=True, postgresql_concurrently=True)
    else:
        op.drop_index(INDEX, table_name=TABLE, if_exists=True)
