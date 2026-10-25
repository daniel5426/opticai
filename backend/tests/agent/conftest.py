from datetime import date, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base
from models import Company, Clinic, User, Client, AuthSession, Settings, Order, OrderGroup, OrderGroupEntry, Billing, BillingPayment
from agent.models import AgentContext
from agent.authority import Authority
from agent.config import now


@pytest.fixture
def clinic(monkeypatch, tmp_path):
    monkeypatch.setenv('PRYSM_AGENT_DATA_DIR', str(tmp_path))
    monkeypatch.setenv('AGENTS24_ENABLED', 'false')
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        company = Company(name='Synthetic', owner_full_name='Demo', contact_email='demo@example.invalid', contact_phone='0500000000')
        other = Company(name='Foreign', owner_full_name='Other', contact_email='other@example.invalid', contact_phone='0500000001')
        db.add_all([company, other]); db.flush()
        clinic = Clinic(company_id=company.id, name='Clinic', unique_id='clinic')
        foreign = Clinic(company_id=other.id, name='Foreign', unique_id='foreign')
        db.add_all([clinic, foreign]); db.flush()
        user = User(company_id=company.id, clinic_id=clinic.id, username='staff', role_level=3)
        db.add(user); db.flush()
        clients = [Client(company_id=company.id, clinic_id=clinic.id, first_name='Boy', last_name='Patient', gender='male', date_of_birth=date(2014, 1, 1)),
                   Client(company_id=company.id, clinic_id=clinic.id, first_name='Girl', last_name='Patient', gender='female', date_of_birth=date(2014, 1, 1)),
                   Client(company_id=other.id, clinic_id=foreign.id, first_name='Foreign', last_name='Patient')]
        db.add_all(clients); db.flush()
        session = AuthSession(id='00000000-0000-0000-0000-000000000001', user_id=user.id, company_id=company.id,
            clinic_id=clinic.id, refresh_token_hash='synthetic', expires_at=now() + timedelta(days=1))
        db.add(session); db.flush()
        binding = AgentContext(session_id=session.id, company_id=company.id, clinic_id=clinic.id, user_id=user.id, patient_scope=0)
        db.add(binding); db.flush()
        order = Order(client_id=clients[0].id, clinic_id=clinic.id, order_date=date(2026, 10, 1))
        db.add(order); db.flush()
        from services.order_group_service import ensure_standalone_group
        group = ensure_standalone_group(db, order)
        bill = Billing(order_id=order.id, order_group_id=group.id, total_after_discount=500, prepayment_amount=100, currency='ILS')
        db.add(bill); db.flush()
        db.add(BillingPayment(billing_id=bill.id, amount=100, currency='ILS', paid_at=date(2026, 10, 2)))
        db.add(Settings(clinic_id=clinic.id, work_start_time='08:00', work_end_time='18:00', working_days='[0,1,2,3,4,5,6]', break_start_time='12:00', break_end_time='13:00'))
        db.commit()
        yield db, Authority(user, clinic.id, binding.id), clients, sessions
    engine.dispose()
