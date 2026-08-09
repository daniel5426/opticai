from dataclasses import asdict, dataclass
from typing import Optional

from config import settings


@dataclass(frozen=True)
class PlanDefinition:
    code: str
    display_name: str
    amount_minor: Optional[int]
    currency: str
    clinic_limit: Optional[int]
    staff_limit: Optional[int]
    trial_days: int
    onboarding: str
    support: str
    self_service: bool
    stripe_price_id: Optional[str] = None

    def public_dict(self) -> dict:
        value = asdict(self)
        value.pop("stripe_price_id")
        return value


def plan_catalog() -> dict[str, PlanDefinition]:
    return {
        "essential": PlanDefinition(
            "essential", "Essential", 43_000, "ils", 1, 5, 30,
            "Self-service onboarding", "Standard support and configuration", True,
            settings.STRIPE_ESSENTIAL_PRICE_ID or None,
        ),
        "growth": PlanDefinition(
            "growth", "Growth", 99_900, "ils", 3, 15, 30,
            "Priority onboarding", "Priority support and setup assistance", True,
            settings.STRIPE_GROWTH_PRICE_ID or None,
        ),
        "network": PlanDefinition(
            "network", "Network", 189_000, "ils", 6, 35, 30,
            "Guided multi-clinic rollout", "Tailored configuration", True,
            settings.STRIPE_NETWORK_PRICE_ID or None,
        ),
        "enterprise": PlanDefinition(
            "enterprise", "Enterprise", None, "ils", None, None, 0,
            "Bespoke onboarding", "Contracted support", False, None,
        ),
    }


def require_plan(code: str, *, self_service: bool = False) -> PlanDefinition:
    plan = plan_catalog().get((code or "").strip().lower())
    if not plan or (self_service and not plan.self_service):
        raise ValueError("Unknown plan")
    return plan
