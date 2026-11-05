import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LayoutEditorHelp() {
  const { t, i18n } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={t("examPreview.editorHelpLabel")}>
          <CircleAlert className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent dir={i18n.dir()} className="w-80 max-w-[calc(100vw-2rem)] text-start text-sm leading-relaxed">
        {t("examPreview.editorHelp")}
      </PopoverContent>
    </Popover>
  );
}
