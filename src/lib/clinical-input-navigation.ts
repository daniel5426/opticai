export const CLINICAL_NAV_SCOPE_ATTR = "data-clinical-nav-scope";
export const CLINICAL_NAV_ITEM_ATTR = "data-clinical-nav-item";
export const CLINICAL_NAV_KIND_ATTR = "data-clinical-nav-kind";
export const CLINICAL_NAV_CARD_ATTR = "data-clinical-nav-card";

const ITEM_SELECTOR = `[${CLINICAL_NAV_ITEM_ATTR}="true"]`;
const CARD_SELECTOR = `[${CLINICAL_NAV_CARD_ATTR}="true"]`;

type NavigationDirection = "next" | "previous";

function getScope(element: Element | null) {
  return element?.closest(`[${CLINICAL_NAV_SCOPE_ATTR}="true"]`) ?? null;
}

function isEnabledNavItem(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  return element.offsetParent !== null;
}

function getOrderedItems(scope: Element) {
  const items = Array.from(scope.querySelectorAll(ITEM_SELECTOR)).filter(
    isEnabledNavItem,
  );
  const cards = Array.from(
    new Set(
      items.map((item) => item.closest(CARD_SELECTOR) ?? item),
    ),
  ).sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const sameRow = Math.abs(aRect.top - bRect.top) < 8;
    if (!sameRow) return aRect.top - bRect.top;
    return aRect.left - bRect.left;
  });
  const cardOrder = new Map(cards.map((card, index) => [card, index]));

  return items.sort((a, b) => {
      const aCard = a.closest(CARD_SELECTOR) ?? a;
      const bCard = b.closest(CARD_SELECTOR) ?? b;
      const cardDelta =
        (cardOrder.get(aCard) ?? 0) - (cardOrder.get(bCard) ?? 0);
      if (cardDelta !== 0) return cardDelta;

      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const sameRow = Math.abs(aRect.top - bRect.top) < 8;
      if (!sameRow) return aRect.top - bRect.top;
      return aRect.left - bRect.left;
    });
}

export function isInClinicalNavScope(element: Element | null) {
  return Boolean(getScope(element));
}

export function focusClinicalNavSibling(
  current: Element | null,
  direction: NavigationDirection,
) {
  const scope = getScope(current);
  if (!scope || !(current instanceof HTMLElement)) return false;

  const items = getOrderedItems(scope);
  const currentIndex = items.findIndex((item) => item === current);
  if (currentIndex < 0) return false;

  const nextIndex =
    direction === "next" ? currentIndex + 1 : currentIndex - 1;
  const target = items[nextIndex];
  if (!target) return false;

  target.focus();
  if (target instanceof HTMLInputElement && target.value) {
    requestAnimationFrame(() => target.select());
  }
  return true;
}

export function isClinicalPrintableKey(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">) {
  return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
}

function getStepPrecision(input: HTMLInputElement) {
  const step = input.step || input.dataset.clinicalNavStep || "";
  if (!step || step === "any") return 0;
  const decimalPart = step.split(".")[1];
  return decimalPart?.length ?? 0;
}

function getIntegerDigitCount(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  const bounds = [min, max].filter(Number.isFinite).map(Math.abs);
  const largest = bounds.length ? Math.max(...bounds) : 99;
  return Math.max(1, Math.floor(largest).toString().length);
}

export function normalizeClinicalNumberInput(input: HTMLInputElement) {
  if (!isInClinicalNavScope(input)) {
    return { value: input.value, shouldAdvance: false };
  }
  if (input.dataset.clinicalNavKind !== "number") {
    return { value: input.value, shouldAdvance: false };
  }

  const precision = getStepPrecision(input);
  const rawValue = input.value;
  const sign = rawValue.match(/^[+-]/)?.[0] ?? "";
  const unsigned = sign ? rawValue.slice(1) : rawValue;
  const integerDigits = getIntegerDigitCount(input);

  if (precision > 0 && !unsigned.includes(".")) {
    const digits = unsigned.replace(/\D/g, "");
    if (digits.length >= integerDigits) {
      const integerPart = digits.slice(0, integerDigits);
      const decimalPart = digits.slice(integerDigits, integerDigits + precision);
      const nextValue = `${sign}${integerPart}.${decimalPart}`;
      input.value = nextValue;
      input.setSelectionRange(nextValue.length, nextValue.length);
      return {
        value: nextValue,
        shouldAdvance: decimalPart.length >= precision,
      };
    }
    return { value: input.value, shouldAdvance: false };
  }

  if (precision > 0) {
    const integerPart = unsigned.split(".")[0] ?? "";
    const decimalPart = unsigned.split(".")[1] ?? "";
    return {
      value: input.value,
      shouldAdvance:
        integerPart.replace(/\D/g, "").length > 0 &&
        decimalPart.length >= precision,
    };
  }

  const digits = unsigned.replace(/\D/g, "");
  return {
    value: input.value,
    shouldAdvance: digits.length >= integerDigits,
  };
}
