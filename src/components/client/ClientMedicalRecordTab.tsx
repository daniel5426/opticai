import React, { useState, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type MedicalRecord = {
  id: number
  date: Date
  content: string
  isEditing?: boolean
}

export const ClientMedicalRecordTab = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [nextId, setNextId] = useState(1)

  const addNewRecord = () => {
    const newRecord: MedicalRecord = {
      id: nextId,
      date: new Date(),
      content: "",
      isEditing: true
    }
    setRecords([newRecord, ...records])
    setNextId(nextId + 1)
  }

  const handleContentChange = (id: number, content: string) => {
    setRecords(
      records.map(record => 
        record.id === id ? { ...record, content } : record
      )
    )
  }

  const saveRecord = (id: number) => {
    setRecords(
      records.map(record => 
        record.id === id ? { ...record, isEditing: false } : record
      )
    )
    toast.success("הרשומה נשמרה בהצלחה")
  }

  const editRecord = (id: number) => {
    setRecords(
      records.map(record => 
        record.id === id ? { ...record, isEditing: true } : record
      )
    )
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-6">
      <Button onClick={addNewRecord}>הוספת רשומה חדשה</Button>
        <h2 className="text-xl font-semibold">רשומות רפואיות</h2>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          אין רשומות רפואיות להצגה. לחץ על "הוספת רשומה חדשה" כדי להתחיל.
        </div>
      ) : (
        <div className="relative mr-6">
          {/* Timeline items */}
          <div className="space-y-8">
            {records.map((record, index) => (
              <div key={record.id} className="relative">
                {/* Timeline vertical line segment (only between dots) */}
                {index < records.length - 1 && (
                  <div className="absolute top-6 h-[calc(100%+2rem-6px)] right-3 w-0.5 bg-muted" />
                )}
                
                {/* Timeline container with dot and date */}
                <div className="relative h-6">
                  {/* Timeline dot */}
                  <div className="absolute right-3 w-6 h-6 bg-primary rounded-full -mr-3 z-10 flex items-center justify-center">
                    <div className="w-2 h-2 bg-background rounded-full" />
                  </div>
                  
                  {/* Date positioned to the right of dot */}
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {formatDate(record.date)}
                  </div>
                </div>

                {/* Timeline content */}
                <Card className="mr-10 border-none shadow-none">
                  <CardContent className="p-4" dir="rtl">
                    <div className="flex justify-between items-center mb-2">
                      {record.isEditing ? (
                        <Button 
                          size="sm" 
                          onClick={() => saveRecord(record.id)}
                        >
                          שמור
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => editRecord(record.id)}
                        >
                          ערוך
                        </Button>
                      )}
                    </div>
                    
                    {record.isEditing ? (
                      <Textarea
                        value={record.content}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleContentChange(record.id, e.target.value)}
                        placeholder="הכנס תוכן רשומה רפואית..."
                        className="min-h-[100px]"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {record.content || <span className="text-muted-foreground italic">אין תוכן</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 