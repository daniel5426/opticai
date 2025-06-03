import React, { useState, ChangeEvent, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { PencilIcon, SaveIcon, TrashIcon } from "lucide-react"

type MedicalRecord = {
  id: number
  date: Date
  content: string
  isEditing?: boolean
  isDatePickerOpen?: boolean
  tempDateValue?: string
}

export const ClientMedicalRecordTab = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [nextId, setNextId] = useState(1)
  const datePickerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      records.forEach(record => {
        if (record.isDatePickerOpen) {
          const pickerElement = datePickerRefs.current[record.id]
          if (pickerElement && !pickerElement.contains(event.target as Node)) {
            // Apply the date if tempDateValue is valid
            if (record.tempDateValue) {
              const newDate = new Date(record.tempDateValue)
              if (!isNaN(newDate.getTime())) {
                setRecords(prevRecords => 
                  prevRecords.map(r => 
                    r.id === record.id ? { ...r, date: newDate, isDatePickerOpen: false, tempDateValue: undefined } : r
                  )
                )
                toast.success("תאריך הרשומה עודכן בהצלחה")
                return
              }
            }
            
            // Just close the picker if no valid date
            setRecords(prevRecords => 
              prevRecords.map(r => 
                r.id === record.id ? { ...r, isDatePickerOpen: false, tempDateValue: undefined } : r
              )
            )
          }
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [records])

  const addNewRecord = () => {
    const newRecord: MedicalRecord = {
      id: nextId,
      date: new Date(),
      content: "",
      isEditing: true,
      isDatePickerOpen: false
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

  const deleteRecord = (id: number) => {
    setRecords(records.filter(record => record.id !== id))
    toast.success("הרשומה נמחקה בהצלחה")
  }

  const toggleDatePicker = (id: number) => {
    const record = records.find(r => r.id === id)
    if (record) {
      setRecords(
        records.map(r =>
          r.id === id ? { 
            ...r, 
            isDatePickerOpen: !r.isDatePickerOpen,
            tempDateValue: !r.isDatePickerOpen ? formatDateForInput(r.date) : r.tempDateValue 
          } : r
        )
      )
    }
  }

  const handleDateInputChange = (id: number, e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setRecords(
      records.map(record =>
        record.id === id ? { ...record, tempDateValue: inputValue } : record
      )
    )
    
    // Only update the actual date if we have a complete, valid date
    if (inputValue.length === 10) { // YYYY-MM-DD format is 10 chars
      const newDate = new Date(inputValue)
      if (!isNaN(newDate.getTime())) {
        setRecords(prevRecords =>
          prevRecords.map(record =>
            record.id === id ? { ...record, date: newDate } : record
          )
        )
      }
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-6">
        <Button onClick={addNewRecord}>הוספת רשומה חדשה</Button>
        <h2 className="text-xl font-semibold">רשומות רפואיות</h2>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground" dir="rtl">
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

                  {/* Date positioned to the right of dot with actions */}
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center">
                    {/* Date display */}
                    <div className="relative">
                      <span 
                        className="text-sm text-muted-foreground cursor-pointer hover:text-primary"
                        onClick={() => toggleDatePicker(record.id)}
                      >
                        {formatDate(record.date)}
                      </span>
                      
                      {record.isDatePickerOpen && (
                        <div 
                          className="absolute top-6 right-0 z-50 bg-background p-1 rounded-md border shadow-md" 
                          ref={(el) => { datePickerRefs.current[record.id] = el }}
                        >
                          <input
                            type="date"
                            value={record.tempDateValue || formatDateForInput(record.date)}
                            onChange={(e) => handleDateInputChange(record.id, e)}
                            className="text-sm p-1"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>

                    {/* Action icons */}
                    <div className="flex items-center mr-2 space-x-2">
                      {record.isEditing ? (
                        <SaveIcon
                          className="h-3.5 w-3.5 ml-2 text-primary cursor-pointer hover:text-primary/80"
                          onClick={() => saveRecord(record.id)}
                        />
                      ) : (
                        <PencilIcon
                          className="h-3.5 w-3.5 ml-2 text-muted-foreground cursor-pointer hover:text-primary"
                          onClick={() => editRecord(record.id)}
                        />
                      )}
                      <TrashIcon
                        className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-destructive"
                        onClick={() => deleteRecord(record.id)}
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline content */}
                <Card className="mr-10 border-none shadow-none">
                  <CardContent className="p-1" dir="rtl">
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