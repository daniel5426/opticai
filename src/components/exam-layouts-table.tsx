import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { ExamLayout } from "@/lib/db/schema-interface";
import {
  bulkDeleteExamLayouts,
  createExamLayoutGroup,
  deleteExamLayout,
  reorderExamLayouts,
  updateExamLayout,
} from "@/lib/db/exam-layouts-db";
import { TableFiltersBar } from "@/components/table-filters-bar";
import {
  ALL_FILTER_VALUE,
  EXAM_LAYOUT_TYPE_OPTIONS,
} from "@/lib/table-filters";

type LayoutNode = ExamLayout & { children?: LayoutNode[] };

interface FlattenedNode {
  node: LayoutNode;
  depth: number;
  parentId: number | null;
  index: number;
}

interface ExamLayoutsTableProps {
  data: LayoutNode[];
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (value: string) => void;
}

function cloneTree(nodes: LayoutNode[]) {
  return JSON.parse(JSON.stringify(nodes)) as LayoutNode[];
}

function detachNode(
  nodes: LayoutNode[],
  id: number,
): { node: LayoutNode | null } {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === id) {
      const [removed] = nodes.splice(i, 1);
      return { node: removed };
    }
    if (node.children && node.children.length) {
      const result = detachNode(node.children, id);
      if (result.node) {
        if (node.children.length === 0) {
          delete node.children;
        }
        return result;
      }
    }
  }
  return { node: null };
}

function insertNode(
  nodes: LayoutNode[],
  node: LayoutNode,
  parentId: number | null,
  index: number,
) {
  if (!parentId) {
    if (index >= nodes.length) {
      nodes.push(node);
    } else {
      nodes.splice(index, 0, node);
    }
    return;
  }
  for (const current of nodes) {
    if (current.id === parentId) {
      const list = current.children
        ? current.children
        : (current.children = []);
      if (index >= list.length) {
        list.push(node);
      } else {
        list.splice(index, 0, node);
      }
      return;
    }
    if (current.children && current.children.length) {
      insertNode(current.children, node, parentId, index);
    }
  }
}

function moveNode(
  nodes: LayoutNode[],
  id: number,
  parentId: number | null,
  index: number,
) {
  const cloned = cloneTree(nodes);
  const { node } = detachNode(cloned, id);
  if (!node) {
    return nodes;
  }
  insertNode(cloned, node, parentId, index);
  return cloned;
}

function flattenTree(
  nodes: LayoutNode[],
  expanded: Set<number>,
  depth = 0,
  parentId: number | null = null,
): FlattenedNode[] {
  const items: FlattenedNode[] = [];
  nodes.forEach((node, index) => {
    if (!node.id) {
      return;
    }
    items.push({
      node,
      depth,
      parentId,
      index,
    });
    if (node.children && node.children.length && expanded.has(node.id)) {
      items.push(...flattenTree(node.children, expanded, depth + 1, node.id));
    }
  });
  return items;
}

function findNode(nodes: LayoutNode[], id: number): LayoutNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length) {
      const found = findNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function hasDescendant(node: LayoutNode, id: number): boolean {
  if (!node.children) {
    return false;
  }
  for (const child of node.children) {
    if (child.id === id) {
      return true;
    }
    if (hasDescendant(child, id)) {
      return true;
    }
  }
  return false;
}

function isDescendant(
  nodes: LayoutNode[],
  rootId: number,
  searchId: number,
): boolean {
  const root = findNode(nodes, rootId);
  if (!root) {
    return false;
  }
  return hasDescendant(root, searchId);
}

function collectReorderPayload(
  nodes: LayoutNode[],
  parentId: number | null = null,
) {
  const items: {
    id: number;
    sort_index: number;
    parent_layout_id: number | null;
  }[] = [];
  nodes.forEach((node, index) => {
    if (!node.id) {
      return;
    }
    items.push({
      id: node.id,
      sort_index: index + 1,
      parent_layout_id: parentId,
    });
    if (node.children && node.children.length) {
      items.push(...collectReorderPayload(node.children, node.id));
    }
  });
  return items;
}

function updateNodeActiveState(
  nodes: LayoutNode[],
  id: number,
  isActive: boolean,
): LayoutNode[] {
  return nodes.map((node) => ({
    ...node,
    is_active: node.id === id ? isActive : node.is_active,
    children: node.children
      ? updateNodeActiveState(node.children, id, isActive)
      : node.children,
  }));
}

function applyActiveOverrides(
  nodes: LayoutNode[],
  overrides: Record<number, boolean>,
): LayoutNode[] {
  return nodes.map((node) => ({
    ...node,
    is_active:
      node.id && node.id in overrides ? overrides[node.id] : node.is_active,
    children: node.children
      ? applyActiveOverrides(node.children, overrides)
      : node.children,
  }));
}

function getNodeActiveState(
  nodes: LayoutNode[],
  id: number,
): boolean | undefined {
  const node = findNode(nodes, id);
  return node ? Boolean(node.is_active) : undefined;
}

function SortableRow({
  item,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelectChange,
  onRowClick,
  onActiveChange,
  onDelete,
  isProcessing,
  activeId,
}: {
  item: FlattenedNode;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectChange: (value: boolean) => void;
  onRowClick: () => void;
  onActiveChange: (value: boolean) => void;
  onDelete: (event: React.MouseEvent) => void;
  isProcessing: boolean;
  activeId: number | null;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: item.node.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isGroup = Boolean(item.node.is_group);

  const typeMap: Record<string, string> = {
    global: "כללי",
    glass: "משקפיים",
    "contact lens": "עדשות מגע",
  };
  const isInactive = item.node.is_active === false;
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isDragging ? "dragging" : undefined}
      className={`relative transition-colors ${isInactive ? "bg-muted/20 text-muted-foreground opacity-60" : ""} ${isDragging ? "opacity-70" : ""} ${activeId === item.node.id ? "ring-primary ring-1" : ""}`}
      onClick={() => {
        if (isGroup) {
          onToggleExpand();
        } else {
          onRowClick();
        }
      }}
    >
      <TableCell className="w-12">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(value) => {
              onSelectChange(Boolean(value));
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </TableCell>
      <TableCell>
        <div
          className="flex items-center gap-2"
          style={{ paddingInlineStart: `${item.depth * 1.5}rem` }}
        >
          <span
            className="cursor-grab font-medium select-none active:cursor-grabbing"
            {...listeners}
            {...attributes}
          >
            {item.node.name}
          </span>
          {item.node.is_group ? (
            <span className="text-muted-foreground text-xs">
              {(item.node.children && item.node.children.length) || 0} פריסות
            </span>
          ) : null}

          {item.node.is_group ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
              className="text-muted-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {item.node.type ? typeMap[item.node.type] || item.node.type : "—"}
      </TableCell>
      <TableCell className="text-right">
        {item.node.created_at
          ? new Date(item.node.created_at).toLocaleDateString("he-IL")
          : ""}
      </TableCell>
      <TableCell className="text-right">
        {item.node.updated_at
          ? new Date(item.node.updated_at).toLocaleDateString("he-IL")
          : ""}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-start">
          <Switch
            checked={Boolean(item.node.is_active)}
            disabled={isProcessing}
            onCheckedChange={(value) => {
              onActiveChange(value);
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={item.node.is_active ? "פריסה פעילה" : "פריסה לא פעילה"}
          />
        </div>
      </TableCell>
      <TableCell className="w-[140px] text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            title="מחק פריסה"
            disabled={isProcessing}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ExamLayoutsTable({
  data,
  onRefresh,
  searchQuery: externalSearchQuery,
  onSearchChange,
  typeFilter: externalTypeFilter,
  onTypeFilterChange,
}: ExamLayoutsTableProps) {
  const navigate = useNavigate();
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>(ALL_FILTER_VALUE);
  const [localData, setLocalData] = useState<LayoutNode[]>(data);
  const [activeOverrides, setActiveOverrides] = useState<
    Record<number, boolean>
  >({});
  const [isProcessing, setIsProcessing] = useState<Record<number, boolean>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<LayoutNode | null>(null);
  const [isGrouping, setIsGrouping] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const searchQuery =
    externalSearchQuery !== undefined
      ? externalSearchQuery
      : internalSearchQuery;
  const typeFilter = externalTypeFilter ?? selectedType;

  React.useEffect(() => {
    setActiveOverrides((currentOverrides) => {
      const nextOverrides = Object.fromEntries(
        Object.entries(currentOverrides).filter(([id, isActive]) => {
          return getNodeActiveState(data, Number(id)) !== isActive;
        }),
      ) as Record<number, boolean>;
      setLocalData(applyActiveOverrides(data, nextOverrides));
      return nextOverrides;
    });
  }, [data]);

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
      return;
    }
    setInternalSearchQuery(value);
  };

  const handleTypeFilterChange = (value: string) => {
    if (onTypeFilterChange) {
      onTypeFilterChange(value);
      return;
    }
    setSelectedType(value);
  };

  const filteredData = useMemo(() => {
    const filter = (nodes: LayoutNode[]): LayoutNode[] => {
      return nodes
        .map((node) => {
          const matchesType =
            typeFilter === ALL_FILTER_VALUE ||
            node.is_group ||
            node.type === typeFilter;
          const searchMatches = !searchQuery.trim()
            ? true
            : node.name?.toLowerCase().includes(searchQuery.toLowerCase());

          if (matchesType && searchMatches) {
            return node;
          }
          if (node.children && node.children.length) {
            const filteredChildren = filter(node.children);
            if (filteredChildren.length) {
              return {
                ...node,
                children: filteredChildren,
              };
            }
          }
          return null;
        })
        .filter(Boolean) as LayoutNode[];
    };
    return filter(localData);
  }, [localData, searchQuery, typeFilter]);

  const flattenedAll = useMemo(() => {
    return flattenTree(localData, expandedIds);
  }, [localData, expandedIds]);

  const flattenedDisplay = useMemo(() => {
    return flattenTree(filteredData, expandedIds);
  }, [filteredData, expandedIds]);

  const handleCreateNew = () => {
    const layoutCount = flattenedAll.length + 1;
    navigate({
      to: "/exam-layouts/new",
      search: { name: `פריסה ${layoutCount}` },
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelection = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const persistReorder = async (tree: LayoutNode[]) => {
    const items = collectReorderPayload(tree);
    if (!items.length) {
      return;
    }
    const clinicId = items
      .map((item) => findNode(tree, item.id)?.clinic_id)
      .find((value) => value !== undefined && value !== null);
    try {
      const response = await reorderExamLayouts({
        clinic_id: clinicId || undefined,
        items: items.map((item) => ({
          id: item.id,
          sort_index: item.sort_index,
          parent_layout_id: item.parent_layout_id,
        })),
      });
      if (response.length) {
        setLocalData(response as LayoutNode[]);
      }
      onRefresh();
    } catch (error) {
      onRefresh();
      throw error;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    if (searchQuery.trim()) {
      toast.error("נקה את החיפוש לפני סידור הפריסות");
      return;
    }
    const activeIdValue = Number(active.id);
    const overIdValue = Number(over.id);
    if (activeIdValue === overIdValue) {
      return;
    }
    const activeItem = flattenedAll.find(
      (item) => item.node.id === activeIdValue,
    );
    const overItem = flattenedAll.find((item) => item.node.id === overIdValue);
    if (!activeItem || !overItem) {
      return;
    }
    let targetParent: number | null;
    const activeIndex = flattenedAll.findIndex(
      (item) => item.node.id === activeIdValue,
    );
    const overIndex = flattenedAll.findIndex(
      (item) => item.node.id === overIdValue,
    );
    let targetIndex: number;
    if (overItem.node.is_group) {
      const sameGroup = activeItem.parentId === overItem.node.id;
      const movingBeforeGroup = sameGroup && overIndex < activeIndex;
      if (movingBeforeGroup) {
        targetParent = overItem.parentId ?? null;
        targetIndex = overItem.index;
      } else {
        targetParent = overItem.node.id!;
        targetIndex = overItem.node.children
          ? overItem.node.children.length
          : 0;
      }
    } else {
      targetParent = overItem.parentId;
      targetIndex = overItem.index;
      const sameParent = activeItem.parentId === targetParent;
      if (sameParent && overIndex > activeIndex) {
        targetIndex = overItem.index;
      }
    }
    if (targetParent === activeIdValue) {
      return;
    }
    if (targetParent && isDescendant(localData, activeIdValue, targetParent)) {
      toast.error("לא ניתן לסדר קבוצה בתוך עצמה");
      return;
    }
    const currentParent = activeItem.parentId;
    if (currentParent === targetParent && activeItem.index === targetIndex) {
      return;
    }
    const nextTree = moveNode(
      localData,
      activeIdValue,
      targetParent ?? null,
      targetIndex,
    );
    setLocalData(nextTree);
    try {
      await persistReorder(nextTree);
      toast.success("הסדר נשמר");
    } catch (error) {
      console.error("Error reordering layouts", error);
      toast.error("שגיאה בשמירת הסדר");
      onRefresh();
    }
  };

  const handleSetActive = async (
    layoutId: number | undefined,
    isActive: boolean,
  ) => {
    if (!layoutId) {
      return;
    }
    if (isProcessing[layoutId]) {
      return;
    }
    const previousData = localData;
    setActiveOverrides((prev) => ({ ...prev, [layoutId]: isActive }));
    setLocalData((prev) => updateNodeActiveState(prev, layoutId, isActive));
    setIsProcessing((prev) => ({ ...prev, [layoutId]: true }));
    try {
      const node = findNode(localData, layoutId);
      if (!node) {
        throw new Error("Layout not found");
      }
      await updateExamLayout({
        ...node,
        is_active: isActive,
      });
      toast.success(isActive ? "הפריסה הופעלה" : "הפריסה כובתה");
      onRefresh();
    } catch (error) {
      setActiveOverrides((prev) => {
        const next = { ...prev };
        delete next[layoutId];
        return next;
      });
      setLocalData(previousData);
      console.error("Error updating layout active state", error);
      toast.error("שגיאה בעדכון סטטוס הפריסה");
    } finally {
      setIsProcessing((prev) => ({ ...prev, [layoutId]: false }));
    }
  };

  const handleDeleteLayout = (
    layoutId: number | undefined,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    if (!layoutId) {
      return;
    }
    const node = findNode(localData, layoutId);
    if (!node) {
      return;
    }
    setLayoutToDelete(node);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!layoutToDelete || !layoutToDelete.id) {
      return;
    }
    setIsDeleting(true);
    try {
      const success = await deleteExamLayout(layoutToDelete.id);
      if (success) {
        toast.success("הפריסה נמחקה");
        onRefresh();
      } else {
        toast.error("שגיאה במחיקה");
      }
    } catch (error) {
      console.error("Error deleting layout", error);
      toast.error("שגיאה במחיקה");
    } finally {
      setIsDeleting(false);
      setLayoutToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (!selectedIds.size) {
      setIsBulkDeleteModalOpen(false);
      return;
    }
    setIsBulkDeleting(true);
    try {
      const anyNode = flattenedAll.find((item) =>
        selectedIds.has(item.node.id!),
      );
      const clinicId = anyNode?.node.clinic_id;
      await bulkDeleteExamLayouts({
        clinic_id: clinicId,
        layout_ids: Array.from(selectedIds),
      });
      toast.success("הפריסות שנבחרו הוסרו");
      setSelectedIds(new Set());
      onRefresh();
    } catch (error) {
      console.error("Error deleting layouts", error);
      toast.error("שגיאה במחיקת פריסות");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  const handleOpenGroupModal = () => {
    const selected = flattenedAll.filter((item) =>
      selectedIds.has(item.node.id!),
    );
    const includesGroup = selected.some((item) => item.node.is_group);
    if (includesGroup) {
      toast.error("לא ניתן לקבץ פריסות הכוללות קבוצה קיימת");
      return;
    }
    const defaultName = `קבוצה ${Date.now()}`;
    setGroupName(defaultName);
    setIsGroupModalOpen(true);
  };

  const handleGroupConfirm = async () => {
    if (!groupName.trim() || selectedIds.size < 2) {
      toast.error("יש להזין שם ולבחור לפחות שתי פריסות");
      return;
    }
    setIsGrouping(true);
    try {
      const selected = flattenedAll.filter((item) =>
        selectedIds.has(item.node.id!),
      );
      const clinicId = selected[0]?.node.clinic_id;
      await createExamLayoutGroup({
        clinic_id: clinicId,
        name: groupName.trim(),
        layout_ids: selected.map((item) => item.node.id!) || [],
      });
      toast.success("הקבוצה נוצרה");
      setSelectedIds(new Set());
      setGroupName("");
      setIsGroupModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error creating group", error);
      toast.error("שגיאה ביצירת קבוצה");
    } finally {
      setIsGrouping(false);
    }
  };

  return (
    <div className="mb-10 space-y-2.5" dir="rtl">
      <TableFiltersBar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="חיפוש פריסות…"
        filters={[
          {
            key: "type",
            value: typeFilter,
            onChange: handleTypeFilterChange,
            placeholder: "סוג",
            options: EXAM_LAYOUT_TYPE_OPTIONS,
            widthClassName: "w-[160px]",
          },
        ]}
        hasActiveFilters={
          Boolean(searchQuery.trim()) || typeFilter !== ALL_FILTER_VALUE
        }
        onReset={() => {
          handleSearchChange("");
          handleTypeFilterChange(ALL_FILTER_VALUE);
        }}
        actions={
          <>
            {selectedIds.size > 0 ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleOpenGroupModal}
                  disabled={selectedIds.size < 2}
                  className="bg-primary text-primary-foreground"
                >
                  צור קבוצה
                </Button>
              </>
            ) : null}
            <Button
              onClick={handleCreateNew}
              className="bg-card text-card-foreground hover:bg-accent border shadow-none"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="bg-card rounded-md">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Table
            dir="rtl"
            containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain"
            containerStyle={{ scrollbarWidth: "none" }}
          >
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={
                        flattenedDisplay.length > 0 &&
                        flattenedDisplay.every((item) =>
                          selectedIds.has(item.node.id!),
                        )
                          ? true
                          : flattenedDisplay.some((item) =>
                                selectedIds.has(item.node.id!),
                              )
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) => {
                        const allVisibleIds = flattenedDisplay.map(
                          (item) => item.node.id!,
                        );
                        if (checked === true) {
                          setSelectedIds(
                            (prev) => new Set([...prev, ...allVisibleIds]),
                          );
                        } else {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            allVisibleIds.forEach((id) => next.delete(id));
                            return next;
                          });
                        }
                      }}
                    />
                  </div>
                </TableHead>
                <TableHead className="text-right">שם הפריסה</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">תאריך יצירה</TableHead>
                <TableHead className="text-right">עדכון אחרון</TableHead>
                <TableHead className="text-right">פעילה</TableHead>
                <TableHead className="w-[140px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flattenedDisplay.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    לא נמצאו פריסות לתצוגה
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext
                  items={flattenedDisplay.map((item) => item.node.id!)}
                >
                  {flattenedDisplay.map((item) => (
                    <SortableRow
                      key={item.node.id}
                      item={item}
                      activeId={activeId}
                      isSelected={selectedIds.has(item.node.id!)}
                      isExpanded={expandedIds.has(item.node.id!)}
                      onToggleExpand={() => toggleExpand(item.node.id!)}
                      onSelectChange={(value) =>
                        toggleSelection(item.node.id!, value)
                      }
                      onActiveChange={(value) =>
                        handleSetActive(item.node.id, value)
                      }
                      onDelete={(event) =>
                        handleDeleteLayout(item.node.id, event)
                      }
                      isProcessing={Boolean(isProcessing[item.node.id || 0])}
                      onRowClick={() => {
                        navigate({
                          to: "/exam-layouts/$layoutId",
                          params: { layoutId: String(item.node.id) },
                        });
                      }}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="מחיקת פריסה"
        description={
          layoutToDelete
            ? `האם אתה בטוח שברצונך למחוק את הפריסה "${layoutToDelete.name}"? פעולה זו אינה הפיכה.`
            : "האם אתה בטוח שברצונך למחוק פריסה זו? פעולה זו אינה הפיכה."
        }
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
        isLoading={isDeleting}
      />

      <CustomModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        title="מחיקת פריסות"
        description={`האם למחוק ${selectedIds.size} פריסות נבחרות? הפעולה אינה הפיכה.`}
        onConfirm={handleBulkDeleteConfirm}
        confirmText="מחק הכל"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
        isLoading={isBulkDeleting}
      />

      <CustomModal
        isOpen={isGroupModalOpen}
        onClose={() => !isGrouping && setIsGroupModalOpen(false)}
        title="יצירת קבוצה"
        description="הזן שם עבור הקבוצה החדשה"
        onConfirm={handleGroupConfirm}
        confirmText="צור קבוצה"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
        isLoading={isGrouping}
      >
        <div className="space-y-4">
          <Input
            placeholder="שם הקבוצה"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="text-center"
          />
          <p className="text-muted-foreground text-sm">
            הקבוצה תכיל {selectedIds.size} פריסות שנבחרו
          </p>
        </div>
      </CustomModal>
    </div>
  );
}
