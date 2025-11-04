import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { Plus, Star, Trash2 } from "lucide-react";
import { ExamLayout } from "@/lib/db/schema-interface";
import { toast } from "sonner";
import { deleteExamLayout, updateExamLayout } from "@/lib/db/exam-layouts-db";
import { CustomModal } from "@/components/ui/custom-modal";

interface ExamLayoutsTableProps {
  data: ExamLayout[];
  onRefresh: () => void;
}

export function ExamLayoutsTable({ data, onRefresh }: ExamLayoutsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localData, setLocalData] = useState<ExamLayout[]>(data);
  const [isProcessing, setIsProcessing] = useState<{[key: number]: boolean}>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<ExamLayout | null>(null);
  const navigate = useNavigate();

  // Update local data when props change
  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  const filteredData = localData.filter((layout) => {
    return layout.name && layout.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateNew = () => {
    const layoutCount = localData.length + 1;
    navigate({
      to: "/exam-layouts/new",
      search: { name: `פריסה ${layoutCount}` }
    });
  };

  const handleSetDefault = async (layoutId: number | undefined) => {
    if (!layoutId) return;
    
    // Prevent multiple clicks
    if (isProcessing[layoutId]) return;
    setIsProcessing(prev => ({ ...prev, [layoutId]: true }));

    try {
      const layoutToUpdate = data.find(layout => layout.id === layoutId);
      if (!layoutToUpdate) return;

      const newDefaultStatus = !layoutToUpdate.is_default;

      // Check if trying to remove the last default layout
      if (!newDefaultStatus) {
        const defaultLayouts = data.filter(layout => layout.is_default);
        
        if (defaultLayouts.length <= 1) {
          toast.error("חייב להיות לפחות פריסת ברירת מחדל אחת");
          setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
          return;
        }
      }

      // Optimistically update UI first
      const updatedLayouts = localData.map(layout => ({
        ...layout,
        is_default: layout.id === layoutId ? newDefaultStatus : layout.is_default
      }));
      setLocalData(updatedLayouts);

      // Then update in database
      await updateExamLayout({
        ...layoutToUpdate,
        is_default: newDefaultStatus
      });

      const message = newDefaultStatus ? "הפריסה הוגדרה כברירת מחדל" : "הפריסה הוסרה מברירת מחדל";
      toast.success(message);
      
      // Trigger refresh in parent component without causing a flicker
      onRefresh();
      
      // Clear processing state
      setTimeout(() => {
        setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
      }, 300);
    } catch (error) {
      console.error("Error setting default layout:", error);
      toast.error("שגיאה בהגדרת פריסת ברירת מחדל");
      // Revert optimistic update
      setLocalData(data);
      setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
    }
  };

  const handleDeleteLayout = (layoutId: number | undefined, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!layoutId) return;

    if (isProcessing[layoutId]) return;

    const layout = localData.find(l => l.id === layoutId);
    if (!layout) return;
    
    if (localData.length <= 1) {
      toast.error("לא ניתן למחוק את הפריסה האחרונה. חייבת להיות לפחות פריסה אחת");
      return;
    }

    setLayoutToDelete(layout);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!layoutToDelete || !layoutToDelete.id) return;

    const layoutId = layoutToDelete.id;
    setIsDeleting(true);

    try {
      const success = await deleteExamLayout(layoutId);
      if (success) {
        toast.success("הפריסה הוסרה בהצלחה");
        onRefresh();
      } else {
        toast.error("שגיאה בהסרת הפריסה");
      }
    } catch (error) {
      console.error("Error deactivating layout:", error);
      toast.error("שגיאה בהסרת הפריסה");
    } finally {
      setIsDeleting(false);
      setLayoutToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };



  return (
    <div className="space-y-6 mb-10" dir="rtl">
      <div className="flex items-center justify-between">
        <Input
          placeholder="חיפוש פריסות..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={handleCreateNew} className="bg-card shadow-none text-card-foreground hover:bg-accent border">
          <Plus className="h-4 w-4 mr-2" />
          פריסה חדשה
        </Button>
      </div>

      <div className="rounded-md bg-card">
        <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="text-right">שם הפריסה</TableHead>
              <TableHead className="text-right">ברירת מחדל</TableHead>
              <TableHead className="text-right">תאריך יצירה</TableHead>
              <TableHead className="text-right">עדכון אחרון</TableHead>
              <TableHead className="w-[100px] text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  לא נמצאו פריסות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((layout) => (
                <TableRow
                  key={layout.id}
                  className="cursor-pointer"
                  onClick={() => {
                    navigate({
                      to: "/exam-layouts/$layoutId",
                      params: { layoutId: String(layout.id) },
                    });
                  }}
                >
                  <TableCell className="font-medium">{layout.name}</TableCell>
                  <TableCell>{layout.is_default ? "כן" : "לא"}</TableCell>
                  <TableCell>
                    {layout.created_at
                      ? new Date(layout.created_at).toLocaleDateString("he-IL")
                      : ""}
                  </TableCell>
                  <TableCell>
                    {layout.updated_at
                      ? new Date(layout.updated_at).toLocaleDateString("he-IL")
                      : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(layout.id);
                        }}
                        title={layout.is_default ? "הסר מברירת מחדל" : "הגדר כברירת מחדל"}
                        disabled={isProcessing[layout.id || 0]}
                      >
                        <Star 
                          className={`h-5 w-5 transition-colors ${layout.is_default ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} 
                        />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 p-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDeleteLayout(layout.id, e)}
                        title="מחק פריסה"
                        disabled={isProcessing[layout.id || 0]}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="מחיקת פריסה"
        description={layoutToDelete ? `האם אתה בטוח שברצונך למחוק את הפריסה "${layoutToDelete.name}"? פעולה זו אינה הפיכה.` : "האם אתה בטוח שברצונך למחוק פריסה זו? פעולה זו אינה הפיכה."}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
        isLoading={isDeleting}
      />
    </div>
  );
} 