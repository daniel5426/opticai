from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker, with_loader_criteria
from sqlalchemy.pool import NullPool, QueuePool
from fastapi import HTTPException
from config import settings

database_url = settings.DATABASE_URL
parsed_url = make_url(database_url)


def _uses_supabase_transaction_pooler() -> bool:
    return (
        parsed_url.get_backend_name() != "sqlite"
        and parsed_url.host is not None
        and parsed_url.host.endswith(".pooler.supabase.com")
        and parsed_url.port == 6543
    )

if parsed_url.get_backend_name() == "sqlite":
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )
elif _uses_supabase_transaction_pooler():
    engine = create_engine(
        database_url,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args={
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000"
        }
    )
else:
    engine = create_engine(
        database_url,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_timeout=3,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000"
        }
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@event.listens_for(Session, "do_orm_execute")
def _hide_soft_deleted_rows(execute_state):
    if (
        not execute_state.is_select
        or execute_state.execution_options.get("include_deleted")
        or execute_state.session.info.get("include_deleted")
    ):
        return
    # Import lazily to avoid the database/models import cycle during startup.
    from models import ExamLayoutInstance, OpticalExam, Referral, ReferralEye, SoftDeletableMixin

    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            SoftDeletableMixin,
            lambda model: model.deleted_at.is_(None),
            include_aliases=True,
        ),
        with_loader_criteria(
            ExamLayoutInstance,
            lambda instance: instance.exam_id.in_(
                select(OpticalExam.id).where(OpticalExam.deleted_at.is_(None))
            ),
            include_aliases=True,
        ),
        with_loader_criteria(
            ReferralEye,
            lambda eye: eye.referral_id.in_(
                select(Referral.id).where(Referral.deleted_at.is_(None))
            ),
            include_aliases=True,
        ),
    )

def get_db():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        yield db
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        print(f"Database connection error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
