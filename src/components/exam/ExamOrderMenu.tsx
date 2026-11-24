import React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORDER_GLASSES_TYPES, ORDER_GLASSES_TYPE_LABELS, type OrderGlassesType } from "@/lib/addition-add-sources";
import { useAppLocale } from "@/localization/use-app-locale";

interface ExamOrderMenuProps {
  /** The glasses types the exam's Addition card has a value for. */
  additionTypes: readonly OrderGlassesType[];
  onGlassesOrder: (type: OrderGlassesType) => void;
  onEmptyGlassesOrder: () => void;
  onContactLensOrder: () => void;
}

/** Opens an order from an exam: every glasses type, with the ones in its Addition card marked. */
export function ExamOrderMenu({ additionTypes, onGlassesOrder, onEmptyGlassesOrder, onContactLensOrder }: ExamOrderMenuProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t("examOrder")} title={t("examOrder")}>
          <ShoppingCart size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger hideIcon>{t("examRegularOrder")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onEmptyGlassesOrder}>{t("orderGroupEmptyOrder")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {ORDER_GLASSES_TYPES.map((type) => {
              const inAddition = additionTypes.includes(type);
              return (
                <DropdownMenuItem
                  key={type}
                  data-in-addition={inAddition || undefined}
                  className={inAddition ? "bg-primary/10 font-medium" : undefined}
                  onClick={() => onGlassesOrder(type)}
                >
                  {ORDER_GLASSES_TYPE_LABELS[type]}
                  {inAddition && <Check className="text-primary ms-auto" aria-label="ADD" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onContactLensOrder}>{t("examContactLenses")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
