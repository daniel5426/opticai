import type { ComponentProps, ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function NewExamLayoutMenuContent({ children, ...props }: ComponentProps<typeof DropdownMenuContent> & { children: ReactNode }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  return (
    <DropdownMenuContent {...props} dir={i18n.dir()} className="flex max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] flex-col overflow-hidden">
      <div className="min-h-0 overflow-y-auto">{children}</div>
      <div className="shrink-0">
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/exam-layouts/new" })}>
          <Plus className="h-4 w-4" />
          {t("examPreview.newLayout")}
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  );
}
