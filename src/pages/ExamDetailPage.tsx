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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

// Custom label component with underline - This component is not used in the current file.
// function LabelWithUnderline({ children }: { children: React.ReactNode }) {
//   return (
//     <Label className="border-none pb-1 mb-1 inline-block border-black">
//       {children}
//     </Label>
//   )
// }

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

function DateInput({ name, value, onChange, className, disabled }: DateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current && !disabled) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-1">
      <div 
        className={`text-sm text-right pr-10 h-8 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'} ${className || ''}`}
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
        disabled={disabled}
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

// Section Components for Optical Eye Exam

interface EyeSectionProps {
  eye: "R" | "L";
  data: OpticalEyeExam;
  onChange: (eye: "R" | "L", field: keyof OpticalEyeExam, value: string) => void;
  isEditing: boolean;
}

function PreviousObjectiveSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";
  const bgColor = eye === "R" ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Previous Prescription - 7 columns */}
        <div>
          <Label htmlFor={`${eye}-old-sph`} className="text-[12px] block text-center">SPH</Label>
          <Input id={`${eye}-old-sph`} type="number" step="0.25" value={data.old_sph?.toString() || ""} onChange={(e) => onChange(eye, "old_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div>
          <Label htmlFor={`${eye}-old-cyl`} className="text-[12px] block text-center">CYL</Label>
          <Input id={`${eye}-old-cyl`} type="number" step="0.25" value={data.old_cyl?.toString() || ""} onChange={(e) => onChange(eye, "old_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div>
          <Label htmlFor={`${eye}-old-ax`} className="text-[12px] block text-center">AXIS</Label>
          <Input id={`${eye}-old-ax`} type="number" min="0" max="180" value={data.old_ax?.toString() || ""} onChange={(e) => onChange(eye, "old_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div>
          <Label htmlFor={`${eye}-old-pris`} className="text-[12px] block text-center">PRIS</Label>
          <Input id={`${eye}-old-pris`} type="number" step="0.5" value={data.old_pris?.toString() || ""} onChange={(e) => onChange(eye, "old_pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="text-xs">
          <Label htmlFor={`${eye}-old-base`} className="text-[12px] block text-center">BASE</Label>
          <Select value={data.old_base || ""} onValueChange={(value) => onChange(eye, "old_base", value)} disabled={!isEditing}>
            <SelectTrigger id={`${eye}-old-base`} className="h-8 px-1 w-full"><SelectValue placeholder="..." /></SelectTrigger>
            <SelectContent><SelectItem value="in">In</SelectItem><SelectItem value="out">Out</SelectItem><SelectItem value="up">Up</SelectItem><SelectItem value="down">Down</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>
          <Input id={`${eye}-old-va`} value={data.old_va || ""} onChange={(e) => onChange(eye, "old_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="20/20" />
        </div>
        <div>
          <Label htmlFor={`${eye}-old-ad`} className="text-[12px] block text-center">ADD</Label>
          <Input id={`${eye}-old-ad`} type="number" step="0.25" value={data.old_ad?.toString() || ""} onChange={(e) => onChange(eye, "old_ad", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>

        {/* Delimiter */}
        <div className="flex items-end justify-center"><div className="w-px h-full bg-gray-300"></div></div>

        {/* Objective Refraction - 4 columns */}
        <div>
          <Label htmlFor={`${eye}-obj-sph`} className="text-[12px] block text-center">SPH</Label>
          <Input id={`${eye}-obj-sph`} type="number" step="0.25" value={data.obj_sph?.toString() || ""} onChange={(e) => onChange(eye, "obj_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div>
          <Label htmlFor={`${eye}-obj-cyl`} className="text-[12px] block text-center">CYL</Label>
          <Input id={`${eye}-obj-cyl`} type="number" step="0.25" value={data.obj_cyl?.toString() || ""} onChange={(e) => onChange(eye, "obj_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div>
          <Label htmlFor={`${eye}-obj-ax`} className="text-[12px] block text-center">AXIS</Label>
          <Input id={`${eye}-obj-ax`} type="number" min="0" max="180" value={data.obj_ax?.toString() || ""} onChange={(e) => onChange(eye, "obj_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div>
          <Label htmlFor={`${eye}-obj-se`} className="text-[12px] block text-center">SE</Label>
          <Input id={`${eye}-obj-se`} type="number" step="0.25" value={data.obj_se?.toString() || ""} onChange={(e) => onChange(eye, "obj_se", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
      </div>
      <span className="text-md font-medium pr-2 self-center text-center pt-4">{eyeLabel}</span>
    </div>
  );
}

function SubjectiveSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";
  const bgColor = eye === "R" ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-9 gap-4 flex-1">
        <div><Label htmlFor={`${eye}-subj-fa`} className="text-[12px] block text-center">FA</Label><Input id={`${eye}-subj-fa`} value={data.subj_fa || ""} onChange={(e) => onChange(eye, "subj_fa", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FA" /></div>
        <div><Label htmlFor={`${eye}-subj-sph`} className="text-[12px] block text-center">SPH</Label><Input id={`${eye}-subj-sph`} type="number" step="0.25" value={data.subj_sph?.toString() || ""} onChange={(e) => onChange(eye, "subj_sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" /></div>
        <div><Label htmlFor={`${eye}-subj-cyl`} className="text-[12px] block text-center">CYL</Label><Input id={`${eye}-subj-cyl`} type="number" step="0.25" value={data.subj_cyl?.toString() || ""} onChange={(e) => onChange(eye, "subj_cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" /></div>
        <div><Label htmlFor={`${eye}-subj-ax`} className="text-[12px] block text-center">AXIS</Label><Input id={`${eye}-subj-ax`} type="number" min="0" max="180" value={data.subj_ax?.toString() || ""} onChange={(e) => onChange(eye, "subj_ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" /></div>
        <div><Label htmlFor={`${eye}-subj-pris`} className="text-[12px] block text-center">PRIS</Label><Input id={`${eye}-subj-pris`} type="number" step="0.5" value={data.subj_pris?.toString() || ""} onChange={(e) => onChange(eye, "subj_pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" /></div>
        <div>
          <Label htmlFor={`${eye}-subj-base`} className="text-[12px] block text-center">BASE</Label>
          <Select value={data.subj_base || ""} onValueChange={(value) => onChange(eye, "subj_base", value)} disabled={!isEditing}>
            <SelectTrigger id={`${eye}-subj-base`} className="h-8 px-1 w-full"><SelectValue placeholder="..." /></SelectTrigger>
            <SelectContent><SelectItem value="in">In</SelectItem><SelectItem value="out">Out</SelectItem><SelectItem value="up">Up</SelectItem><SelectItem value="down">Down</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label htmlFor={`${eye}-subj-va`} className="text-[12px] block text-center">VA</Label><Input id={`${eye}-subj-va`} value={data.subj_va || ""} onChange={(e) => onChange(eye, "subj_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="20/20" /></div>
        <div><Label htmlFor={`${eye}-subj-pd`} className="text-[12px] block text-center">PD</Label><Input id={`${eye}-subj-pd`} value={data.subj_pd || ""} onChange={(e) => onChange(eye, "subj_pd", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PD" /></div>
        <div><Label htmlFor={`${eye}-subj-ph`} className="text-[12px] block text-center">PH</Label><Input id={`${eye}-subj-ph`} value={data.subj_ph || ""} onChange={(e) => onChange(eye, "subj_ph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="PH" /></div>
      </div>
      <span className="text-md font-medium pr-2 self-center text-center pt-4">{eyeLabel}</span>
    </div>
  );
}

function AdditionSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";
  const bgColor = eye === "R" ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-6 gap-4 flex-1">
        <div><Label htmlFor={`${eye}-ad-fcc`} className="text-[12px] block text-center">FCC</Label><Input id={`${eye}-ad-fcc`} value={data.ad_fcc || ""} onChange={(e) => onChange(eye, "ad_fcc", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="FCC" /></div>
        <div><Label htmlFor={`${eye}-ad-read`} className="text-[12px] block text-center">READ</Label><Input id={`${eye}-ad-read`} value={data.ad_read || ""} onChange={(e) => onChange(eye, "ad_read", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="READ" /></div>
        <div><Label htmlFor={`${eye}-ad-int`} className="text-[12px] block text-center">INT</Label><Input id={`${eye}-ad-int`} value={data.ad_int || ""} onChange={(e) => onChange(eye, "ad_int", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="INT" /></div>
        <div><Label htmlFor={`${eye}-ad-bif`} className="text-[12px] block text-center">BIF</Label><Input id={`${eye}-ad-bif`} value={data.ad_bif || ""} onChange={(e) => onChange(eye, "ad_bif", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="BIF" /></div>
        <div><Label htmlFor={`${eye}-ad-mul`} className="text-[12px] block text-center">MUL</Label><Input id={`${eye}-ad-mul`} type="number" step="0.25" value={data.ad_mul?.toString() || ""} onChange={(e) => onChange(eye, "ad_mul", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" /></div>
        <div><Label htmlFor={`${eye}-ad-j`} className="text-[12px] block text-center">J</Label><Input id={`${eye}-ad-j`} type="number" value={data.ad_j?.toString() || ""} onChange={(e) => onChange(eye, "ad_j", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" /></div>
      </div>
      <span className="text-md font-medium pr-2 self-center text-center pt-4">{eyeLabel}</span>

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

  const handleEyeFieldChange = (
    eye: 'R' | 'L',
    field: keyof OpticalEyeExam,
    rawValue: string
  ) => {
    let processedValue: string | number | undefined = rawValue;
  
    const numericFields: (keyof OpticalEyeExam)[] = [
      "old_sph", "old_cyl", "old_pris", "old_ad", 
      "obj_sph", "obj_cyl", "obj_se", 
      "subj_sph", "subj_cyl", "subj_pris", 
      "ad_mul" // ad_j is integer
    ];
    const integerFields: (keyof OpticalEyeExam)[] = ["old_ax", "obj_ax", "subj_ax", "ad_j"];
  
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') { // Ensure not to make boolean fields undefined
        // For string fields like old_va, subj_fa, etc.
        // if schema allows null, undefined is fine. Otherwise, empty string.
        // Current schema defines them as string, so empty string or undefined based on how db handles it.
        // Let's assume undefined is preferred for empty optional strings if they are not explicitly set.
        // However, if the field is meant to be a string and is simply empty, "" might be more appropriate.
        // For now, let's make them undefined if empty, for consistency with numeric fields.
        // This can be revisited if empty strings are explicitly needed.
        processedValue = undefined;
    }
    // If it's a string field and not empty, processedValue remains rawValue (a string)
  
    if (eye === 'R') {
      setRightEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    } else {
      setLeftEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    }
  };

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
        // Re-fetch or update local state to reflect saved data accurately
        if (exam) setFormData({ ...updatedExam });
        if (rightEyeExam) setRightEyeFormData({ ...updatedRightEyeExam });
        if (leftEyeExam) setLeftEyeFormData({ ...updatedLeftEyeExam });
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
          <SiteHeader title="לקוחות" backLink="/clients" />
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
          backLink="/clients"
          clientName={fullName}
          clientBackLink={`/clients/${clientId}`}
          examInfo={`בדיקה מס' ${examId}`}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">פרטי בדיקה</h2>
            <Button 
              variant={isEditing ? "outline" : "default"} 
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  // When starting to edit, ensure formData is based on the latest DB state
                  // This is already handled by useEffect, but good to be mindful
                  if (exam) setFormData({ ...exam });
                  if (rightEyeExam) setRightEyeFormData({ ...rightEyeExam });
                  if (leftEyeExam) setLeftEyeFormData({ ...leftEyeExam });
                  setIsEditing(true);
                }
              }}
            >
              {isEditing ? "שמור שינויים" : "ערוך בדיקה"}
            </Button>
          </div>
          
          <form ref={formRef} className="pt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className=" rounded-md p-3">
                <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                  <div className="col-span-1">
                    <label className="font-semibold text-base">תאריך בדיקה</label>
                    <DateInput
                      name="exam_date"
                      className="h-9"
                      value={formData.exam_date}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">שם הבדיקה</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="test_name"
                        value={formData.test_name || ''}
                        onChange={handleInputChange}
                        className="text-sm pt-1"
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{exam.test_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">מרפאה</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="clinic"
                        value={formData.clinic || ''}
                        onChange={handleInputChange}
                        className="text-sm"
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{exam.clinic}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">שם הבודק</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <Input 
                        type="text"
                        name="examiner_name"
                        value={formData.examiner_name || ''}
                        onChange={handleInputChange}
                        className="text-sm py-1"
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{exam.examiner_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">עין דומיננטית</label>
                    <div className="h-1"></div>
                    
                      <Select dir="rtl"
                      disabled={!isEditing}
                        value={formData.dominant_eye || ''} 
                        onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                      >
                        <SelectTrigger className="h-6 text-sm">
                          <SelectValue placeholder="בחר עין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R" className="text-sm">ימין</SelectItem>
                          <SelectItem value="L" className="text-sm">שמאל</SelectItem>
                        </SelectContent>
                      </Select>
                    
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="previous-objective" className="w-full pt-4">
                <div className="flex flex-row-reverse gap-4">
                  <TabsList className="flex flex-col py-4 h-fit min-w-[140px] bg-muted/50 gap-2">
                    <TabsTrigger value="previous-objective" className="justify-start">Old refraction<br />& objective</TabsTrigger>
                    <TabsTrigger value="subjective" className="justify-start">Subjective</TabsTrigger>
                    <TabsTrigger value="addition" className="justify-start">Addition</TabsTrigger>
                  </TabsList>

                  <div className="flex-1">
                    <TabsContent value="previous-objective">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-1 pt-2">
                            <div className="absolute top-[-27px] right-[calc(100%*7/24)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                            Old refraction
                            </div>
                            <div className="absolute top-[-27px] right-[calc(100%*5/6)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                              Objective
                            </div>
                          </div>
                          <PreviousObjectiveSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <div className="h-1"></div>
                          <PreviousObjectiveSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="subjective">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-1 pt-2">
                            <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                Subjective
                            </div>
                          </div>
                          <SubjectiveSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <div className="h-1"></div>
                          <SubjectiveSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="addition">
                      <Card>
                        <CardContent className="px-4 pt-4 space-y-1">
                          <div className="relative mb-1 pt-2">
                            <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                              Addition
                            </div>
                          </div>
                          <AdditionSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                          <div className="h-1"></div>
                          <AdditionSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
              
              {/* Notes Section */}
              <div className=" rounded-md p-4 pt-4">
                <label className="block text-base font-semibold mb-2">הערות</label>
                {isEditing ? (
                  <textarea 
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    className="text-sm w-full min-h-[90px] p-3 border rounded-md"
                    rows={4}
                  />
                ) : (
                  <div className="text-sm  border p-3 rounded-md min-h-[106px]">
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