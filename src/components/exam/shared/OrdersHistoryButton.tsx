import React from "react";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Opens the client's orders, to fill the card from one; shown beside the card's title. */
export function OrdersHistoryButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("ordersHistoryButton")}
      aria-label={t("ordersHistoryButton")}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-orange-600 hover:bg-orange-100 hover:text-orange-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <History className="size-3.5" />
    </button>
  );
}
