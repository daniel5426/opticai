import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomModal } from "@/components/ui/custom-modal";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Star, Trash2 } from "lucide-react";
import { ExamLayout } from "@/lib/db/schema-interface";
import { bulkDeleteExamLayouts, createExamLayoutGroup, deleteExamLayout, reorderExamLayouts, updateExamLayout } from "@/lib/db/exam-layouts-db";

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
}

function cloneTree(nodes: LayoutNode[]) {
  return JSON.parse(JSON.stringify(nodes)) as LayoutNode[];
}

function detachNode(nodes: LayoutNode[], id: number): { node: LayoutNode | null } {
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

function insertNode(nodes: LayoutNode[], node: LayoutNode, parentId: number | null, index: number) {
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
      const list = current.children ? current.children : (current.children = []);
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

function moveNode(nodes: LayoutNode[], id: number, parentId: number | null, index: number) {
  const cloned = cloneTree(nodes);
  const { node } = detachNode(cloned, id);
  if (!node) {
    return nodes;
  }
  insertNode(cloned, node, parentId, index);
  return cloned;
}

function flattenTree(nodes: LayoutNode[], expanded: Set<number>, depth = 0, parentId: number | null = null): FlattenedNode[] {
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

function isDescendant(nodes: LayoutNode[], rootId: number, searchId: number): boolean {
  const root = findNode(nodes, rootId);
  if (!root) {
    return false;
  }
  return hasDescendant(root, searchId);
}

function collectReorderPayload(nodes: LayoutNode[], parentId: number | null = null) {
  const items: { id: number; sort_index: number; parent_layout_id: number | null }[] = [];
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

function SortableRow({
  item,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelectChange,
  onRowClick,
  getRowActions,
  activeId,
}: {
  item: FlattenedNode;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectChange: (value: boolean) => void;
  onRowClick: () => void;
  getRowActions: (showDefaultToggle: boolean) => React.ReactNode;
  activeId: number | null;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.node.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isGroup = Boolean(item.node.is_group);
  const showDefaultToggle = item.parentId === null;
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isDragging ? "dragging" : undefined}
      className={`relative ${isDragging ? "opacity-70" : ""} ${activeId === item.node.id ? "ring-1 ring-primary" : ""}`}
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
            className="font-medium cursor-grab active:cursor-grabbing select-none"
            {...listeners}
            {...attributes}
          >
            {item.node.name}
          </span>
          {item.node.is_group ? (
            <span className="text-xs text-muted-foreground">
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
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : null}

        </div>
      </TableCell>
      <TableCell className="text-right">
        {item.parentId !== null ? (
          "—"
        ) : item.node.is_default ? (
          "כן"
        ) : (
          "לא"
        )}
      </TableCell>
      <TableCell className="text-right">
        {item.node.created_at ? new Date(item.node.created_at).toLocaleDateString("he-IL") : ""}
      </TableCell>
      <TableCell className="text-right">
        {item.node.updated_at ? new Date(item.node.updated_at).toLocaleDateString("he-IL") : ""}
      </TableCell>
      <TableCell className="text-right w-[140px]">
        <div className="flex items-center justify-end gap-2">{getRowActions(showDefaultToggle)}</div>
      </TableCell>
    </TableRow>
  );
}

export function ExamLayoutsTable({ data, onRefresh }: ExamLayoutsTableProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [localData, setLocalData] = useState<LayoutNode[]>(data);
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return localData;
    }
    const filter = (nodes: LayoutNode[]): LayoutNode[] => {
      return nodes
        .map((node) => {
          const nameMatch = node.name?.toLowerCase().includes(searchQuery.toLowerCase());
          if (nameMatch) {
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
  }, [localData, searchQuery]);

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
    const activeItem = flattenedAll.find((item) => item.node.id === activeIdValue);
    const overItem = flattenedAll.find((item) => item.node.id === overIdValue);
    if (!activeItem || !overItem) {
      return;
    }
    let targetParent: number | null;
    const activeIndex = flattenedAll.findIndex((item) => item.node.id === activeIdValue);
    const overIndex = flattenedAll.findIndex((item) => item.node.id === overIdValue);
    let targetIndex: number;
    if (overItem.node.is_group) {
      const sameGroup = activeItem.parentId === overItem.node.id;
      const movingBeforeGroup = sameGroup && overIndex < activeIndex;
      if (movingBeforeGroup) {
        targetParent = overItem.parentId ?? null;
        targetIndex = overItem.index;
      } else {
        targetParent = overItem.node.id!;
        targetIndex = overItem.node.children ? overItem.node.children.length : 0;
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
    const nextTree = moveNode(localData, activeIdValue, targetParent ?? null, targetIndex);
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

  const handleSetDefault = async (layoutId: number | undefined) => {
    if (!layoutId) {
      return;
    }
    if (isProcessing[layoutId]) {
      return;
    }
    setIsProcessing((prev) => ({ ...prev, [layoutId]: true }));
    try {
      const node = findNode(data, layoutId);
      if (!node) {
        throw new Error("Layout not found");
      }
      const newDefaultStatus = !node.is_default;
      if (!newDefaultStatus) {
      const defaults = flattenedAll.filter((item) => item.node.is_default);
        if (defaults.length <= 1) {
          toast.error("חייב להיות לפחות פריסת ברירת מחדל אחת");
          setIsProcessing((prev) => ({ ...prev, [layoutId]: false }));
          return;
        }
      }
      await updateExamLayout({
        ...node,
        is_default: newDefaultStatus,
      });
      toast.success(newDefaultStatus ? "הפריסה הוגדרה כברירת מחדל" : "הפריסה הוסרה מברירת מחדל");
      onRefresh();
    } catch (error) {
      console.error("Error setting default layout", error);
      toast.error("שגיאה בהגדרת פריסת ברירת מחדל");
    } finally {
      setIsProcessing((prev) => ({ ...prev, [layoutId]: false }));
    }
  };

  const handleDeleteLayout = (layoutId: number | undefined, event: React.MouseEvent) => {
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
      const anyNode = flattenedAll.find((item) => selectedIds.has(item.node.id!));
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
    const selected = flattenedAll.filter((item) => selectedIds.has(item.node.id!));
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
      const selected = flattenedAll.filter((item) => selectedIds.has(item.node.id!));
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
    <div className="space-y-6 mb-10" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="חיפוש פריסות..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
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
          <Button onClick={handleCreateNew} className="bg-card shadow-none text-card-foreground hover:bg-accent border">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-card">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: "none" }}>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">
                  <div className="flex items-center justify-center">
                    <Checkbox
                    checked={
                      flattenedDisplay.length > 0 && flattenedDisplay.every((item) => selectedIds.has(item.node.id!))
                        ? true
                        : flattenedDisplay.some((item) => selectedIds.has(item.node.id!))
                        ? "indeterminate"
                        : false
                    }
                    onCheckedChange={(checked) => {
                      const allVisibleIds = flattenedDisplay.map((item) => item.node.id!);
                      if (checked === true) {
                        setSelectedIds((prev) => new Set([...prev, ...allVisibleIds]));
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
                <TableHead className="text-right">ברירת מחדל</TableHead>
                <TableHead className="text-right">תאריך יצירה</TableHead>
                <TableHead className="text-right">עדכון אחרון</TableHead>
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
                <SortableContext items={flattenedDisplay.map((item) => item.node.id!)}>
                  {flattenedDisplay.map((item) => (
                    <SortableRow
                      key={item.node.id}
                      item={item}
                      activeId={activeId}
                      isSelected={selectedIds.has(item.node.id!)}
                      isExpanded={expandedIds.has(item.node.id!)}
                      onToggleExpand={() => toggleExpand(item.node.id!)}
                      onSelectChange={(value) => toggleSelection(item.node.id!, value)}
                      onRowClick={() => {
                        navigate({
                          to: "/exam-layouts/$layoutId",
                          params: { layoutId: String(item.node.id) },
                        });
                      }}
                      getRowActions={(showDefaultToggle) => {
                        const actions: React.ReactNode[] = [];
                        if (showDefaultToggle) {
                          actions.push(
                            <Button
                              key="default"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 p-1"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSetDefault(item.node.id);
                              }}
                              title={item.node.is_default ? "הסר מברירת מחדל" : "הגדר כברירת מחדל"}
                              disabled={isProcessing[item.node.id || 0]}
                            >
                              <Star
                                className={`h-5 w-5 transition-colors ${
                                  item.node.is_default ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                                }`}
                              />
                            </Button>
                          );
                        }
                        actions.push(
                          <Button
                            key="delete"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(event) => handleDeleteLayout(item.node.id, event)}
                            title="מחק פריסה"
                            disabled={isProcessing[item.node.id || 0]}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        );
                        return actions;
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
          <p className="text-sm text-muted-foreground">הקבוצה תכיל {selectedIds.size} פריסות שנבחרו</p>
        </div>
      </CustomModal>
    </div>
  );
}