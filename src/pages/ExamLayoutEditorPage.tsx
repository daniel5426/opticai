import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExamCardRenderer,
  CardItem,
  hasNoteCard,
} from "@/components/exam/ExamCardRenderer";
import {
  getExamLayoutById,
  createExamLayout,
  updateExamLayout,
} from "@/lib/db/exam-layouts-db";
import { examComponentRegistry } from "@/lib/exam-component-registry";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import {
  EXAM_LAYOUT_GRID_COLUMNS,
  GridLayoutItem,
  canPlaceGridItem,
  clampResizeWidth,
  clampResizeLeft,
  computeCardGridCols,
  computeCardMinGridCols,
  findNearestAvailableGridPlacement,
  normalizeGridItem,
  parseLayoutData,
  serializeGridLayoutData,
  sortGridItems,
} from "@/pages/exam-detail/utils";
import { EXAM_LAYOUT_LANE_MIN_HEIGHT_PX } from "@/components/exam/ExamGridLayout";

type InteractionState =
  | {
      type: "drag";
      id: string;
      originalItem: GridLayoutItem;
      offsetCols: number;
    }
  | {
      type: "resize";
      id: string;
      originalItem: GridLayoutItem;
      startX: number;
      startW: number;
      edge: "left" | "right";
    };

const INTERACTIVE_CARD_SELECTOR =
  "button,a,[role='button'],[contenteditable='true'],[data-resize-handle]";
const EDGE_SCROLL_ZONE_PX = 96;
const EDGE_SCROLL_STEP_PX = 18;

interface AddComponentDrawerProps {
  selectedType: CardItem["type"] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectComponent: (componentType: CardItem["type"]) => void;
}

function AddComponentDrawer({
  selectedType,
  open,
  onOpenChange,
  onSelectComponent,
}: AddComponentDrawerProps) {
  const registeredComponents = examComponentRegistry
    .getLayoutEditorTypes()
    .map((type) => {
      const config = examComponentRegistry.getConfig(type);
      return {
        id: type,
        label: type
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        description: config?.name || type,
      };
    });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant={selectedType ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {selectedType ? "רכיב נבחר" : "הוסף רכיב"}
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="max-h-[60vh]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DrawerHeader>
          <DrawerTitle className="text-center">בחר רכיב להוספה</DrawerTitle>
        </DrawerHeader>
        <div
          className="grid grid-cols-2 gap-4 overflow-y-auto p-4 md:grid-cols-3 lg:grid-cols-4"
          style={{ scrollbarWidth: "none" }}
        >
          {registeredComponents.map((component) => (
            <Button
              key={component.id}
              variant={selectedType === component.id ? "default" : "outline"}
              className="h-auto flex-col items-center justify-center p-4 text-center"
              onClick={() => {
                onSelectComponent(component.id as CardItem["type"]);
              }}
            >
              <span className="mb-1 text-lg font-semibold">
                {component.description}
              </span>
              <span className="text-muted-foreground text-sm">
                {component.label}
              </span>
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function ExamLayoutEditorPage() {
  const navigate = useNavigate();
  const { currentClinic } = useUser();

  let params: { layoutId?: string } = {};
  let search: { name?: string } = {};

  try {
    const routeParams = useParams({ strict: false });
    if ("layoutId" in routeParams) {
      params = routeParams as { layoutId: string };
    }
  } catch {
    params = {};
  }

  try {
    search = useSearch({ strict: false }) as { name?: string };
  } catch {
    search = {};
  }

  const isNewMode = !params.layoutId || params.layoutId === "new";
  const [loading, setLoading] = useState(!isNewMode);
  const [layoutName, setLayoutName] = useState(
    isNewMode ? search.name || "פריסה חדשה" : "",
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [layoutType, setLayoutType] = useState<string>("global");
  const [layoutClinicId, setLayoutClinicId] = useState<number | null>(
    currentClinic?.id ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<CardItem["type"] | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<{
    lane: number;
    x: number;
  } | null>(null);
  const [items, setItems] = useState<GridLayoutItem[]>([]);
  const [invalidItemId, setInvalidItemId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(
    null,
  );
  const isSavingRef = useRef(false);
  const itemsRef = useRef<GridLayoutItem[]>([]);
  const laneRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const interactionRef = useRef<InteractionState | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const suppressNextRowClickRef = useRef(false);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (isNewMode) {
      setLayoutClinicId(currentClinic?.id ?? null);
    }
  }, [isNewMode, currentClinic?.id]);

  useEffect(() => {
    const loadLayout = async () => {
      if (isNewMode || !params.layoutId) return;

      try {
        setLoading(true);
        const layout = await getExamLayoutById(Number(params.layoutId));
        if (layout) {
          setLayoutName(layout.name);
          setIsDefault(layout.is_default ?? false);
          setLayoutType(layout.type || "global");
          setLayoutClinicId(layout.clinic_id ?? null);
          const parsed = parseLayoutData(layout.layout_data || "[]");
          setItems(parsed.items);
        }
      } catch (error) {
        console.error("Error loading layout:", error);
        toast.error("שגיאה בטעינת הפריסה");
      } finally {
        setLoading(false);
      }
    };

    loadLayout();
  }, [params.layoutId, isNewMode]);

  const lanes = useMemo(() => {
    const maxLane = items.reduce((max, item) => Math.max(max, item.y), 0);
    return Array.from({ length: maxLane + 2 }, (_, index) => index);
  }, [items]);

  const groupedItems = useMemo(() => {
    const map = new Map<number, GridLayoutItem[]>();
    sortGridItems(items).forEach((item) => {
      const laneItems = map.get(item.y) || [];
      laneItems.push(item);
      map.set(item.y, laneItems);
    });
    return map;
  }, [items]);

  const getLaneFromPointer = useCallback((clientY: number) => {
    const entries = Object.entries(laneRefs.current)
      .map(([lane, el]) => ({ lane: Number(lane), el }))
      .filter((entry): entry is { lane: number; el: HTMLDivElement } =>
        Boolean(entry.el),
      )
      .sort((a, b) => a.lane - b.lane);

    for (const entry of entries) {
      const rect = entry.el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return entry.lane;
    }

    const first = entries[0];
    const last = entries[entries.length - 1];
    if (!first || !last) return 0;
    if (clientY < first.el.getBoundingClientRect().top) return first.lane;
    return last.lane;
  }, []);

  const getColumnFromPointer = useCallback(
    (lane: number, clientX: number, offsetCols = 0) => {
      const laneEl = laneRefs.current[lane];
      if (!laneEl) return 0;
      const rect = laneEl.getBoundingClientRect();
      const colWidth = rect.width / EXAM_LAYOUT_GRID_COLUMNS;
      return Math.round((clientX - rect.left) / colWidth - offsetCols);
    },
    [],
  );

  const getComponentLabel = useCallback((componentType: CardItem["type"]) => {
    const config = examComponentRegistry.getConfig(componentType);
    return config?.name || componentType;
  }, []);

  const findBlockingDuplicate = useCallback(
    (componentType: CardItem["type"]) => {
      if (componentType === "cover-test" || componentType === "notes")
        return null;
      return (
        itemsRef.current.find((item) => item.type === componentType) || null
      );
    },
    [],
  );

  const highlightItemTemporarily = useCallback((id: string) => {
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedItemId(id);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedItemId(null);
      highlightTimeoutRef.current = null;
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

  const handleDuplicateComponent = useCallback(
    (componentType: CardItem["type"]) => {
      const duplicate = findBlockingDuplicate(componentType);
      if (!duplicate) return false;
      highlightItemTemporarily(duplicate.id);
      toast.error(
        `${getComponentLabel(componentType)} כבר קיים בפריסה. כדי להשתמש בו, הזז או שנה את הכרטיס המסומן.`,
      );
      return true;
    },
    [findBlockingDuplicate, getComponentLabel, highlightItemTemporarily],
  );

  const placeComponentAt = useCallback(
    (componentType: CardItem["type"], lane: number, x: number) => {
      if (handleDuplicateComponent(componentType)) {
        setPendingPlacement(null);
        setDrawerOpen(false);
        return;
      }

      const minWidth = computeCardMinGridCols(componentType);
      const preferredWidth = Math.max(
        minWidth,
        computeCardGridCols(componentType),
      );
      const preferredX = Math.max(
        0,
        Math.min(EXAM_LAYOUT_GRID_COLUMNS - minWidth, x),
      );
      const placement = findNearestAvailableGridPlacement(
        lane,
        preferredX,
        preferredWidth,
        minWidth,
        itemsRef.current,
      );
      if (placement === null) {
        toast.error("אין מספיק מקום פנוי בשורה עבור הרכיב הזה.");
        return;
      }
      const id = `${componentType}-${Date.now()}`;
      const item = normalizeGridItem({
        id,
        type: componentType,
        x: placement.x,
        y: lane,
        w: placement.w,
        showEyeLabels: placement.x === 0,
      });

      const next = sortGridItems([...itemsRef.current, item]);
      itemsRef.current = next;
      setItems(next);
      setSelectedType(null);
      setPendingPlacement(null);
      setDrawerOpen(false);
    },
    [getComponentLabel, handleDuplicateComponent],
  );

  const handleSelectComponent = (componentType: CardItem["type"]) => {
    if (pendingPlacement) {
      placeComponentAt(
        componentType,
        pendingPlacement.lane,
        pendingPlacement.x,
      );
      return;
    }
    if (handleDuplicateComponent(componentType)) {
      setPendingPlacement(null);
      setDrawerOpen(false);
      return;
    }
    setSelectedType(componentType);
    setDrawerOpen(false);
  };

  const handlePlaceSelected = (event: React.MouseEvent, lane: number) => {
    if (suppressNextRowClickRef.current) {
      suppressNextRowClickRef.current = false;
      return;
    }
    if ((event.target as HTMLElement).closest("[data-grid-card]")) return;
    const x = getColumnFromPointer(lane, event.clientX);
    const selectedWidth = selectedType
      ? computeCardMinGridCols(selectedType)
      : 1;
    const clampedX =
      selectedType === null
        ? Math.max(0, Math.min(EXAM_LAYOUT_GRID_COLUMNS - 1, x))
        : Math.max(0, Math.min(EXAM_LAYOUT_GRID_COLUMNS - selectedWidth, x));

    if (selectedType) {
      placeComponentAt(selectedType, lane, clampedX);
      return;
    }

    setPendingPlacement({ lane, x: clampedX });
    setDrawerOpen(true);
  };

  const updateItem = (
    id: string,
    updater: (item: GridLayoutItem) => GridLayoutItem,
  ) => {
    const next = itemsRef.current.map((item) =>
      item.id === id ? updater(item) : item,
    );
    itemsRef.current = next;
    setItems(next);
  };

  const updateDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.type !== "drag") return;

      const lane = getLaneFromPointer(clientY);
      const original = interaction.originalItem;
      const x = Math.max(
        0,
        Math.min(
          EXAM_LAYOUT_GRID_COLUMNS - original.w,
          getColumnFromPointer(lane, clientX, interaction.offsetCols),
        ),
      );
      const candidate = normalizeGridItem({ ...original, x, y: lane });
      const valid = canPlaceGridItem(
        candidate,
        itemsRef.current,
        EXAM_LAYOUT_GRID_COLUMNS,
        original.id,
      );
      setInvalidItemId(valid ? null : original.id);
      updateItem(original.id, () => candidate);
    },
    [getColumnFromPointer, getLaneFromPointer],
  );

  const finishInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const current = itemsRef.current.find((item) => item.id === interaction.id);
    if (!current) return;

    const finalItem =
      interaction.type === "resize" && interaction.edge === "left"
        ? {
            ...current,
            ...clampResizeLeft(
              interaction.originalItem,
              itemsRef.current,
              Math.round(current.x),
            ),
          }
        : normalizeGridItem(current);

    const valid = canPlaceGridItem(
      finalItem,
      itemsRef.current,
      EXAM_LAYOUT_GRID_COLUMNS,
      finalItem.id,
    );
    if (!valid) {
      updateItem(interaction.id, () => interaction.originalItem);
    } else {
      updateItem(interaction.id, () => normalizeGridItem(finalItem));
    }

    interactionRef.current = null;
    dragPointerRef.current = null;
    scrollContainerRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    suppressNextRowClickRef.current = true;
    window.setTimeout(() => {
      suppressNextRowClickRef.current = false;
    }, 80);
    setInvalidItemId(null);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const getScrollContainer = useCallback((element: HTMLElement | null) => {
    let current = element?.parentElement ?? null;

    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight
      ) {
        return current;
      }
      current = current.parentElement;
    }

    return window;
  }, []);

  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollFrameRef.current !== null) return;

    const stepAutoScroll = () => {
      const interaction = interactionRef.current;
      const pointer = dragPointerRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (interaction?.type !== "drag" || !pointer || !scrollContainer) {
        autoScrollFrameRef.current = null;
        return;
      }

      const containerRect =
        scrollContainer === window
          ? { top: 0, bottom: window.innerHeight }
          : scrollContainer.getBoundingClientRect();

      let didScroll = false;
      if (pointer.y > containerRect.bottom - EDGE_SCROLL_ZONE_PX) {
        if (scrollContainer === window) {
          window.scrollBy({ top: EDGE_SCROLL_STEP_PX, behavior: "auto" });
        } else {
          scrollContainer.scrollBy({
            top: EDGE_SCROLL_STEP_PX,
            behavior: "auto",
          });
        }
        didScroll = true;
      } else if (pointer.y < containerRect.top + EDGE_SCROLL_ZONE_PX) {
        if (scrollContainer === window) {
          window.scrollBy({ top: -EDGE_SCROLL_STEP_PX, behavior: "auto" });
        } else {
          scrollContainer.scrollBy({
            top: -EDGE_SCROLL_STEP_PX,
            behavior: "auto",
          });
        }
        didScroll = true;
      }

      if (didScroll) {
        updateDragPosition(pointer.x, pointer.y);
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(stepAutoScroll);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(stepAutoScroll);
  }, [updateDragPosition]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.type === "drag") {
        dragPointerRef.current = { x: event.clientX, y: event.clientY };
        startAutoScrollLoop();
        updateDragPosition(event.clientX, event.clientY);
        return;
      }

      const laneEl = laneRefs.current[interaction.originalItem.y];
      if (!laneEl) return;
      const colWidth =
        laneEl.getBoundingClientRect().width / EXAM_LAYOUT_GRID_COLUMNS;
      const deltaCols = (event.clientX - interaction.startX) / colWidth;

      if (interaction.edge === "left") {
        const resized = clampResizeLeft(
          interaction.originalItem,
          itemsRef.current,
          interaction.originalItem.x + deltaCols,
        );
        updateItem(interaction.id, (item) => ({
          ...item,
          x: resized.x,
          w: resized.w,
        }));
        return;
      }

      const requestedWidth = interaction.startW + deltaCols;
      const clampedWidth = clampResizeWidth(
        interaction.originalItem,
        itemsRef.current,
        requestedWidth,
      );
      updateItem(interaction.id, (item) => ({
        ...item,
        w: clampedWidth,
      }));
    };

    const handlePointerUp = () => finishInteraction();

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [finishInteraction, startAutoScrollLoop, updateDragPosition]);

  const handleDragStart = (event: React.PointerEvent, item: GridLayoutItem) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_CARD_SELECTOR)) return;
    const laneEl = laneRefs.current[item.y];
    const cardEl = (event.currentTarget as HTMLElement).closest(
      "[data-grid-card]",
    ) as HTMLElement | null;
    if (!laneEl || !cardEl) return;

    event.preventDefault();
    event.stopPropagation();

    const colWidth =
      laneEl.getBoundingClientRect().width / EXAM_LAYOUT_GRID_COLUMNS;
    const offsetCols =
      (event.clientX - cardEl.getBoundingClientRect().left) / colWidth;
    interactionRef.current = {
      type: "drag",
      id: item.id,
      originalItem: { ...item },
      offsetCols,
    };
    dragPointerRef.current = { x: event.clientX, y: event.clientY };
    scrollContainerRef.current = getScrollContainer(laneEl);
    startAutoScrollLoop();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  const handleResizeStart = (
    event: React.PointerEvent,
    item: GridLayoutItem,
    edge: "left" | "right",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: "resize",
      id: item.id,
      originalItem: { ...item },
      startX: event.clientX,
      startW: item.w,
      edge,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleRemoveCard = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.success("הרכיב הוסר");
  };

  const handleToggleEyeLabels = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, showEyeLabels: !item.showEyeLabels } : item,
      ),
    );
  };

  const handleCardTitleChange = (id: string, title: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item)),
    );
  };

  const handleDeleteLane = useCallback(
    (lane: number) => {
      const lastLane = lanes[lanes.length - 1];
      if (lane === lastLane) return;

      const next = sortGridItems(
        itemsRef.current
          .filter((item) => item.y !== lane)
          .map((item) => (item.y > lane ? { ...item, y: item.y - 1 } : item)),
      );

      itemsRef.current = next;
      setItems(next);
      setPendingPlacement((current) => {
        if (!current) return null;
        if (current.lane === lane) return null;
        if (current.lane > lane) {
          return { ...current, lane: current.lane - 1 };
        }
        return current;
      });
      toast.success("השורה נמחקה");
    },
    [lanes],
  );

  const handleInsertLane = useCallback((afterLane: number) => {
    const next = sortGridItems(
      itemsRef.current.map((item) =>
        item.y > afterLane ? { ...item, y: item.y + 1 } : item,
      ),
    );

    itemsRef.current = next;
    setItems(next);
    setPendingPlacement((current) => {
      if (!current) return null;
      if (current.lane > afterLane) {
        return { ...current, lane: current.lane + 1 };
      }
      return current;
    });
    toast.success("השורה נוספה");
  }, []);

  const handleSaveLayout = async () => {
    if (isSavingRef.current) return;
    if (!layoutName.trim()) {
      toast.error("נא להזין שם לפריסה");
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    let shouldResetSaving = true;

    try {
      const targetClinicId = layoutClinicId ?? currentClinic?.id ?? null;
      const layoutData = {
        ...(targetClinicId !== null ? { clinic_id: targetClinicId } : {}),
        name: layoutName,
        layout_data: serializeGridLayoutData(items),
        is_default: isDefault,
        type: layoutType,
      };

      const result =
        isNewMode || !params.layoutId
          ? await createExamLayout(layoutData)
          : await updateExamLayout({
              id: Number(params.layoutId),
              ...layoutData,
            });

      if (result) {
        shouldResetSaving = false;
        toast.success(
          isNewMode ? "פריסה חדשה נוצרה בהצלחה" : "הפריסה עודכנה בהצלחה",
        );
        navigate({ to: "/exam-layouts" });
      } else {
        toast.error("שגיאה בשמירת הפריסה");
      }
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("שגיאה בשמירת הפריסה");
    } finally {
      if (shouldResetSaving) {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <SiteHeader
        title={layoutName}
        parentTitle="פריסות בדיקה"
        parentLink="/exam-layouts"
        grandparentTitle="הגדרות"
        grandparentLink="/settings"
      />
    );
  }

  return (
    <>
      <SiteHeader
        title={layoutName}
        parentTitle="פריסות בדיקה"
        parentLink="/exam-layouts"
        grandparentTitle="הגדרות"
        grandparentLink="/settings"
      />
      <div className="flex flex-1 flex-col p-4 pb-32 lg:p-6 lg:pb-40" dir="rtl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <Input
                  value={layoutName}
                  onChange={(event) => setLayoutName(event.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setIsEditingName(false);
                  }}
                  className="h-auto border-none p-0 text-xl font-semibold focus-visible:ring-0"
                  autoFocus
                />
              ) : (
                <>
                  <h2 className="text-xl font-semibold">{layoutName}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingName(true)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">סוג:</span>
              <Select value={layoutType} onValueChange={setLayoutType}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">כללי</SelectItem>
                  <SelectItem value="glass" dir="rtl">
                    משקפיים
                  </SelectItem>
                  <SelectItem value="contact lens" dir="rtl">
                    עדשות מגע
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <AddComponentDrawer
              selectedType={selectedType}
              open={drawerOpen}
              onOpenChange={(open) => {
                setDrawerOpen(open);
                if (!open) setPendingPlacement(null);
              }}
              onSelectComponent={handleSelectComponent}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/exam-layouts" })}
            >
              ביטול
            </Button>
            <Button onClick={handleSaveLayout} disabled={isSaving}>
              {isSaving ? "שומר..." : "שמור פריסה"}
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border bg-blue-50 p-4 text-sm text-blue-800">
          לחץ על שורה כדי לבחור רכיב ולהוסיף אותו שם. גרור כרטיסים בין תאים
          ושורות, וגרור את אחד מקצוות הכרטיס כדי לשנות רוחב.
        </div>

        <div
          className="border-border overflow-hidden rounded-md border"
          dir="ltr"
        >
          {lanes.map((lane) => {
            const laneItems = groupedItems.get(lane) || [];
            const isLastLane = lane === lanes[lanes.length - 1];
            return (
              <div
                key={lane}
                ref={(el) => {
                  laneRefs.current[lane] = el;
                }}
                className={cn(
                  "border-border group/row relative grid w-full gap-4 border-b p-3 transition-colors last:border-b-0",
                  selectedType && "hover:bg-primary/5 cursor-crosshair",
                )}
                style={{
                  minHeight:
                    laneItems.length === 0
                      ? EXAM_LAYOUT_LANE_MIN_HEIGHT_PX
                      : undefined,
                  gridTemplateColumns: `repeat(${EXAM_LAYOUT_GRID_COLUMNS}, minmax(0, 1fr))`,
                  alignItems: "start",
                }}
                onClick={(event) => handlePlaceSelected(event, lane)}
              >
                {!isLastLane && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDeleteLane(lane);
                    }}
                    className="bg-background/90 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground absolute top-2 left-2 z-20 rounded-md p-1 opacity-0 transition-opacity group-hover/row:opacity-100"
                    title="מחק שורה"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {laneItems.map((item) => {
                  const renderStart = Math.floor(item.x);
                  const renderEnd = Math.ceil(item.x + item.w);
                  const renderSpan = Math.max(1, renderEnd - renderStart);
                  const renderWidth = `${Math.min(100, (item.w / renderSpan) * 100)}%`;
                  const renderMarginLeft = `${Math.max(
                    0,
                    ((item.x - renderStart) / renderSpan) * 100,
                  )}%`;
                  return (
                    <div
                      key={item.id}
                      data-grid-card
                      onPointerDown={(event) => handleDragStart(event, item)}
                      className={cn(
                        "group/card relative min-w-0 cursor-grab transition-opacity active:cursor-grabbing",
                        highlightedItemId === item.id &&
                          "ring-primary ring-2 ring-offset-2",
                        invalidItemId === item.id &&
                          "ring-destructive opacity-60 ring-2",
                      )}
                      style={{
                        gridColumn: `${renderStart + 1} / span ${renderSpan}`,
                        gridRow: 1,
                        width: renderWidth,
                        marginLeft: renderMarginLeft,
                      }}
                    >
                      <div
                        data-resize-handle
                        onPointerDown={(event) =>
                          handleResizeStart(event, item, "left")
                        }
                        className="absolute top-4 bottom-4 -left-2 z-10 w-4 cursor-col-resize opacity-0 transition-opacity group-hover/card:opacity-100"
                        title="שנה רוחב משמאל"
                      >
                        <div className="mx-auto h-full w-1 rounded-full bg-gray-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(item.id)}
                        className="absolute top-2 right-2 z-20 rounded-md bg-red-500/80 p-1 text-white opacity-0 transition-opacity group-hover/card:opacity-100 hover:bg-red-600"
                        title="הסר רכיב"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleEyeLabels(item.id)}
                        className="bg-background/80 text-muted-foreground hover:bg-accent absolute top-2 left-10 z-20 rounded-md p-1 opacity-0 transition-opacity group-hover/card:opacity-100"
                        title={
                          item.showEyeLabels
                            ? "הסתר תוויות עין"
                            : "הצג תוויות עין"
                        }
                      >
                        {item.showEyeLabels ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </button>
                      <div
                        data-resize-handle
                        onPointerDown={(event) =>
                          handleResizeStart(event, item, "right")
                        }
                        className="absolute top-4 -right-2 bottom-4 z-10 w-4 cursor-col-resize opacity-0 transition-opacity group-hover/card:opacity-100"
                        title="שנה רוחב מימין"
                      >
                        <div className="mx-auto h-full w-1 rounded-full bg-gray-400" />
                      </div>
                      <ExamCardRenderer
                        item={item}
                        rowCards={laneItems}
                        isEditing
                        mode="editor"
                        hideEyeLabels={item.showEyeLabels === false}
                        matchHeight={
                          hasNoteCard(laneItems) && laneItems.length > 1
                        }
                        onTitleChange={(title) =>
                          handleCardTitleChange(item.id, title)
                        }
                      />
                    </div>
                  );
                })}
                {laneItems.length === 0 && (
                  <div className="text-muted-foreground col-span-full flex min-h-[168px] items-center justify-center rounded-md text-sm">
                    {selectedType
                      ? "לחץ כאן כדי למקם את הרכיב"
                      : "שורה פנויה - לחץ כדי להוסיף רכיב"}
                  </div>
                )}
                {!isLastLane && (
                  <div className="group/separator absolute right-0 bottom-0 left-0 z-20 h-6 translate-y-1/2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleInsertLane(lane);
                      }}
                      className="bg-background text-foreground border-border hover:bg-accent pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-3 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover/separator:pointer-events-auto group-hover/separator:opacity-100"
                      title="הוסף שורה"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>הוסף שורה</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
