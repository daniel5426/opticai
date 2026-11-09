"""Application-owned scanner transport; no direct client database access."""
from sqlalchemy import Column, String, Integer, Float, JSON, ForeignKey, UniqueConstraint, Index
from database import Base

class ScannerDevice(Base):
    __tablename__ = 'scanner_devices'
    id = Column(String(64), primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    secret_hash = Column(String(64), nullable=False)
    lease = Column(String(64))
    session_id = Column(String, ForeignKey('auth_sessions.id', ondelete='SET NULL'))
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    context = Column(String(64))
    destination = Column(String(32), default='details')
    seen_at = Column(Float, nullable=False, default=0)
    phone_id = Column(String(64))
    phone_seen_at = Column(Float, nullable=False, default=0)

class ScannerPhone(Base):
    __tablename__ = 'scanner_phones'
    id = Column(String(64), primary_key=True)
    secret_hash = Column(String(64), nullable=False, unique=True)
    seen_at = Column(Float, nullable=False)

class ScannerGrant(Base):
    __tablename__ = 'scanner_grants'
    phone_id = Column(String(64), ForeignKey('scanner_phones.id', ondelete='CASCADE'), primary_key=True)
    device_id = Column(String(64), ForeignKey('scanner_devices.id', ondelete='CASCADE'), primary_key=True)

class ScannerPairing(Base):
    __tablename__ = 'scanner_pairings'
    id = Column(String(64), primary_key=True)
    device_id = Column(String(64), ForeignKey('scanner_devices.id', ondelete='CASCADE'), nullable=False)
    secret_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(Float, nullable=False)

class ScannerAttempt(Base):
    __tablename__ = 'scanner_attempts'
    id = Column(String(64), primary_key=True)
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(Float, nullable=False)

class ScannerScan(Base):
    __tablename__ = 'scanner_scans'
    __table_args__ = (UniqueConstraint('device_id', 'request_id', name='uq_scanner_request'), Index('ix_scanner_history', 'clinic_id', 'created_at'))
    id = Column(String(64), primary_key=True)
    device_id = Column(String(64), ForeignKey('scanner_devices.id'), nullable=False)
    request_id = Column(String(64), nullable=False)
    company_id = Column(Integer, nullable=False)
    clinic_id = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False)
    phone_id = Column(String(64))
    lease = Column(String(64), nullable=False)
    context = Column(String(64), nullable=False)
    barcode = Column(String(256), nullable=False)
    variant_id = Column(Integer)
    source = Column(String(16), nullable=False)
    status = Column(String(32), nullable=False, default='pending')
    created_at = Column(Float, nullable=False)
    summary = Column(JSON, nullable=False, default=dict)

class ScannerEvent(Base):
    __tablename__ = 'scanner_events'
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(64), nullable=False, index=True)
    phone_id = Column(String(64), index=True)
    created_at = Column(Float, nullable=False)
    payload = Column(JSON, nullable=False)
