import React, { useState, ChangeEvent, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { PencilIcon, SaveIcon, TrashIcon } from "lucide-react"
import { useParams } from "@tanstack/react-router"
import { getMedicalLogsByClientId, createMedicalLog } from "@/lib/db/medical-logs-db"
import { MedicalLog } from "@/lib/db/schema"

type MedicalRecord = MedicalLog & {
  isEditing?: boolean
  isDatePickerOpen?: boolean
  tempDateValue?: string
}

export const ClientMedicalRecordTab = () => {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const datePickerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  useEffect(() => {
    const loadMedicalLogs = async () => {
      try {
        setLoading(true)
        const logs = await getMedicalLogsByClientId(Number(clientId))
        setRecords(logs.map(log => ({
          ...log,
          isEditing: false,
          isDatePickerOpen: false
        })))
      } catch (error) {
        console.error('Error loading medical logs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMedicalLogs()
  }, [clientId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      records.forEach(record => {
        if (record.isDatePickerOpen && record.id !== undefined) {
          const pickerElement = datePickerRefs.current[record.id]
          if (pickerElement && !pickerElement.contains(event.target as Node)) {
            if (record.tempDateValue) {
              const newDate = new Date(record.tempDateValue)
              if (!isNaN(newDate.getTime())) {
                setRecords(prevRecords => 
                  prevRecords.map(r => 
                    r.id === record.id ? { ...r, log_date: record.tempDateValue, isDatePickerOpen: false, tempDateValue: undefined } : r
                  )
                )
                toast.success("תאריך הרשומה עודכן בהצלחה")
                return
              }
            }
            
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
      id: 0,
      client_id: Number(clientId),
      log_date: new Date().toISOString().split('T')[0],
      log: "",
      isEditing: true,
      isDatePickerOpen: false
    }
    setRecords([newRecord, ...records])
  }

  const handleContentChange = (id: number, content: string) => {
    setRecords(
      records.map(record =>
        record.id === id ? { ...record, log: content } : record
      )
    )
  }

  const saveRecord = async (id: number) => {
    const record = records.find(r => r.id === id)
    if (!record) return

    try {
      if (id === 0) {
        const newLog = await createMedicalLog({
          client_id: Number(clientId),
          log_date: record.log_date || new Date().toISOString().split('T')[0],
          log: record.log || ""
        })
        
        if (newLog) {
          setRecords(prev => 
            prev.map(r => 
              r.id === id ? { ...newLog, isEditing: false } : r
            )
          )
          toast.success("הרשומה נשמרה בהצלחה")
        } else {
          toast.error("שגיאה בשמירת הרשומה")
        }
      } else {
        setRecords(prev =>
          prev.map(r =>
            r.id === id ? { ...r, isEditing: false } : r
          )
        )
        toast.success("הרשומה עודכנה בהצלחה")
      }
    } catch (error) {
      toast.error("שגיאה בשמירת הרשומה")
    }
  }

  const editRecord = (id: number) => {
    setRecords(
      records.map(record =>
        record.id === id ? { ...record, isEditing: true } : record
      )
    )
  }

  const deleteRecord = (id: number) => {
    if (id === 0) {
      setRecords(records.filter(record => record.id !== id))
    } else {
      setRecords(records.filter(record => record.id !== id))
    }
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
            tempDateValue: !r.isDatePickerOpen ? r.log_date : r.tempDateValue 
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
    
    if (inputValue.length === 10) {
      const newDate = new Date(inputValue)
      if (!isNaN(newDate.getTime())) {
        setRecords(prevRecords =>
          prevRecords.map(record =>
            record.id === id ? { ...record, log_date: inputValue } : record
          )
        )
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-lg">טוען רשומות רפואיות...</div>
      </div>
    )
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
          <div className="space-y-8">
            {records.map((record, index) => (
              <div key={record.id ?? `new-${index}`} className="relative">
                {index < records.length - 1 && (
                  <div className="absolute top-6 h-[calc(100%+2rem-6px)] right-3 w-0.5 bg-muted" />
                )}

                <div className="relative h-6">
                  <div className="absolute right-3 w-6 h-6 bg-primary rounded-full -mr-3 z-10 flex items-center justify-center">
                    <div className="w-2 h-2 bg-background rounded-full" />
                  </div>

                  <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center">
                    <div className="relative mr-3">
                      <span 
                        className="text-sm text-muted-foreground cursor-pointer hover:text-primary"
                        onClick={() => record.id !== undefined && toggleDatePicker(record.id)}
                      >
                        {record.log_date ? formatDate(record.log_date) : 'תאריך לא זמין'}
                      </span>
                      
                      {record.isDatePickerOpen && record.id !== undefined && (
                        <div 
                          className="absolute top-6 right-0 z-50 bg-background p-1 rounded-md border shadow-md" 
                          ref={(el) => { datePickerRefs.current[record.id!] = el }}
                        >
                          <input
                            type="date"
                            value={record.tempDateValue || record.log_date || ''}
                            onChange={(e) => record.id !== undefined && handleDateInputChange(record.id, e)}
                            className="text-sm border rounded px-2 py-1"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="mr-1 flex gap-1">
                      {record.isEditing ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => record.id !== undefined && saveRecord(record.id)}
                          className="h-8 w-8 p-0"
                        >
                          <SaveIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => record.id !== undefined && editRecord(record.id)}
                          className="h-8 w-8 p-0"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => record.id !== undefined && deleteRecord(record.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="mr-14 border-none shadow-none">
                  <CardContent className=" border-none">
                    {record.isEditing ? (
                      <Textarea
                        value={record.log || ""}
                        onChange={(e) => record.id !== undefined && handleContentChange(record.id, e.target.value)}
                        placeholder="הזן את תוכן הרשומה הרפואית..."
                        className="min-h-[100px] resize-none"
                        dir="rtl"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm" dir="rtl">
                        {record.log || "אין תוכן"}
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