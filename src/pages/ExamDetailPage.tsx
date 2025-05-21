import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, getEyeExamsByExamId, updateExam, updateEyeExam } from "@/lib/db/exams-db"
import { OpticalExam, OpticalEyeExam } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

// Custom label component with underline
function LabelWithUnderline({ children }: { children: React.ReactNode }) {
  return (
    <Label className="border-none pb-1 mb-1 inline-block border-black">
      {children}
    </Label>
  )
}

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

function DateInput({ name, value, onChange, className }: DateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-1">
      <div 
        className={`text-right pr-10 cursor-pointer h-9 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="absolute opacity-0 h-0 w-0 overflow-hidden"
      />
      
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-5 w-5 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

// Component for eye prescription data display/edit
function EyeExamComponent({
  eyeExam,
  eyeFormData,
  handleEyeInputChange,
  isEditing,
  eyeLabel,
  headerClassName
}: {
  eyeExam: OpticalEyeExam;
  eyeFormData: OpticalEyeExam;
  handleEyeInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEditing: boolean;
  eyeLabel: string;
  headerClassName: string;
}) {
  return (
    <div className="rounded-md border mb-2 overflow-hidden">
      <div className={`flex items-center justify-between p-2 ${headerClassName}`}>
        <h3 className="font-bold">{eyeLabel}</h3>
      </div>
      <div className="flex flex-col gap-y-4 p-2 mb-2" dir="rtl">
        {/* Row 1: Previous Prescription and Objective */}
        <div className="flex">
          {/* Previous Prescription section */}
          <div className="w-[49%] grid grid-cols-5 gap-x-2">
            <div className="col-span-1 font-semibold flex items-center">מרשם קודם:</div>
            <div className="col-span-1">
              <label>SPH</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="old_sph"
                  value={eyeFormData.old_sph?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.old_sph}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>CYL</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="old_cyl"
                  value={eyeFormData.old_cyl?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.old_cyl}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>AX</label>
              {isEditing ? (
                <Input 
                  type="number"
                  name="old_ax"
                  value={eyeFormData.old_ax?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.old_ax}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>VA</label>
              {isEditing ? (
                <Input 
                  type="text"
                  name="old_va"
                  value={eyeFormData.old_va || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.old_va}</div>
              )}
            </div>
          </div>
          
          {/* Thin Separator */}
          <div className="px-2 flex justify-center items-center">
            <div className="h-full w-px bg-gray-200"></div>
          </div>
          
          {/* Objective section */}
          <div className="w-[49%] grid grid-cols-5 gap-x-2">
            <div className="col-span-1 font-semibold flex items-center">אובייקטיבי:</div>
            <div className="col-span-1">
              <label>SPH</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="obj_sph"
                  value={eyeFormData.obj_sph?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.obj_sph}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>CYL</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="obj_cyl"
                  value={eyeFormData.obj_cyl?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.obj_cyl}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>AX</label>
              {isEditing ? (
                <Input 
                  type="number"
                  name="obj_ax"
                  value={eyeFormData.obj_ax?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.obj_ax}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>SE</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="obj_se"
                  value={eyeFormData.obj_se?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.obj_se}</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Row 2: Subjective and Additions */}
        <div className="flex">
          {/* Subjective section */}
          <div className="w-[49%] grid grid-cols-5 gap-x-2">
            <div className="col-span-1 font-semibold flex items-center">סובייקטיבי:</div>
            <div className="col-span-1">
              <label>SPH</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="subj_sph"
                  value={eyeFormData.subj_sph?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.subj_sph}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>CYL</label>
              {isEditing ? (
                <Input 
                  type="number"
                  step="0.25"
                  name="subj_cyl"
                  value={eyeFormData.subj_cyl?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.subj_cyl}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>AX</label>
              {isEditing ? (
                <Input 
                  type="number"
                  name="subj_ax"
                  value={eyeFormData.subj_ax?.toString() || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.subj_ax}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>VA</label>
              {isEditing ? (
                <Input 
                  type="text"
                  name="subj_va"
                  value={eyeFormData.subj_va || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.subj_va}</div>
              )}
            </div>
          </div>
          
          {/* Thin Separator */}
          <div className="px-2 flex justify-center items-center">
            <div className="h-full w-px bg-gray-200"></div>
          </div>
          
          {/* Additions section */}
          <div className="w-[49%] grid grid-cols-5 gap-x-2">
            <div className="col-span-1 font-semibold flex items-center">תוספות:</div>
            <div className="col-span-1">
              <label>קריאה</label>
              {isEditing ? (
                <Input 
                  type="text"
                  name="ad_read"
                  value={eyeFormData.ad_read || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.ad_read}</div>
              )}
            </div>
            <div className="col-span-1">
              <label>ביניים</label>
              {isEditing ? (
                <Input 
                  type="text"
                  name="ad_int"
                  value={eyeFormData.ad_int || ''}
                  onChange={handleEyeInputChange}
                  className="h-7 p-1"
                />
              ) : (
                <div className="border px-1 py-0.5 rounded h-7 flex items-center">{eyeExam.ad_int}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamDetailPage() {
  const { clientId, examId } = useParams({ from: "/clients/$clientId/exams/$examId" })
  const client = getClientById(Number(clientId))
  const exam = getExamById(Number(examId))
  const eyeExams = getEyeExamsByExamId(Number(examId))
  
  const rightEyeExam = eyeExams.find(e => e.eye === "R")
  const leftEyeExam = eyeExams.find(e => e.eye === "L")
  
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<OpticalExam>({} as OpticalExam)
  const [rightEyeFormData, setRightEyeFormData] = useState<OpticalEyeExam>({} as OpticalEyeExam)
  const [leftEyeFormData, setLeftEyeFormData] = useState<OpticalEyeExam>({} as OpticalEyeExam)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  useEffect(() => {
    if (exam) {
      setFormData({ ...exam })
    }
    if (rightEyeExam) {
      setRightEyeFormData({ ...rightEyeExam })
    }
    if (leftEyeExam) {
      setLeftEyeFormData({ ...leftEyeExam })
    }
  }, [exam, rightEyeExam, leftEyeExam])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleRightEyeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Convert numeric values
    let processedValue: string | number = value
    if (["old_sph", "old_cyl", "old_pris", "old_ad", "obj_sph", "obj_cyl", "obj_se", 
          "subj_sph", "subj_cyl", "subj_pris", "ad_mul", "ad_j"].includes(name)) {
      processedValue = value === "" ? "" : parseFloat(value)
    }
    if (["old_ax", "obj_ax", "subj_ax"].includes(name)) {
      processedValue = value === "" ? "" : parseInt(value, 10)
    }
    
    setRightEyeFormData(prev => ({ ...prev, [name]: processedValue }))
  }

  const handleLeftEyeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Convert numeric values
    let processedValue: string | number = value
    if (["old_sph", "old_cyl", "old_pris", "old_ad", "obj_sph", "obj_cyl", "obj_se", 
          "subj_sph", "subj_cyl", "subj_pris", "ad_mul", "ad_j"].includes(name)) {
      processedValue = value === "" ? "" : parseFloat(value)
    }
    if (["old_ax", "obj_ax", "subj_ax"].includes(name)) {
      processedValue = value === "" ? "" : parseInt(value, 10)
    }
    
    setLeftEyeFormData(prev => ({ ...prev, [name]: processedValue }))
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSave = () => {
    if (formRef.current) {
      // Update exam data
      const updatedExam = updateExam(formData)
      
      // Update right eye exam data
      const updatedRightEyeExam = updateEyeExam(rightEyeFormData)
      
      // Update left eye exam data
      const updatedLeftEyeExam = updateEyeExam(leftEyeFormData)
      
      if (updatedExam && updatedRightEyeExam && updatedLeftEyeExam) {
        setIsEditing(false)
        toast.success("פרטי הבדיקה עודכנו בהצלחה")
      } else {
        toast.error("לא הצלחנו לשמור את השינויים")
      }
    }
  }
  
  if (!client || !exam || !rightEyeExam || !leftEyeExam) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="לקוחות" backLink={`/clients/${clientId}`} />
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">בדיקה לא נמצאה</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader 
          title="לקוחות" 
          backLink={`/clients/${clientId}`}
          clientName={`${fullName} | בדיקה מס' ${examId}`}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">פרטי בדיקה</h2>
            <Button 
              variant={isEditing ? "outline" : "default"} 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              {isEditing ? "שמור שינויים" : "ערוך בדיקה"}
            </Button>
          </div>
          
          <form ref={formRef}>
            <div className="grid grid-cols-1 gap-4">
              <div className="border rounded-md p-3">
                <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                  <div className="col-span-1">
                    <label className="font-semibold">תאריך בדיקה</label>
                    {isEditing ? (
                      <DateInput
                        name="exam_date"
                        value={formData.exam_date}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <div className="border p-1 rounded text-sm h-7 flex items-center">
                        {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('he-IL') : ''}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold">שם הבדיקה</label>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="test_name"
                        value={formData.test_name || ''}
                        onChange={handleInputChange}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="border p-1 rounded text-sm h-7 flex items-center">{exam.test_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold">מרפאה</label>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="clinic"
                        value={formData.clinic || ''}
                        onChange={handleInputChange}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="border p-1 rounded text-sm h-7 flex items-center">{exam.clinic}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold">שם הבודק</label>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="examiner_name"
                        value={formData.examiner_name || ''}
                        onChange={handleInputChange}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="border p-1 rounded text-sm h-7 flex items-center">{exam.examiner_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold">עין דומיננטית</label>
                    {isEditing ? (
                      <Select 
                        value={formData.dominant_eye || ''} 
                        onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                      >
                        <SelectTrigger className="h-7 text-sm">
                          <SelectValue placeholder="בחר עין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R">ימין</SelectItem>
                          <SelectItem value="L">שמאל</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="border p-1 rounded text-sm h-7 flex items-center">
                        {exam.dominant_eye === 'R' ? 'ימין' : 'שמאל'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                {/* Right Eye Data */}
                <EyeExamComponent
                  eyeExam={rightEyeExam}
                  eyeFormData={rightEyeFormData}
                  handleEyeInputChange={handleRightEyeInputChange}
                  isEditing={isEditing}
                  eyeLabel="עין ימין"
                  headerClassName="bg-blue-50"
                />
                
                {/* Left Eye Data */}
                <EyeExamComponent
                  eyeExam={leftEyeExam}
                  eyeFormData={leftEyeFormData}
                  handleEyeInputChange={handleLeftEyeInputChange}
                  isEditing={isEditing}
                  eyeLabel="עין שמאל"
                  headerClassName="bg-red-50"
                />
              </div>
              
              {/* Notes Section */}
              <div className="border rounded-md p-4">
                <label className="block text-lg font-semibold mb-2">הערות</label>
                {isEditing ? (
                  <textarea 
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                    rows={4}
                  />
                ) : (
                  <div className="border p-3 rounded min-h-[100px] whitespace-pre-wrap">
                    {exam.notes || 'אין הערות'}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 