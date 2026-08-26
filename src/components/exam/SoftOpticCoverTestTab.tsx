import { SoftOpticCoverTestExam } from "@/lib/db/schema-interface";
import { useTranslation } from "react-i18next";
import {
  SoftOpticPhoriaGrid,
  SoftOpticPhoriaGridLayout,
} from "./shared/SoftOpticPhoriaGrid";

interface SoftOpticCoverTestTabProps {
  coverTestData: SoftOpticCoverTestExam;
  onCoverTestChange: (field: keyof SoftOpticCoverTestExam, value: string) => void;
  isEditing: boolean;
}

export function SoftOpticCoverTestTab({
  coverTestData,
  onCoverTestChange,
  isEditing,
}: SoftOpticCoverTestTabProps) {
  const { t } = useTranslation();

  return (
    <SoftOpticPhoriaGrid
      title={t("softopticCoverTest")}
      data={coverTestData as Record<string, string | number | undefined>}
      rows={SoftOpticPhoriaGridLayout.coverTestRows()}
      isEditing={isEditing}
      onChange={(field, value) =>
        onCoverTestChange(field as keyof SoftOpticCoverTestExam, value)
      }
    />
  );
}
