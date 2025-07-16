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
import { ExamLayout } from "@/lib/db/schema";
import { toast } from "sonner";
import { deleteExamLayout, updateExamLayout } from "@/lib/db/exam-layouts-db";

interface ExamLayoutsTableProps {
  data: ExamLayout[];
  onRefresh: () => void;
}

export function ExamLayoutsTable({ data, onRefresh }: ExamLayoutsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localData, setLocalData] = useState<ExamLayout[]>(data);
  const [isProcessing, setIsProcessing] = useState<{[key: number]: boolean}>({});
  const navigate = useNavigate();

  // Update local data when props change
  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  const filteredData = localData.filter((layout) => {
    return layout.name && layout.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateNew = (type: 'exam' | 'opticlens') => {
    const layoutCount = localData.length + 1;
    navigate({
      to: "/exam-layouts/new",
      search: { name: `פריסה ${layoutCount}`, type: type }
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

  const handleDeleteLayout = async (layoutId: number | undefined, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click from triggering
    if (!layoutId) return;

    // Prevent multiple clicks
    if (isProcessing[layoutId]) return;
    setIsProcessing(prev => ({ ...prev, [layoutId]: true }));

    try {
      // Optimistically update UI first
      const updatedLayouts = localData.filter(layout => layout.id !== layoutId);
      setLocalData(updatedLayouts);

      // Then delete from database
      const success = await deleteExamLayout(layoutId);
      if (success) {
        toast.success("הפריסה הוסרה בהצלחה");
        
        // Trigger refresh in parent component without causing a flicker
        onRefresh();
        
        // Clear processing state
        setTimeout(() => {
          setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
        }, 300);
      } else {
        toast.error("שגיאה בהסרת הפריסה");
        // Revert optimistic update
        setLocalData(data);
        setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
      }
    } catch (error) {
      console.error("Error deactivating layout:", error);
      toast.error("שגיאה בהסרת הפריסה");
      // Revert optimistic update
      setLocalData(data);
      setIsProcessing(prev => ({ ...prev, [layoutId]: false }));
    }
  };

  const examLayouts = filteredData.filter(layout => layout.type === 'exam' || !layout.type)
  const contactLensLayouts = filteredData.filter(layout => layout.type === 'opticlens')

  const renderTable = (layouts: ExamLayout[], title: string, type: 'exam' | 'opticlens') => (
    <div className="space-y-2 bg-transparent" dir="rtl">
      <div className="flex items-center justify-between px-1">
      <h3 className="text-lg  text-muted-foreground">{title}</h3>

      <Button onClick={() => handleCreateNew(type)} className="bg-card shadow-none text-card-foreground hover:bg-accent size-8 border">
          <Plus className="h-4 w-4" />
        </Button>

      </div>
      <div className="rounded-md border bg-card">
        <Table dir="rtl" className="">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם הפריסה</TableHead>
              <TableHead className="text-right">ברירת מחדל</TableHead>
              <TableHead className="text-right">תאריך יצירה</TableHead>
              <TableHead className="text-right">עדכון אחרון</TableHead>
              <TableHead className="w-[100px] text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {layouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  לא נמצאו פריסות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              layouts.map((layout) => (
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
    </div>
  )

  return (
    <div className="space-y-6" dir="rtl">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTable(examLayouts, "פריסות בדיקה", 'exam')}
        {renderTable(contactLensLayouts, "פריסות עדשות מגע", 'opticlens')}
      </div>
    </div>
  );
} 