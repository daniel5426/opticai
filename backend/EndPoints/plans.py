from fastapi import APIRouter

from services.plan_catalog import plan_catalog


router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("")
def get_plans():
    return {
        "plans": [plan.public_dict() for plan in plan_catalog().values()],
        "pricing_notice": "Indicative launch pricing; final price confirmed at checkout.",
    }
