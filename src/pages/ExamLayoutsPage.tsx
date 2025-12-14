import React, { useState, useEffect, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { ExamLayoutsTable } from "@/components/exam-layouts-table"
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db"
import { ExamLayout } from "@/lib/db/schema-interface"

export default function ExamLayoutsPage() {
  const [layouts, setLayouts] = useState<ExamLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const loadLayouts = useCallback(async () => {
    try {
      // Only show loading indicator on initial load
      if (layouts.length === 0) {
        setLoading(true);
      }

      const storedClinic = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedClinic') : null
      const parsedClinic = storedClinic ? JSON.parse(storedClinic) : null
      const clinicId = typeof parsedClinic?.id === 'number' ? parsedClinic.id : undefined

      const layoutsData = await getAllExamLayouts(clinicId)
      
      // Use functional update to ensure we're working with the latest state
      setLayouts(layoutsData)
    } catch (error) {
      console.error('Error loading exam layouts:', error)
    } finally {
      setLoading(false)
    }
  }, [layouts.length])

  // Trigger refresh without showing loading state
  const handleRefresh = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Initial load and background refreshes
  useEffect(() => {
    loadLayouts()
  }, [refreshCounter, loadLayouts])

  if (loading) {
    return (
      <>
        <SiteHeader 
          title="פריסות בדיקה"
          parentTitle="הגדרות"
          parentLink="/settings"
        />
        <div className="flex flex-col items-center justify-center h-full">
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader 
        title="פריסות בדיקה"
        parentTitle="הגדרות"
        parentLink="/settings"
      />
      <div className="flex flex-col flex-1 p-4 lg:pt-4 lg:p-6 mb-10" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">ניהול פריסות בדיקה</h2>
        </div>
        
        <ExamLayoutsTable data={layouts} onRefresh={handleRefresh} />
      </div>
    </>
  )
} 