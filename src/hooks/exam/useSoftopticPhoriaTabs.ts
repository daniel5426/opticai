import { useRefractionTabs } from "./useRefractionTabs";

interface UseSoftopticPhoriaTabsParams {
  cardRows: Parameters<typeof useRefractionTabs>[0]["cardRows"];
  examFormData: Record<string, any>;
  setExamFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeInstanceId: number | null;
  loading: boolean;
}

export function useSoftopticPhoriaTabs(params: UseSoftopticPhoriaTabsParams) {
  const cover = useRefractionTabs({
    ...params,
    componentType: "softoptic-cover-test",
    bootstrapEmptyTab: false,
  });
  const maddox = useRefractionTabs({
    ...params,
    componentType: "softoptic-maddox-grid",
    bootstrapEmptyTab: false,
  });

  return {
    computedSoftopticCoverTestTabs: cover.computedTabs,
    activeSoftopticCoverTestTabs: cover.activeTabs,
    setActiveSoftopticCoverTestTabs: cover.setActiveTabs,
    addSoftopticCoverTestTab: cover.addTab,
    removeSoftopticCoverTestTab: cover.removeTab,
    duplicateSoftopticCoverTestTab: cover.duplicateTab,
    updateSoftopticCoverTestTabType: cover.updateTabType,
    computedSoftopticMaddoxGridTabs: maddox.computedTabs,
    activeSoftopticMaddoxGridTabs: maddox.activeTabs,
    setActiveSoftopticMaddoxGridTabs: maddox.setActiveTabs,
    addSoftopticMaddoxGridTab: maddox.addTab,
    removeSoftopticMaddoxGridTab: maddox.removeTab,
    duplicateSoftopticMaddoxGridTab: maddox.duplicateTab,
    updateSoftopticMaddoxGridTabType: maddox.updateTabType,
  };
}
