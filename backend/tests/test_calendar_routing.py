from datetime import timedelta
from unittest.mock import Mock
import pytest
import requests
from auth import encrypt_secret
from models import User, GoogleCalendarSync
from services import google_calendar as calendar
from backend.tests.test_google_calendar import setup, appointment, queued, response
from backend.tests.test_company_client_records import scope


def test_default_remains_self_and_primary(setup):
    s=setup
    appt,row=queued(s)
    assert s.db.query(GoogleCalendarSync).count()==1 and row.user_id==s.user.id
    calendar.run_once(s.db)
    assert '/calendars/primary/events/' in s.network.call_args.args[1]


def test_selected_clinic_calendar_and_move_cleanup(setup):
    s=setup
    appt,row=queued(s)
    calendar.run_once(s.db);original=row.event_id
    s.user.google_calendar_routes={str(s.a.id):{'calendar_id':'clinic@group.calendar.google.com'}}
    calendar.enqueue(s.db,appt);s.db.commit()
    assert row.event_id!=original and row.retired_events[0]['event_id']==original
    s.network.reset_mock();calendar.run_once(s.db)
    calls=s.network.call_args_list
    assert calls[0].args[0]=='DELETE' and '/primary/events/' in calls[0].args[1]
    assert 'clinic%40group.calendar.google.com' in calls[1].args[1]
    assert appt.google_calendar_event_id==row.event_id


def owner(s):
    u=User(company_id=s.user.company_id,clinic_id=s.a.id,username='overview-owner',role_level=4,
        google_account_connected=True,google_calendar_sync_enabled=True,google_access_token=encrypt_secret('owner-token'),
        google_calendar_routes={str(s.a.id):{'workers':[s.user.id]}})
    s.db.add(u);s.db.flush();return u


def test_owner_overlay_is_opt_in_and_deduplicates_self(setup):
    s=setup;manager=owner(s)
    appt,row=queued(s)
    rows=s.db.query(GoogleCalendarSync).filter_by(appointment_id=appt.id).all()
    assert {r.user_id for r in rows}=={s.user.id,manager.id}
    calendar.run_once(s.db);calendar.run_once(s.db)
    assert row.event_id==appt.google_calendar_event_id
    overlay=next(r for r in rows if r.user_id==manager.id)
    assert overlay.event_id!=row.event_id
    manager.google_calendar_routes={str(s.a.id):{'all_workers':True}}
    appt.user_id=manager.id;calendar.enqueue(s.db,appt,s.user.id,row.event_id);s.db.commit()
    assert s.db.query(GoogleCalendarSync).filter_by(appointment_id=appt.id,user_id=manager.id).count()==1


def test_unsubscribe_or_role_loss_removes_overlay_without_touching_worker(setup):
    s=setup;manager=owner(s);appt,row=queued(s)
    calendar.run_once(s.db);calendar.run_once(s.db)
    worker_id=appt.google_calendar_event_id
    manager.google_calendar_routes={}
    calendar.enqueue(s.db,appt,force=True,receiver_id=manager.id);s.db.commit()
    overlay=s.db.query(GoogleCalendarSync).filter_by(appointment_id=appt.id,user_id=manager.id).one()
    calendar.run_once(s.db)
    assert overlay.status=='deleted' and appt.google_calendar_event_id==worker_id
    manager.google_calendar_routes={str(s.a.id):{'all_workers':True}};manager.role_level=2
    assert not calendar.eligible(manager,appt)


def test_missing_destination_never_falls_back_to_primary(setup):
    s=setup;s.user.google_calendar_routes={str(s.a.id):{'calendar_id':'missing'}}
    appt,row=queued(s)
    s.network.return_value=response(404)
    calendar.run_once(s.db)
    assert row.status=='failed'
    assert all('/primary/' not in c.args[1] for c in s.network.call_args_list)


def test_non_owner_cannot_include_workers_or_foreign_clinics(setup):
    s=setup
    for body in [{'clinic_id':s.b.id,'all_workers':True},{'clinic_id':s.a.id},{'clinic_id':s.c.id}]:
        assert s.http.put('/google/calendar/routing',json=body).status_code==403
    assert not s.http.get('/google/calendar/routing').json()['can_include_workers']


def test_owner_cannot_subscribe_to_foreign_company_worker(setup):
    s=setup;s.user.role_level=4;s.db.commit()
    outsider=User(company_id=s.c.company_id,clinic_id=s.c.id,username='foreign-worker');s.db.add(outsider);s.db.commit()
    assert s.http.put('/google/calendar/routing',json={'clinic_id':s.a.id,'workers':[outsider.id]}).status_code==403


def test_writable_calendar_listing_is_paginated(setup):
    s=setup
    s.network.side_effect=[response(200,{'items':[{'id':'a','summary':'A','accessRole':'owner'}],'nextPageToken':'next'}),response(200,{'items':[{'id':'b','summary':'B','accessRole':'writer'},{'id':'no','accessRole':'reader'}]})]
    result=s.http.get('/google/calendar/calendars')
    assert [v['id'] for v in result.json()]==['a','b']
    assert s.network.call_args.kwargs['params']['pageToken']=='next'


def test_uncertain_calendar_creation_cannot_be_blindly_retried(setup):
    s=setup;s.network.side_effect=requests.Timeout()
    assert s.http.post('/google/calendar/calendars',json={'clinic_id':s.b.id}).status_code==502
    assert s.http.post('/google/calendar/calendars',json={'clinic_id':s.b.id}).status_code==409
    assert s.network.call_count==1


def test_create_calendar_and_route_without_changing_default_other_clinics(setup):
    s=setup;s.network.return_value=response(200,{'id':'created-calendar'})
    r=s.http.post('/google/calendar/calendars',json={'clinic_id':s.b.id})
    assert r.status_code==200,r.text
    assert s.user.google_calendar_routes[str(s.b.id)]['calendar_id']=='created-calendar'
    assert calendar.route_for(s.user,s.a.id)=={}


def test_manual_sync_does_not_force_another_receivers_paused_settings(setup):
    s=setup;manager=owner(s);manager.google_calendar_sync_enabled=False
    appointment(s);s.db.commit()
    assert s.http.post('/google/calendar/sync').status_code==200
    assert s.db.query(GoogleCalendarSync).filter_by(user_id=manager.id).count()==0
