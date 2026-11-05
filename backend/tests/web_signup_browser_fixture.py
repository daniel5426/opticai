"""Loopback-only browser-test factory. Never import from the application entrypoint."""
from datetime import datetime, timedelta
import html
import re
from urllib.parse import parse_qs, urlparse
from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import auth
from config import settings
from database import Base, get_db
from EndPoints import web_auth


class Advance(BaseModel):
    seconds: int


def create_app():
    if settings.DATABASE_URL != 'sqlite:///:memory:':
        raise RuntimeError('Browser fixture requires its own in-memory SQLite database')
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    mail = []
    clock = {'seconds': 0}
    web_auth.utcnow = lambda: datetime.utcnow() + timedelta(seconds=clock['seconds'])
    auth.utcnow = web_auth.utcnow
    web_auth.send_email = lambda **kwargs: mail.append(kwargs) or True
    app = FastAPI()
    app.include_router(web_auth.router, prefix='/api/v1')

    def fixture_db():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = fixture_db

    @app.post('/__test/clock')
    def advance(payload: Advance):
        clock['seconds'] = payload.seconds
        return {'seconds': clock['seconds']}

    @app.get('/__test/mail')
    def latest_mail():
        latest = mail[-1]
        code = re.search(r'>([0-9]{6})</p>', latest['html'])
        link = re.search(r'href="([^"]+)"', latest['html'])
        return {
            'count': len(mail), 'to': latest['to'], 'code': code.group(1) if code else None,
            'link_token': parse_qs(urlparse(html.unescape(link.group(1))).query)['token'][0] if link else None,
        }
    return app
