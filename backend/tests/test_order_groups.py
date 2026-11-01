from datetime import date
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base
from models import Company, Clinic, User, Client, Order, Billing, BillingPayment, OrderLineItem, OrderGroup, OrderGroupEntry
from services.order_group_service import save_group, get_group, group_dict, ensure_standalone_group, group_write


@pytest.fixture
def context():
    engine = create_engine("sqlite:///:memory:", poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False)()
    company = Company(name="Test", owner_full_name="Owner")
    db.add(company); db.flush()
    clinic = Clinic(company_id=company.id, name="Test", unique_id="test")
    db.add(clinic); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, role_level=2, username="worker")
    clients = [Client(company_id=company.id, clinic_id=clinic.id, first_name=name) for name in ("One", "Two")]
    db.add_all([user, *clients]); db.commit()
    yield db, user, clinic, clients
    db.close()


def payload(clinic, clients):
    return {"clinic_id": clinic.id, "payer_client_id": clients[0].id,
        "entries": [{"client_key": str(index), "kind": kind, "order": {"client_id": clients[index].id, "type": kind, "order_date": str(date.today())}} for index, kind in enumerate(("regular", "contact"))],
        "billing": {"currency": "ILS", "notes": "retain", "discount_amount": 10, "discount_percent": 10},
        "line_items": [{"description": "User's price", "price": 100, "quantity": 1, "source_client_key": "0", "manually_edited": True}]}


def test_mixed_group_single_bill_idempotency_and_discount(context):
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="same-key")
    repeat = save_group(db, user, payload(clinic, clients), creation_key="same-key")
    assert first["id"] == repeat["id"]
    assert [entry["kind"] for entry in first["entries"]] == ["regular", "contact"]
    assert first["billing"]["total_after_discount"] == 90  # Amount and percent represent the same discount.
    assert db.query(Billing).count() == 1
    assert first["billing"]["order_id"] is None
    assert first["legacy_write_protected"]


def test_remove_tab_keeps_bill_items_and_payments(context):
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="remove")
    with group_write(db):
        billing = db.get(Billing, first["billing"]["id"])
        billing.prepayment_amount = 30
        db.add(BillingPayment(billing_id=billing.id, amount=30, paid_at=date.today()))
        db.commit()
    removed_id = first["entries"][0]["id"]
    result = save_group(db, user, {"revision": first["revision"], "removed_entry_ids": [removed_id]}, group_id=first["id"])
    assert len(result["entries"]) == 1
    assert result["billing"]["total_after_discount"] == 90
    assert result["billing"]["prepayment_amount"] == 30
    assert result["line_items"][0]["description"] == "User's price"
    assert result["line_items"][0]["source_entry_id"] is None
    assert db.query(BillingPayment).count() == 1
    final = save_group(db, user, {"revision": result["revision"], "removed_entry_ids": [result["entries"][0]["id"]]}, group_id=first["id"])
    assert final["entries"] == []
    assert final["billing"]["id"] == billing.id


def test_stale_revision_and_cross_group_item_rejected(context):
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="conflict")
    with pytest.raises(HTTPException) as conflict:
        save_group(db, user, {"revision": 0}, group_id=first["id"])
    assert conflict.value.status_code == 409
    second = save_group(db, user, payload(clinic, clients), creation_key="second")
    with pytest.raises(HTTPException) as invalid:
        save_group(db, user, {"revision": first["revision"], "billing": first["billing"], "line_items": second["line_items"]}, group_id=first["id"])
    assert invalid.value.status_code == 422
    db.rollback()


def test_legacy_group_writes_blocked_but_single_orders_work(context):
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="legacy")
    order = db.get(Order, first["entries"][0]["order"]["id"])
    order.type = "overwrite"
    with pytest.raises(HTTPException) as error:
        db.flush()
    assert error.value.status_code == 409
    db.rollback()
    single = Order(client_id=clients[0].id, clinic_id=clinic.id, type="single")
    db.add(single)
    group = ensure_standalone_group(db, single)
    db.commit()
    single.type = "updated"
    db.commit()
    assert not group.legacy_write_protected
    assert group.revision > 1


def test_group_delete_restore_preserves_shared_history(context):
    from services.trash_service import move_to_trash, restore_item
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="trash")
    with group_write(db):
        trash = move_to_trash(db, user, "order_group", first["id"])
    assert db.query(OrderGroup).count() == 0
    with group_write(db):
        restore_item(db, user, trash.id)
    restored = group_dict(db, get_group(db, user, first["id"]))
    assert len(restored["entries"]) == 2
    assert restored["billing"]["id"] == first["billing"]["id"]


def test_manual_paid_amount_creates_adjustment_without_replacing_history(context):
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="manual-payment")
    billing = {**first["billing"], "prepayment_amount": 25}
    next_group = save_group(db, user, {"revision": first["revision"], "billing": billing, "line_items": first["line_items"]}, group_id=first["id"])
    assert next_group["billing"]["prepayment_amount"] == 25
    assert db.query(BillingPayment).one().kind == "adjustment"
    billing["prepayment_amount"] = 15
    final = save_group(db, user, {"revision": next_group["revision"], "billing": billing, "line_items": next_group["line_items"]}, group_id=first["id"])
    assert final["billing"]["prepayment_amount"] == 15
    assert sorted(row.amount for row in db.query(BillingPayment).all()) == [-10, 25]


def test_orm_import_creation_is_linked_without_startup_schema_changes(context):
    db, user, clinic, clients = context
    imported = Order(client_id=clients[0].id, clinic_id=clinic.id, type="imported")
    db.add(imported);db.commit()
    entry = db.query(OrderGroupEntry).filter(OrderGroupEntry.order_id == imported.id).one()
    assert db.get(OrderGroup, entry.group_id).payer_client_id == clients[0].id


def test_paid_balance_counted_once_for_payer_across_both_kinds(context):
    from EndPoints.orders import _attach_billing_summaries
    from models import ContactLensOrder
    db, user, clinic, clients = context
    data = payload(clinic, clients)
    data["entries"][1]["order"]["client_id"] = clients[0].id
    first = save_group(db, user, data, creation_key="payer-balance")
    regular = db.get(Order, first["entries"][0]["order"]["id"])
    contact = db.get(ContactLensOrder, first["entries"][1]["order"]["id"])
    _attach_billing_summaries(db, [regular])
    _attach_billing_summaries(db, [contact], contact=True)
    assert regular.billing_total_after_discount == 90
    assert contact.billing_total_after_discount == 0


def test_grouped_invoice_survives_physical_member_purge(context):
    from services.trash_service import _purge
    from models import TrashJob
    from unittest.mock import Mock
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key="purge-tab")
    order_id = first["entries"][0]["order"]["id"]
    save_group(db, user, {"revision": first["revision"], "removed_entry_ids": [first["entries"][0]["id"]]}, group_id=first["id"])
    deleted = db.query(Order).execution_options(include_deleted=True).filter(Order.id == order_id).one()
    job = TrashJob(trash_item_id=deleted.trash_item_id, job_type="purge", generation=1)
    db.add(job);db.flush();_purge(db,job,Mock());db.commit()
    assert db.get(Billing, first["billing"]["id"])
    assert db.query(OrderLineItem).count() == 1


@pytest.mark.parametrize('path', ['order','contact','status','delete_order','delete_contact','invoice','delete_invoice','item','move_item','delete_item','payment','delete_payment','client','full','full_contact'])
def test_every_legacy_mutation_rejects_protected_groups(context, path):
    from EndPoints import orders as orders_api, billing as billing_api, clients as clients_api
    from schemas import OrderUpdate, ContactLensOrderUpdate, BillingUpdate, OrderLineItemUpdate, BillingPaymentCreate
    db, user, clinic, clients = context
    first = save_group(db, user, payload(clinic, clients), creation_key='guard-'+path)
    regular, contact = first['entries']; invoice = first['billing']; item = first['line_items'][0]
    with group_write(db):
        payment = BillingPayment(billing_id=invoice['id'],amount=5,paid_at=date.today())
        db.add(payment);db.commit()
    single = Order(client_id=clients[0].id,clinic_id=clinic.id,type='independent')
    db.add(single);db.commit()
    standalone = Billing(order_id=single.id,currency='ILS');db.add(standalone);db.commit()
    actions = {
        'order': lambda: orders_api.update_order(regular['order']['id'],OrderUpdate(type='changed'),db,user),
        'contact': lambda: orders_api.update_contact_lens_order(contact['order']['id'],ContactLensOrderUpdate(type='changed'),db,user),
        'status': lambda: orders_api.update_contact_lens_order(contact['order']['id'],ContactLensOrderUpdate(order_status='changed'),db,user),
        'delete_order': lambda: orders_api.delete_order(regular['order']['id'],db,user),
        'delete_contact': lambda: orders_api.delete_contact_lens_order(contact['order']['id'],db,user),
        'invoice': lambda: billing_api.update_billing(invoice['id'],BillingUpdate(discount_amount=2),db,user),
        'delete_invoice': lambda: billing_api.delete_billing(invoice['id'],db,user),
        'item': lambda: billing_api.update_order_line_item(item['id'],OrderLineItemUpdate(price=2),db,user),
        'move_item': lambda: billing_api.update_order_line_item(item['id'],OrderLineItemUpdate(billings_id=standalone.id),db,user),
        'delete_item': lambda: billing_api.delete_order_line_item(item['id'],db,user),
        'payment': lambda: billing_api.create_billing_payment(invoice['id'],BillingPaymentCreate(amount=3,paid_at=date.today()),db,user),
        'delete_payment': lambda: billing_api.delete_billing_payment(invoice['id'],payment.id,db,user),
        'client': lambda: clients_api.delete_client(clients[0].id,db,user),
        'full': lambda: orders_api.upsert_order_full({'order':regular['order'],'billing':invoice,'line_items':first['line_items']},db,user),
        'full_contact': lambda: orders_api.upsert_contact_lens_order_full({'order':contact['order'],'billing':invoice,'line_items':first['line_items']},db,user),
    }
    with pytest.raises(HTTPException) as error:actions[path]()
    assert error.value.status_code == 409
    db.rollback()
    assert db.get(Billing,invoice['id']).total_after_discount == 90
    assert db.query(BillingPayment).count() == 1


def test_removal_with_ui_billing_payload_preserves_manual_history(context):
    db,user,clinic,clients=context
    first=save_group(db,user,payload(clinic,clients),creation_key='removal-ui')
    result=save_group(db,user,{'revision':first['revision'],'removed_entry_ids':[first['entries'][0]['id']], 'billing':first['billing'],'line_items':first['line_items']},group_id=first['id'])
    assert result['billing']['total_after_discount']==90
    assert result['line_items'][0]['manually_edited']
    assert result['line_items'][0]['source_entry_id'] is None
    assert result['line_items'][0]['source_slot'] is None


def test_billing_metadata_edit_does_not_recalculate_historical_invoice(context):
    db,user,clinic,clients=context
    first=save_group(db,user,payload(clinic,clients),creation_key='history-total')
    with group_write(db):
        db.get(Billing,first['billing']['id']).total_after_discount=88.88;db.commit()
    result=save_group(db,user,{'revision':first['revision'],'billing':{**first['billing'],'notes':'updated'},'line_items':first['line_items']},group_id=first['id'])
    assert result['billing']['total_after_discount']==88.88


def test_group_schema_rejects_invalid_financial_values_and_preserves_clinical_extras():
    from schemas import OrderGroupSave
    from pydantic import ValidationError
    with pytest.raises(ValidationError):OrderGroupSave(billing={'discount_percent':101})
    with pytest.raises(ValidationError):OrderGroupSave(line_items=[{'price':'not money'}])
    value=OrderGroupSave(entries=[{'kind':'contact','order':{'client_id':1,'l_model':'retained','order_data':{'unknown':1}}}])
    assert value.model_dump(exclude_unset=True)['entries'][0]['order']['l_model']=='retained'


def test_client_deletion_keeps_other_clients_and_shared_invoice(context):
    from EndPoints.order_groups import delete_group_client, restore_group_records
    db,user,clinic,clients=context
    first=save_group(db,user,payload(clinic,clients),creation_key='client-history')
    result=delete_group_client(clients[0].id,db,user)
    current=group_dict(db,get_group(db,user,first['id']))
    assert len(current['entries'])==1
    assert current['entries'][0]['order']['client_id']==clients[1].id
    assert current['billing']['id']==first['billing']['id']
    assert current['line_items'][0]['source_entry_id'] is None
    assert current['line_items'][0]['manually_edited']
    restore_group_records(result['trash_item_id'],db,user)
    assert len(group_dict(db,get_group(db,user,first['id']))['entries'])==2


def test_shared_group_analytics_counts_invoice_once(context):
    from services.analytics_service import build_company_analytics, resolve_analytics_window
    db,user,clinic,clients=context
    first=save_group(db,user,payload(clinic,clients),creation_key='analytics-once')
    report=build_company_analytics(db,company_id=clinic.company_id,window=resolve_analytics_window(date.today(),date.today()),currency='ILS')
    metrics={item['key']:item['value'] for item in report['metrics']}
    assert metrics['sales']==90
    assert metrics['outstanding']==90
    assert report['order_mix']==[{'type':'order_group','count':1}]


def test_same_group_lists_once_for_participants_and_payer(context):
    from EndPoints.order_groups import list_groups
    db,user,clinic,clients=context
    extra=Client(company_id=clinic.company_id,clinic_id=clinic.id,first_name='Payer')
    db.add(extra);db.commit()
    data=payload(clinic,clients);data['payer_client_id']=extra.id
    first=save_group(db,user,data,creation_key='list-once')
    for client in [*clients,extra]:
        result=list_groups(client_id=client.id,clinic_id=clinic.id,limit=25,offset=0,q=None,kind=None,status=None,order='date_desc',db=db,user=user)
        assert result['total']==1
        assert result['items'][0]['id']==first['id']


def test_postgres_concurrent_saves_preserve_revision_and_atomicity():
    import os
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    import sqlalchemy as sa
    url=os.getenv('TEST_ORDER_GROUP_DATABASE_URL')
    if not url:pytest.skip('Isolated PostgreSQL not configured')
    admin=sa.create_engine(url)
    with admin.begin() as connection:connection.execute(sa.text('CREATE SCHEMA group_concurrency_test'))
    engine=sa.create_engine(url,connect_args={'options':'-csearch_path=group_concurrency_test'})
    factory=sessionmaker(bind=engine,autoflush=False)
    try:
        Base.metadata.create_all(engine)
        with factory() as db:
            company=Company(name='Concurrent',owner_full_name='Owner');db.add(company);db.flush()
            clinic=Clinic(company_id=company.id,name='Concurrent',unique_id='concurrent');db.add(clinic);db.flush()
            user=User(company_id=company.id,clinic_id=clinic.id,role_level=2,username='tester')
            clients=[Client(company_id=company.id,clinic_id=clinic.id,first_name=name) for name in ('One','Two')]
            db.add_all([user,*clients]);db.commit()
            result=save_group(db,user,payload(clinic,clients),creation_key='concurrent')
            group_id,revision,user_id=result['id'],result['revision'],user.id
        barrier=Barrier(2)
        def write():
            with factory() as db:
                user=db.get(User,user_id)
                # Preload the group to ensure row locking refreshes cached revisions.
                db.get(OrderGroup,group_id);barrier.wait()
                try:
                    return save_group(db,user,{'revision':revision},group_id=group_id)['revision']
                except HTTPException as error:
                    db.rollback();return error.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:write(),range(2)))
        assert sorted(results)==[revision+1,409]
        with factory() as db:
            assert db.get(OrderGroup,group_id).revision==revision+1
            assert db.query(Billing).count()==1
            assert db.query(OrderLineItem).count()==1
    finally:
        engine.dispose()
        with admin.begin() as connection:connection.execute(sa.text('DROP SCHEMA group_concurrency_test CASCADE'))
        admin.dispose()



def test_read_only_users_cannot_write_shared_payments(context):
    from EndPoints.order_groups import add_payment
    from schemas import BillingPaymentCreate
    db,user,clinic,clients=context
    first=save_group(db,user,payload(clinic,clients),creation_key='payment-permission')
    user.role_level=1;db.commit()
    with pytest.raises(HTTPException) as error:
        add_payment(first['id'],BillingPaymentCreate(amount=5,paid_at=date.today()),first['revision'],db,user)
    assert error.value.status_code==403
    assert db.query(BillingPayment).count()==0


def test_group_endpoints_create_and_add_orders_without_enablement(context):
    from EndPoints.order_groups import capabilities, create_group, update_group
    from schemas import OrderGroupSave
    db,user,clinic,clients=context
    assert capabilities(db)=={'available':True,'workspace_enabled':True,'creation_enabled':True}
    data=OrderGroupSave.model_validate(payload(clinic,clients))
    first=create_group(data,'always-available',db,user)
    repeated=create_group(data,'always-available',db,user)
    assert repeated['id']==first['id']
    updated=update_group(first['id'],OrderGroupSave.model_validate({
        'revision':first['revision'],
        'entries':[{'client_key':'extra','kind':'regular','order':{'client_id':clients[0].id,'type':'Reading'}}],
    }),db,user)
    assert len(updated['entries'])==3
    assert updated['billing']==first['billing']


def test_legacy_single_order_full_save_and_shared_reads_remain_compatible(context):
    from EndPoints.orders import upsert_order_full, get_order
    from EndPoints.billing import get_billing_by_order, get_billing_by_contact_lens
    from services.order_group_service import group_for_order
    db,user,clinic,clients=context
    saved=upsert_order_full({
        'order':{'client_id':clients[0].id,'clinic_id':clinic.id,'type':'Distance','order_data':{'legacy':{'retained':True}}},
        'billing':{'currency':'ILS','total_after_discount':75},
        'line_items':[{'description':'Legacy item','price':75,'quantity':1,'line_total':75}],
    },db,user)
    order=get_order(saved['order'].id,db,user)
    billing=get_billing_by_order(order.id,db,user)
    updated=upsert_order_full({'order':{'id':order.id,'type':'Reading'}},db,user)
    assert updated['order'].type=='Reading'
    assert updated['order'].order_data['legacy']=={'retained':True}
    assert get_billing_by_order(order.id,db,user).id==billing.id
    assert not group_for_order(db,order.id).legacy_write_protected
    shared=save_group(db,user,payload(clinic,clients),creation_key='legacy-shared-read')
    assert get_billing_by_order(shared['entries'][0]['order']['id'],db,user).id==shared['billing']['id']
    assert get_billing_by_contact_lens(shared['entries'][1]['order']['id'],db,user).id==shared['billing']['id']


def list_history(db, user, clinic, **overrides):
    from EndPoints.order_groups import list_groups
    options = dict(client_id=None, clinic_id=clinic.id, limit=25, offset=0,
                   q=None, kind=None, status=None, order='date_desc', db=db, user=user)
    return list_groups(**(options | overrides))


def test_history_includes_unlinked_legacy_orders_with_billing_without_writes(context):
    from models import ContactLensOrder
    from sqlalchemy import insert
    from EndPoints.order_groups import link_imported_order
    db, user, clinic, clients = context
    # Core imports bypass ORM creation hooks, as does data predating groups.
    db.execute(insert(Order).values(id=70, client_id=clients[0].id, clinic_id=clinic.id,
                                   type='Distance', order_date=date(2024, 1, 1),
                                   order_data={'details': {'order_status': 'ready'}}))
    db.execute(insert(ContactLensOrder).values(id=70, client_id=clients[1].id, clinic_id=clinic.id,
                                              type='Contact', order_date=date(2024, 2, 1), order_status='ready'))
    db.execute(insert(Billing).values(id=80, order_id=70, currency='EUR',
                                     total_after_discount=100, prepayment_amount=30))
    db.commit()
    result = list_history(db, user, clinic)
    assert result['total'] == 2
    assert [row['legacy_order']['kind'] for row in result['items']] == ['contact', 'regular']
    assert result['items'][1]['billing']['id'] == 80
    assert result['items'][1]['billing']['prepayment_amount'] == 30
    assert db.query(OrderGroup).count() == 0
    assert db.get(Billing, 80).order_group_id is None
    assert list_history(db, user, clinic, client_id=clients[0].id)['total'] == 1
    assert list_history(db, user, clinic, kind='contact')['items'][0]['legacy_order']['kind'] == 'contact'
    assert list_history(db, user, clinic, q='Distance')['total'] == 1
    assert list_history(db, user, clinic, q='Two')['total'] == 1
    assert list_history(db, user, clinic, status='ready')['total'] == 2
    assert list_history(db, user, clinic, status='missing')['total'] == 0
    assert list_history(db, user, clinic, order='date_asc', limit=1)['items'][0]['legacy_order']['kind'] == 'regular'
    assert list_history(db, user, clinic, limit=1, offset=1)['items'][0]['legacy_order']['kind'] == 'regular'
    linked = link_imported_order('regular', 70, db, user)
    assert linked['billing']['id'] == 80
    assert list_history(db, user, clinic)['total'] == 2
    assert len([row for row in list_history(db, user, clinic)['items'] if row.get('legacy_order')]) == 1


def test_history_excludes_deleted_and_other_clinic_orders(context):
    from sqlalchemy import insert
    from datetime import datetime, timezone
    db, user, clinic, clients = context
    other = Clinic(company_id=clinic.company_id, name='Other', unique_id='other')
    db.add(other); db.commit()
    for order_id, clinic_id, deleted in ((71, clinic.id, True), (72, other.id, False)):
        db.execute(insert(Order).values(id=order_id, client_id=clients[0].id, clinic_id=clinic_id,
                                       deleted_at=datetime.now(timezone.utc) if deleted else None))
    saved = save_group(db, user, payload(clinic, clients), creation_key='deleted-history')
    with group_write(db):
        db.get(OrderGroup, saved['id']).deleted_at = datetime.now(timezone.utc)
        db.commit()
    assert list_history(db, user, clinic)['total'] == 0


def test_capabilities_reflect_migration_readiness(context):
    from EndPoints.order_groups import capabilities
    from EndPoints.orders import _shared_page_billing
    from services.order_group_service import order_groups_available
    from sqlalchemy.orm import Session
    from sqlalchemy import text
    db, user, clinic, clients = context
    assert capabilities(db)['available'] is True
    old_engine = create_engine('sqlite:///:memory:')
    with old_engine.begin() as connection:
        connection.execute(text('CREATE TABLE orders (id INTEGER PRIMARY KEY)'))
    with Session(old_engine) as old_db:
        assert capabilities(old_db) == {'available': False, 'workspace_enabled': False, 'creation_enabled': False}
        rows = [{'id': 7, 'billing_total_after_discount': 100, 'billing_prepayment_amount': 30}]
        assert _shared_page_billing(old_db, rows) is rows
        assert not order_groups_available(old_db)
    old_engine.dispose()



def test_table_quick_payment_uses_one_shared_invoice_and_rejects_stale_retry(context):
    from EndPoints.order_groups import add_payment, payments
    from schemas import BillingPaymentCreate
    db, user, clinic, clients = context
    saved = save_group(db, user, payload(clinic, clients), creation_key='table-quick-payment')
    result = add_payment(saved['id'], BillingPaymentCreate(amount=25, paid_at=date.today(), kind='payment'), saved['revision'], db, user)
    assert result['group']['revision'] == saved['revision'] + 1
    assert result['group']['billing']['id'] == saved['billing']['id']
    assert result['group']['billing']['total_after_discount'] == 90
    assert result['group']['billing']['prepayment_amount'] == 25
    assert len(result['group']['entries']) == 2
    assert db.query(Billing).count() == 1
    assert len(payments(saved['id'], db, user)) == 1
    with pytest.raises(HTTPException) as stale:
        add_payment(saved['id'], BillingPaymentCreate(amount=25, paid_at=date.today()), saved['revision'], db, user)
    assert stale.value.status_code == 409
    assert db.query(BillingPayment).count() == 1
    assert db.get(Billing, saved['billing']['id']).prepayment_amount == 25


def test_history_column_filters_cover_groups_and_unlinked_orders(context):
    import json
    from sqlalchemy import insert
    db, user, clinic, clients = context
    group = save_group(db, user, payload(clinic, clients), creation_key='column-filters')
    db.execute(insert(Order).values(id=90, client_id=clients[1].id, clinic_id=clinic.id, type='Reading',
                                   order_date=date(2024, 3, 1), order_data={'details': {'order_status': 'ready'}}))
    db.commit()
    total = lambda filters, **extra: list_history(db, user, clinic, filters=json.dumps(filters), **extra)['total']

    assert total({}) == 2
    assert total({'clients': 'two'}) == 2          # Two is in the group and owns the unlinked order
    assert total({'clients': 'one'}) == 1
    assert total({'payer': 'one'}) == 1            # group payer
    assert total({'payer': 'two'}) == 1            # unlinked order's own client
    assert total({'kinds': ['contact']}) == 1
    assert total({'kinds': ['regular', 'contact']}) == 2
    assert total({'status': ['ready']}) == 1
    assert total({'status': ['ready', 'missing']}) == 1
    assert total({'date': {'from': '2024-03-01', 'to': '2024-03-01'}}) == 1
    assert total({'date': {'to': '2024-02-28'}}) == 0
    assert total({'kinds': ['contact']}, kind='regular') == 0  # toolbar and column filter must both match
    assert total({'clients': 'two', 'kinds': ['regular'], 'date': {'to': '2024-12-31'}}) == 1
    assert group['id'] in [row['id'] for row in list_history(db, user, clinic, filters=json.dumps({'payer': 'one'}))['items']]
