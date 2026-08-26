import { SoftOpticMaddoxGridExam } from "@/lib/db/schema-interface";
import { useTranslation } from "react-i18next";
import {
  SoftOpticPhoriaGrid,
  SoftOpticPhoriaGridLayout,
} from "./shared/SoftOpticPhoriaGrid";

interface SoftOpticMaddoxGridTabProps {
  maddoxGridData: SoftOpticMaddoxGridExam;
  onMaddoxGridChange: (field: keyof SoftOpticMaddoxGridExam, value: string) => void;
  isEditing: boolean;
}

export function SoftOpticMaddoxGridTab({
  maddoxGridData,
  onMaddoxGridChange,
  isEditing,
}: SoftOpticMaddoxGridTabProps) {
  const { t } = useTranslation();

  return (
    <SoftOpticPhoriaGrid
      title={t("softopticMaddoxGrid")}
      data={maddoxGridData as Record<string, string | number | undefined>}
      rows={SoftOpticPhoriaGridLayout.maddoxGridRows()}
      isEditing={isEditing}
      onChange={(field, value) =>
        onMaddoxGridChange(field as keyof SoftOpticMaddoxGridExam, value)
      }
    />
  );
}
