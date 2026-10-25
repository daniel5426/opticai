"""Synthetic local clinic. Refuse nonlocal connections or nonempty fixtures."""
from datetime import date, timedelta
import sys
from sqlalchemy.engine import make_url
from config import settings
from database import SessionLocal
from models import (Company, Clinic, User, Client, Settings, OpticalExam, ExamLayout, ExamLayoutInstance,
                    Order, OrderGroup, OrderGroupEntry, Billing, BillingPayment, Appointment, MedicalLog)
from auth import token_hash, encrypt_secret, create_auth_session
from .models import FollowupTask


def main():
    url = make_url(settings.DATABASE_URL)
    if url.host not in (None, 'localhost', '127.0.0.1') or url.database != 'opticai_agent_dev':
        raise RuntimeError('Synthetic seed requires opticai_agent_dev on localhost')
    with SessionLocal() as db:
        existing = db.query(Company).filter_by(name='Prysm Agent Demo').first()
        if existing:
            if '--session' in sys.argv:
                staff = db.query(User).filter_by(company_id=existing.id, username='prysm-agent-demo').one()
                clinic = db.get(Clinic, staff.clinic_id)
                client = db.query(Client).filter_by(clinic_id=clinic.id, first_name='Adam', last_name='Synthetic').one()
                session = create_auth_session(db, staff, clinic_id=clinic.id)
                db.commit()
                save_session(session, clinic.id, staff.id, client.id)
                print('Protected synthetic staff session refreshed.')
            else:
                print('Synthetic clinic already exists.')
            return
        today = date.today()
        company = Company(name='Prysm Agent Demo', owner_full_name='Demo owner', contact_email='demo@example.invalid', contact_phone='0500000000')
        db.add(company); db.flush()
        clinic = Clinic(company_id=company.id, name='Synthetic Clinic', unique_id='prysm-agent-demo-clinic')
        db.add(clinic); db.flush()
        staff = User(company_id=company.id, clinic_id=clinic.id, username='prysm-agent-demo', full_name='Demo practitioner', role_level=3)
        db.add(staff); db.flush()
        db.add(Settings(clinic_id=clinic.id, work_start_time='08:00', work_end_time='18:00', appointment_duration=30,
                        working_days='[0,1,2,3,4,5,6]', break_start_time='12:00', break_end_time='13:00'))
        clients = []
        for name, gender, birthday in [('Adam', 'male', '2014-01-15'), ('Ben', 'male', '2000-04-10'), ('Claire', 'female', '2012-05-22')]:
            client = Client(company_id=company.id, clinic_id=clinic.id, first_name=name, last_name='Synthetic',
                gender=gender, date_of_birth=date.fromisoformat(birthday), phone_mobile='0500000000', status='active')
            db.add(client); db.flush(); clients.append(client)
        layout = ExamLayout(clinic_id=clinic.id, name='Synthetic exam', layout_data='{}')
        db.add(layout); db.flush()
        for offset, prescription in [(365, -1.0), (0, -1.5)]:
            exam = OpticalExam(client_id=clients[0].id, clinic_id=clinic.id, user_id=staff.id, exam_date=today-timedelta(days=offset), test_name='Eye examination')
            db.add(exam); db.flush()
            db.add(ExamLayoutInstance(exam_id=exam.id, layout_id=layout.id, is_active=True,
                exam_data={'final-prescription': {'r_sph': prescription, 'r_cyl': -0.5, 'r_ax': 90, 'l_sph': -1, 'l_cyl': 0}}))
        order = Order(client_id=clients[0].id, clinic_id=clinic.id, user_id=staff.id, order_date=today-timedelta(days=14),
            order_data={'final-prescription': {'r_sph': -1.0}, 'details': {'promised_date': (today-timedelta(days=3)).isoformat(), 'order_status': 'in_production'}})
        db.add(order); db.flush()
        from services.order_group_service import ensure_standalone_group
        group = ensure_standalone_group(db, order)
        billing = Billing(order_group_id=group.id, order_id=order.id, total_after_discount=500, prepayment_amount=100, currency='ILS')
        db.add(billing); db.flush()
        db.add(BillingPayment(billing_id=billing.id, amount=100, paid_at=today-timedelta(days=10), currency='ILS'))
        db.add(Appointment(client_id=clients[0].id, clinic_id=clinic.id, user_id=staff.id, date=today, time='09:00', duration=30, exam_name='Eye exam'))
        db.add(MedicalLog(client_id=clients[0].id, clinic_id=clinic.id, user_id=staff.id, log_date=today-timedelta(days=365), log='Patient reports discomfort with current glasses. Synthetic fixture.'))
        db.add(FollowupTask(clinic_id=clinic.id, client_id=clients[0].id, assigned_user_id=staff.id,
            created_by_user_id=staff.id, title='Check delayed order', due_date=today))
        session = create_auth_session(db, staff, clinic_id=clinic.id)
        db.commit()
        save_session(session, clinic.id, staff.id, clients[0].id)
        print('Synthetic clinic seeded; protected demo session saved locally.')


def save_session(session, clinic_id, user_id, patient_id):
    from pathlib import Path
    import json, os
    path = Path(__file__).resolve().parents[2] / '.agent-data/demo-session.json'
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({'access_token': session['access_token'], 'refresh_token': session['refresh_token'],
        'clinic_id': clinic_id, 'user_id': user_id, 'patient_id': patient_id}))
    os.chmod(path, 0o600)


if __name__ == '__main__':
    main()
