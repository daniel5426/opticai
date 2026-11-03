"""Platform ownership is independent of tenant roles and editable email addresses."""
from fastapi import Depends, HTTPException
from auth import get_current_user
from config import settings
from models import User


def owner_ids() -> set[int]:
    values = settings.OWNER_USER_IDS.split(",")
    if any(value.strip() and not value.strip().isdigit() for value in values):
        return set()  # Invalid configuration fails closed.
    return {int(value.strip()) for value in values if value.strip()}


def is_owner(user: User) -> bool:
    return bool(user.is_active and user.id in owner_ids())


def require_owner(user: User = Depends(get_current_user)) -> User:
    if not is_owner(user):
        raise HTTPException(403, detail={"code": "owner_required"})
    return user
