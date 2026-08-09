import { useRefractionTabs } from "./useRefractionTabs";

interface UseOldRefractionTabsParams {
  cardRows: Parameters<typeof useRefractionTabs>[0]["cardRows"];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export function useOldRefractionTabs(params: UseOldRefractionTabsParams) {
  const regular = useRefractionTabs({
    ...params,
    componentType: "old-refraction",
  });
  const extension = useRefractionTabs({
    ...params,
    componentType: "old-refraction-extension",
  });

  return {
    computedOldRefractionTabs: regular.computedTabs,
    activeOldRefractionTabs: regular.activeTabs,
    setActiveOldRefractionTabs: regular.setActiveTabs,
    addOldRefractionTab: regular.addTab,
    removeOldRefractionTab: regular.removeTab,
    duplicateOldRefractionTab: regular.duplicateTab,
    updateOldRefractionTabType: regular.updateTabType,
    computedOldRefractionExtensionTabs: extension.computedTabs,
    activeOldRefractionExtensionTabs: extension.activeTabs,
    setActiveOldRefractionExtensionTabs: extension.setActiveTabs,
    addOldRefractionExtensionTab: extension.addTab,
    removeOldRefractionExtensionTab: extension.removeTab,
    duplicateOldRefractionExtensionTab: extension.duplicateTab,
    updateOldRefractionExtensionTabType: extension.updateTabType,
  };
}
