import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { ExamLayoutsTable } from "@/components/exam-layouts-table"
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db"
import { ExamLayout } from "@/lib/db/schema"

export default function ExamLayoutsPage() {
  const [layouts, setLayouts] = useState<ExamLayout[]>([])
  const [loading, setLoading] = useState(true)

  const loadLayouts = async () => {
    try {
      setLoading(true)
      const layoutsData = await getAllExamLayouts()
      setLayouts(layoutsData)
    } catch (error) {
      console.error('Error loading exam layouts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLayouts()
  }, [])

  if (loading) {
    return (
      <>
        <SiteHeader 
          title="פריסות בדיקה"
          backLink="/"
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">טוען נתונים...</h1>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader 
        title="פריסות בדיקה"
        backLink="/"
      />
      <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">ניהול פריסות בדיקה</h2>
        </div>
        
        <ExamLayoutsTable data={layouts} onRefresh={loadLayouts} />
      </div>
    </>
  )
} 