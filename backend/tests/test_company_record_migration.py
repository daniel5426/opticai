"""Exercise the ownership migration on an isolated, disposable PostgreSQL cluster."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from database import Base
import agent.models  # Register child tables before creating the legacy fixture.

PG_BIN = Path('/opt/homebrew/opt/postgresql@17/bin')


@pytest.fixture(scope='module')
def pg_engine(tmp_path_factory):
    if not (PG_BIN/'initdb').exists():
        pytest.skip('Disposable PostgreSQL binaries unavailable')
    root = tmp_path_factory.mktemp('company-record-pg')
    data, socket = root/'data', Path(tempfile.mkdtemp(prefix='opticai-pg-', dir='/tmp'))
    subprocess.run([str(PG_BIN/'initdb'),'-D',str(data),'-A','trust','-U','company_test','--no-locale'],check=True,capture_output=True)
    subprocess.run([str(PG_BIN/'pg_ctl'),'-D',str(data),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -h '' -p 55439",'-w','start'],check=True,capture_output=True)
    url = URL.create('postgresql+psycopg2',username='company_test',host=str(socket),port=55439,database='postgres')
    # This target is newly created by this fixture, never DATABASE_URL or a shared host.
    engine=create_engine(url)
    try: yield engine
    finally:
        engine.dispose()
        subprocess.run([str(PG_BIN/'pg_ctl'),'-D',str(data),'-m','fast','-w','stop'],check=True,capture_output=True)
        shutil.rmtree(socket)


def migration():
    spec=importlib.util.spec_from_file_location('company_upgrade',Path(__file__).parents[1]/'alembic/versions/0049_company_client_records.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def legacy_schema(connection):
    connection.execute(text('DROP SCHEMA public CASCADE'))
    connection.execute(text('CREATE SCHEMA public'))
    Base.metadata.create_all(connection)
    for table in migration().ROOTS:
        connection.execute(text(f'ALTER TABLE {table} DROP COLUMN company_id CASCADE'))
    connection.execute(text("INSERT INTO companies (id,name,owner_full_name) VALUES (1,'Company','Owner'),(2,'Other','Owner')"))
    connection.execute(text("INSERT INTO clinics (id,company_id,name,unique_id,entry_pin_version,maintenance_mode) VALUES (1,1,'A','a',1,false),(2,1,'B','b',1,false),(3,2,'C','c',1,false)"))
    connection.execute(text("INSERT INTO clients (id,company_id,clinic_id,first_name) VALUES (1,1,1,'Shared'),(2,2,3,'Other')"))


def upgrade(connection):
    with Operations.context(MigrationContext.configure(connection)):
        migration().upgrade()


def test_backfill_includes_deleted_history_and_preserves_clinic(pg_engine):
    with pg_engine.begin() as c:
        legacy_schema(c)
        c.execute(text("INSERT INTO optical_exams(id,client_id,clinic_id,test_name,deleted_at) VALUES(1,1,2,'History',now())"))
        upgrade(c)
        assert c.execute(text('SELECT company_id,clinic_id FROM optical_exams WHERE id=1')).one()==(1,2)
        # Older writers can omit ownership during rolling deployment.
        c.execute(text("INSERT INTO orders(id,client_id,clinic_id,order_data) VALUES(1,1,2,'{}')"))
        assert c.execute(text('SELECT company_id FROM orders WHERE id=1')).scalar()==1
        assert c.execute(text('SELECT count(*) FROM optical_exams WHERE deleted_at IS NOT NULL')).scalar()==1


def test_database_rejects_cross_company_links(pg_engine):
    with pg_engine.begin() as c:
        legacy_schema(c);upgrade(c)
    for query in (
        "INSERT INTO orders(id,company_id,client_id,clinic_id,order_data) VALUES(2,1,2,1,'{}')",
        'INSERT INTO optical_exams(id,company_id,client_id,clinic_id) VALUES(2,1,1,3)',
        "INSERT INTO families(id,company_id,clinic_id,name) VALUES(1,2,3,'Other'); UPDATE clients SET family_id=1 WHERE id=1",
    ):
        with pytest.raises(Exception):
            with pg_engine.begin() as c:c.execute(text(query))


def test_preflight_blocks_conflicting_history_transactionally(pg_engine):
    with pg_engine.begin() as c:
        legacy_schema(c)
        c.execute(text("INSERT INTO orders(id,client_id,clinic_id,order_data) VALUES(1,1,3,'{}')"))
    with pytest.raises(RuntimeError,match='preflight failed'):
        with pg_engine.begin() as c:upgrade(c)
    with pg_engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='company_id'")).scalar()==0
        assert c.execute(text('SELECT clinic_id FROM orders')).scalar()==3


def test_postgres_cross_clinic_merge_and_trash_lock_real_groups(pg_engine):
    from sqlalchemy.orm import sessionmaker
    from models import User, Client, OpticalExam
    from EndPoints.clients import merge_clients
    from schemas import ClientMergeRequest
    from services.order_group_service import save_group
    from services.trash_service import move_to_trash, restore_item
    with pg_engine.begin() as c:
        legacy_schema(c);upgrade(c)
    with sessionmaker(bind=pg_engine,autoflush=False,expire_on_commit=False)() as db:
        user=User(company_id=1,clinic_id=2,username='Synthetic worker',role_level=2)
        duplicate=Client(id=3,company_id=1,clinic_id=2,first_name='Duplicate')
        db.add_all([user,duplicate]);db.flush()
        db.add(OpticalExam(client_id=3,clinic_id=2));db.commit()
        group=save_group(db,user,{'clinic_id':2,'payer_client_id':3,'entries':[
            {'kind':'regular','order':{'client_id':3,'order_date':'2026-11-02'}},
            {'kind':'contact','order':{'client_id':1,'order_date':'2026-11-02'}}]},creation_key='postgres-merge')
        result=merge_clients(ClientMergeRequest(canonical_client_id=1,duplicate_client_ids=[3]),db,user)
        assert result['merged_client_ids']==[3]
        item=move_to_trash(db,user,'client',1)
        assert db.query(OpticalExam).count()==0
        restore_item(db,user,item.id)
        assert db.query(OpticalExam).one().client_id==1
