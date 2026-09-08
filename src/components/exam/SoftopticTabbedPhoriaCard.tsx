import React from "react";
import {
  SoftOpticCoverTestExam,
  SoftOpticMaddoxGridExam,
} from "@/lib/db/schema-interface";
import {
  getTabsForCard,
  resolveOldRefractionGlassesType,
} from "@/lib/exam-ui-metadata";
import { useTranslation } from "react-i18next";
import { SoftOpticCoverTestTab } from "./SoftOpticCoverTestTab";
import { SoftOpticMaddoxGridTab } from "./SoftOpticMaddoxGridTab";
import { RefractionTabsHeader } from "./shared/RefractionTabsHeader";
import {
  SoftOpticPhoriaGrid,
  SoftOpticPhoriaGridLayout,
} from "./shared/SoftOpticPhoriaGrid";

type SoftopticPhoriaVariant = "cover" | "maddox";

interface SoftopticPhoriaDetailProps {
  examFormData?: Record<string, unknown>;
  fieldHandlers?: Record<string, (field: string, value: string) => void>;
  setExamFormData?: React.Dispatch<
    React.SetStateAction<Record<string, unknown>>
  >;
  layoutInstanceId?: number;
  softopticCoverTestTabs?: Record<string, string[]>;
  activeSoftopticCoverTestTabs?: Record<string, string>;
  setActiveSoftopticCoverTestTabs?: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  addSoftopticCoverTestTab?: (cardId: string, type: string) => void;
  removeSoftopticCoverTestTab?: (cardId: string, tabIdx: number) => void;
  duplicateSoftopticCoverTestTab?: (cardId: string, tabIdx: number) => void;
  updateSoftopticCoverTestTabType?: (
    cardId: string,
    tabIdx: number,
    newType: string,
  ) => void;
  softopticMaddoxGridTabs?: Record<string, string[]>;
  activeSoftopticMaddoxGridTabs?: Record<string, string>;
  setActiveSoftopticMaddoxGridTabs?: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  addSoftopticMaddoxGridTab?: (cardId: string, type: string) => void;
  removeSoftopticMaddoxGridTab?: (cardId: string, tabIdx: number) => void;
  duplicateSoftopticMaddoxGridTab?: (cardId: string, tabIdx: number) => void;
  updateSoftopticMaddoxGridTabType?: (
    cardId: string,
    tabIdx: number,
    newType: string,
  ) => void;
}

interface SoftopticTabbedPhoriaCardProps {
  variant: SoftopticPhoriaVariant;
  item: { id: string };
  toolbox: React.ReactNode;
  isEditing: boolean;
  detailProps?: SoftopticPhoriaDetailProps;
}

const emptyCover: SoftOpticCoverTestExam = { layout_instance_id: 0 };
const emptyMaddox: SoftOpticMaddoxGridExam = { layout_instance_id: 0 };

export function SoftopticTabbedPhoriaCard({
  variant,
  item,
  toolbox,
  isEditing,
  detailProps,
}: SoftopticTabbedPhoriaCardProps) {
  const { t } = useTranslation();
  const type =
    variant === "cover" ? "softoptic-cover-test" : "softoptic-maddox-grid";
  const examFormData = (detailProps?.examFormData || {}) as Record<string, any>;
  const hookTabs =
    variant === "cover"
      ? detailProps?.softopticCoverTestTabs?.[item.id]
      : detailProps?.softopticMaddoxGridTabs?.[item.id];
  const tabs =
    hookTabs && hookTabs.length > 0
      ? hookTabs
      : getTabsForCard(examFormData, type, item.id).map((tab) => tab.id);
  const activeMap =
    variant === "cover"
      ? detailProps?.activeSoftopticCoverTestTabs
      : detailProps?.activeSoftopticMaddoxGridTabs;
  const setActiveMap =
    variant === "cover"
      ? detailProps?.setActiveSoftopticCoverTestTabs
      : detailProps?.setActiveSoftopticMaddoxGridTabs;
  const addTab =
    variant === "cover"
      ? detailProps?.addSoftopticCoverTestTab
      : detailProps?.addSoftopticMaddoxGridTab;
  const removeTab =
    variant === "cover"
      ? detailProps?.removeSoftopticCoverTestTab
      : detailProps?.removeSoftopticMaddoxGridTab;
  const duplicateTab =
    variant === "cover"
      ? detailProps?.duplicateSoftopticCoverTestTab
      : detailProps?.duplicateSoftopticMaddoxGridTab;
  const updateType =
    variant === "cover"
      ? detailProps?.updateSoftopticCoverTestTabType
      : detailProps?.updateSoftopticMaddoxGridTabType;

  if (tabs.length === 0) {
    const key = `${type}-${item.id}`;
    const data = examFormData[key] || examFormData[type];
    const handler = (field: string, value: string) => {
      const bound = detailProps?.fieldHandlers?.[key];
      if (bound) {
        bound(field, value);
        return;
      }
      detailProps?.setExamFormData?.((prev) => {
        const prevTab = (prev?.[key] as Record<string, unknown>) || {};
        return {
          ...prev,
          [key]: {
            ...prevTab,
            card_instance_id: item.id,
            card_id: item.id,
            layout_instance_id:
              prevTab.layout_instance_id ?? detailProps?.layoutInstanceId,
            [field]: value,
          },
        };
      });
    };

    return (
      <div className="relative">
        {toolbox}
        {variant === "cover" ? (
          <SoftOpticCoverTestTab
            coverTestData={(data as SoftOpticCoverTestExam) || emptyCover}
            onCoverTestChange={handler}
            isEditing={isEditing}
          />
        ) : (
          <SoftOpticMaddoxGridTab
            maddoxGridData={(data as SoftOpticMaddoxGridExam) || emptyMaddox}
            onMaddoxGridChange={handler}
            isEditing={isEditing}
          />
        )}
      </div>
    );
  }

  const requestedActiveId = activeMap?.[item.id];
  const activeTabId =
    requestedActiveId && tabs.includes(requestedActiveId)
      ? requestedActiveId
      : tabs[0];
  const activeTabIndex = Math.max(0, tabs.indexOf(activeTabId));
  const activeKey = `${type}-${item.id}-${activeTabId}`;
  const allTabsData = tabs.map((tabId) => {
    const key = `${type}-${item.id}-${tabId}`;
    return (
      examFormData[key] || {
        layout_instance_id: detailProps?.layoutInstanceId ?? 0,
      }
    );
  });
  const activeData =
    examFormData[activeKey] ||
    allTabsData[activeTabIndex] ||
    (variant === "cover" ? emptyCover : emptyMaddox);

  const setActiveTab = (index: number) => {
    const nextId = tabs[index];
    if (!nextId || !setActiveMap) return;
    setActiveMap((current) => ({ ...current, [item.id]: nextId }));
  };

  const onChange = (field: string, value: string) => {
    const handler = detailProps?.fieldHandlers?.[activeKey];
    if (handler) {
      handler(field, value);
      return;
    }
    detailProps?.setExamFormData?.((prev) => {
      const prevTab = (prev?.[activeKey] as Record<string, unknown>) || {};
      return {
        ...prev,
        [activeKey]: {
          ...prevTab,
          card_instance_id: activeTabId,
          card_id: item.id,
          tab_index: activeTabIndex,
          layout_instance_id:
            prevTab.layout_instance_id ?? detailProps?.layoutInstanceId,
          [field]: value,
        },
      };
    });
  };

  return (
    <div className="relative">
      {toolbox}
      <SoftOpticPhoriaGrid
        header={
          <RefractionTabsHeader
            title={
              variant === "cover"
                ? t("softopticCoverTest")
                : t("softopticMaddoxGrid")
            }
            tabCount={tabs.length}
            activeTab={activeTabIndex}
            tabTypes={allTabsData.map((tab) =>
              resolveOldRefractionGlassesType(tab),
            )}
            isEditing={isEditing}
            onTabChange={setActiveTab}
            onAddTab={(glassesType) => addTab?.(item.id, glassesType)}
            onDeleteTab={(index) => removeTab?.(item.id, index)}
            onDuplicateTab={(index) => duplicateTab?.(item.id, index)}
            onUpdateType={(index, glassesType) =>
              updateType?.(item.id, index, glassesType)
            }
          />
        }
        data={activeData as Record<string, string | number | undefined>}
        rows={
          variant === "cover"
            ? SoftOpticPhoriaGridLayout.coverTestRows()
            : SoftOpticPhoriaGridLayout.maddoxGridRows()
        }
        isEditing={isEditing}
        onChange={onChange}
      />
    </div>
  );
}
