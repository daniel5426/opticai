import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, getOldRefractionExamByExamId, getObjectiveExamByExamId, getSubjectiveExamByExamId, getAdditionExamByExamId, updateExam, updateOldRefractionExam, updateObjectiveExam, updateSubjectiveExam, updateAdditionExam, createExam, createOldRefractionExam, createObjectiveExam, createSubjectiveExam, createAdditionExam } from "@/lib/db/exams-db"
import { OpticalExam, OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam, Client, User, FinalSubjectiveExam } from "@/lib/db/schema"
import { getFinalSubjectiveExamByExamId, createFinalSubjectiveExam, updateFinalSubjectiveExam } from "@/lib/db/final-subjective-db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { getAllUsers } from "@/lib/db/users-db"
import { OldRefractionObjectiveTab } from "@/components/exam/OldRefractionObjectiveTab"
import { SubjectiveTab } from "@/components/exam/SubjectiveTab"
import { AdditionTab } from "@/components/exam/AdditionTab"
import { FinalSubjectiveTab } from "@/components/exam/FinalSubjectiveTab"

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







interface ExamDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, oldRefractionExam: OldRefractionExam, objectiveExam: ObjectiveExam, subjectiveExam: SubjectiveExam, additionExam: AdditionExam) => void;
  onCancel?: () => void;
}

export default function ExamDetailPage({ 
  mode = 'view', 
  clientId: propClientId, 
  examId: propExamId,
  onSave,
  onCancel 
}: ExamDetailPageProps = {}) {
  let routeClientId: string | undefined, routeExamId: string | undefined;
  
  try {
    const params = useParams({ from: "/clients/$clientId/exams/$examId" });
    routeClientId = params.clientId;
    routeExamId = params.examId;
  } catch {
    try {
      const params = useParams({ from: "/clients/$clientId/exams/new" });
      routeClientId = params.clientId;
    } catch {
      routeClientId = undefined;
      routeExamId = undefined;
    }
  }
  
  const clientId = propClientId || routeClientId
  const examId = propExamId || routeExamId
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [exam, setExam] = useState<OpticalExam | null>(null)
  const [oldRefractionExam, setOldRefractionExam] = useState<OldRefractionExam | null>(null)
  const [objectiveExam, setObjectiveExam] = useState<ObjectiveExam | null>(null)
  const [subjectiveExam, setSubjectiveExam] = useState<SubjectiveExam | null>(null)
  const [additionExam, setAdditionExam] = useState<AdditionExam | null>(null)
  const [finalSubjectiveExam, setFinalSubjectiveExam] = useState<FinalSubjectiveExam | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const { currentUser } = useUser()
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('exams')
  
  const [formData, setFormData] = useState<OpticalExam>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    clinic: '',
    user_id: currentUser?.id,
    notes: '',
    dominant_eye: ''
  } as OpticalExam : {} as OpticalExam)
  const [oldRefractionFormData, setOldRefractionFormData] = useState<OldRefractionExam>(isNewMode ? { exam_id: 0 } as OldRefractionExam : {} as OldRefractionExam)
  const [objectiveFormData, setObjectiveFormData] = useState<ObjectiveExam>(isNewMode ? { exam_id: 0 } as ObjectiveExam : {} as ObjectiveExam)
  const [subjectiveFormData, setSubjectiveFormData] = useState<SubjectiveExam>(isNewMode ? { exam_id: 0 } as SubjectiveExam : {} as SubjectiveExam)
  const [additionFormData, setAdditionFormData] = useState<AdditionExam>(isNewMode ? { exam_id: 0 } as AdditionExam : {} as AdditionExam)
  const [finalSubjectiveFormData, setFinalSubjectiveFormData] = useState<FinalSubjectiveExam>(isNewMode ? { exam_id: 0 } as FinalSubjectiveExam : {} as FinalSubjectiveExam)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return
      
      try {
        setLoading(true)
        
        // Load users for display purposes
        const usersData = await getAllUsers()
        setUsers(usersData)
        
        const clientData = await getClientById(Number(clientId))
        setClient(clientData || null)
        
        if (examId && !isNewMode) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)
          
          if (examData) {
            const oldRefractionData = await getOldRefractionExamByExamId(Number(examId))
            const objectiveData = await getObjectiveExamByExamId(Number(examId))
            const subjectiveData = await getSubjectiveExamByExamId(Number(examId))
            const additionData = await getAdditionExamByExamId(Number(examId))
            const finalSubjectiveData = await getFinalSubjectiveExamByExamId(Number(examId))
            
            setOldRefractionExam(oldRefractionData || null)
            setObjectiveExam(objectiveData || null)
            setSubjectiveExam(subjectiveData || null)
            setAdditionExam(additionData || null)
            setFinalSubjectiveExam(finalSubjectiveData || null)
          }
        }
      } catch (error) {
        console.error('Error loading exam data:', error)
        toast.error('שגיאה בטעינת נתוני הבדיקה')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [clientId, examId, isNewMode])
  
  useEffect(() => {
    if (exam) {
      setFormData({ ...exam })
    }
    if (oldRefractionExam) {
      setOldRefractionFormData({ ...oldRefractionExam })
    }
    if (objectiveExam) {
      setObjectiveFormData({ ...objectiveExam })
    }
    if (subjectiveExam) {
      setSubjectiveFormData({ ...subjectiveExam })
    }
    if (additionExam) {
      setAdditionFormData({ ...additionExam })
    }
    if (finalSubjectiveExam) {
      setFinalSubjectiveFormData({ ...finalSubjectiveExam })
    }
  }, [exam, oldRefractionExam, objectiveExam, subjectiveExam, additionExam, finalSubjectiveExam])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleExamFieldChange = (field: keyof OpticalExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    if (rawValue === "" && typeof processedValue !== 'boolean') {
      processedValue = undefined;
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleOldRefractionFieldChange = (field: keyof OldRefractionExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof OldRefractionExam)[] = [
      "r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_ad",
      "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_ad", "comb_va"
    ];
    const integerFields: (keyof OldRefractionExam)[] = ["r_ax", "l_ax"];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') {
      processedValue = undefined;
    }
    
    setOldRefractionFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleObjectiveFieldChange = (field: keyof ObjectiveExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof ObjectiveExam)[] = [
      "r_sph", "r_cyl", "r_se", "l_sph", "l_cyl", "l_se"
    ];
    const integerFields: (keyof ObjectiveExam)[] = ["r_ax", "l_ax"];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') {
      processedValue = undefined;
    }
    
    setObjectiveFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleSubjectiveFieldChange = (field: keyof SubjectiveExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof SubjectiveExam)[] = [
      "r_fa", "r_fa_tuning", "r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_pd_close", "r_pd_far",
      "l_fa", "l_fa_tuning", "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_pd_close", "l_pd_far",
      "comb_fa", "comb_fa_tuning", "comb_va", "comb_pd_close", "comb_pd_far"
    ];
    const integerFields: (keyof SubjectiveExam)[] = ["r_ax", "l_ax"];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') {
      processedValue = undefined;
    }
    
    setSubjectiveFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleAdditionFieldChange = (field: keyof AdditionExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof AdditionExam)[] = [
      "r_fcc", "r_read", "r_int", "r_bif", "r_mul", "r_iop",
      "l_fcc", "l_read", "l_int", "l_bif", "l_mul", "l_iop"
    ];
    const integerFields: (keyof AdditionExam)[] = ["r_j", "l_j"];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "" && typeof processedValue !== 'boolean') {
      processedValue = undefined;
    }
    
    setAdditionFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFinalSubjectiveChange = (field: keyof FinalSubjectiveExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof FinalSubjectiveExam)[] = [
      "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pr_h", "l_pr_h", 
      "r_pr_v", "l_pr_v", "r_va", "l_va", "r_j", "l_j", "r_pd_far", "l_pd_far", 
      "r_pd_close", "l_pd_close", "comb_pd_far", "comb_pd_close", "comb_va"
    ];
    const integerFields: (keyof FinalSubjectiveExam)[] = ["r_ax", "l_ax", "r_j", "l_j"];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      processedValue = undefined;
    }
    
    setFinalSubjectiveFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleFinalSubjectiveVHConfirm = (
    rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string,
    leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string
  ) => {
    setFinalSubjectiveFormData(prev => ({
      ...prev,
      r_pr_h: rightPrisH,
      r_base_h: rightBaseH,
      r_pr_v: rightPrisV,
      r_base_v: rightBaseV,
      l_pr_h: leftPrisH,
      l_base_h: leftBaseH,
      l_pr_v: leftPrisV,
      l_base_v: leftBaseV,
    }));
  };
  
  const handleSave = async () => {
    if (formRef.current) {
      if (isNewMode) {
        const newExam = await createExam({
          client_id: Number(clientId),
          exam_date: formData.exam_date,
          test_name: formData.test_name,
          clinic: formData.clinic,
          user_id: formData.user_id,
          notes: formData.notes,
          dominant_eye: formData.dominant_eye
        })
        
        if (newExam && newExam.id) {
          const newOldRefractionExam = await createOldRefractionExam({
            ...oldRefractionFormData,
            exam_id: newExam.id
          })
          
          const newObjectiveExam = await createObjectiveExam({
            ...objectiveFormData,
            exam_id: newExam.id
          })
          
          const newSubjectiveExam = await createSubjectiveExam({
            ...subjectiveFormData,
            exam_id: newExam.id
          })
          
          const newAdditionExam = await createAdditionExam({
            ...additionFormData,
            exam_id: newExam.id
          })
          
          // Save final subjective exam data if there's data
          let newFinalSubjectiveExam: FinalSubjectiveExam | null = null
          const hasFinalSubjectiveData = Object.values(finalSubjectiveFormData).some(value => 
            value !== undefined && value !== null && value !== ''
          );
          
          if (hasFinalSubjectiveData) {
            newFinalSubjectiveExam = await createFinalSubjectiveExam({
              ...finalSubjectiveFormData,
              exam_id: newExam.id
            });
          }
          
          if (newOldRefractionExam && newObjectiveExam && newSubjectiveExam && newAdditionExam) {
            toast.success("בדיקה חדשה נוצרה בהצלחה")
            if (onSave) {
              onSave(newExam, newOldRefractionExam, newObjectiveExam, newSubjectiveExam, newAdditionExam)
            }
          } else {
            toast.error("לא הצלחנו ליצור את נתוני הבדיקה")
          }
        } else {
          toast.error("לא הצלחנו ליצור את הבדיקה")
        }
      } else {
        const updatedExam = await updateExam(formData)
        const updatedOldRefractionExam = await updateOldRefractionExam(oldRefractionFormData)
        const updatedObjectiveExam = await updateObjectiveExam(objectiveFormData)
        const updatedSubjectiveExam = await updateSubjectiveExam(subjectiveFormData)
        const updatedAdditionExam = await updateAdditionExam(additionFormData)
        
        // Save final subjective exam data if there's data
        let updatedFinalSubjective: FinalSubjectiveExam | null = null
        const hasFinalSubjectiveData = Object.values(finalSubjectiveFormData).some(value => 
          value !== undefined && value !== null && value !== ''
        );
        
        if (hasFinalSubjectiveData) {
          if (finalSubjectiveExam && finalSubjectiveExam.id) {
            updatedFinalSubjective = await updateFinalSubjectiveExam(finalSubjectiveFormData);
          } else {
            updatedFinalSubjective = await createFinalSubjectiveExam({
              ...finalSubjectiveFormData,
              exam_id: Number(examId)
            });
          }
          
          if (updatedFinalSubjective) {
            setFinalSubjectiveExam(updatedFinalSubjective);
            setFinalSubjectiveFormData({ ...updatedFinalSubjective });
          }
        }
        
        if (updatedExam && updatedOldRefractionExam && updatedObjectiveExam && updatedSubjectiveExam && updatedAdditionExam) {
          setIsEditing(false)
          setExam(updatedExam)
          setOldRefractionExam(updatedOldRefractionExam)
          setObjectiveExam(updatedObjectiveExam)
          setSubjectiveExam(updatedSubjectiveExam)
          setAdditionExam(updatedAdditionExam)
          setFormData({ ...updatedExam })
          setOldRefractionFormData({ ...updatedOldRefractionExam })
          setObjectiveFormData({ ...updatedObjectiveExam })
          setSubjectiveFormData({ ...updatedSubjectiveExam })
          setAdditionFormData({ ...updatedAdditionExam })
          toast.success("פרטי הבדיקה עודכנו בהצלחה")
          if (onSave) {
            onSave(updatedExam, updatedOldRefractionExam, updatedObjectiveExam, updatedSubjectiveExam, updatedAdditionExam)
          }
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      }
    }
  }

  const handleVHConfirm = (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
    setSubjectiveFormData(prev => ({ 
      ...prev, 
      r_pris: rightPris,
      r_base: rightBase,
      l_pris: leftPris,
      l_base: leftBase 
    }));
    toast.success("ערכי פריזמה עודכנו");
  };

  const handleVHConfirmOldRefraction = (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => {
    setOldRefractionFormData(prev => ({ 
      ...prev, 
      r_pris: rightPris,
      r_base: rightBase,
      l_pris: leftPris,
      l_base: leftBase 
    }));
    toast.success("ערכי פריזמה עודכנו (רפרקציה ישנה)");
  };

  const handleMultifocalOldRefraction = () => {
    const rightOldCyl = oldRefractionFormData.r_cyl || 0;
    const leftOldCyl = oldRefractionFormData.l_cyl || 0;
    
    if (rightOldCyl === 0 && leftOldCyl === 0) {
      toast.info("אין ערכי צילינדר לעדכון");
      return;
    }

    const newRightCyl = Math.max(0, Math.abs(rightOldCyl) - 0.25) * Math.sign(rightOldCyl || 1);
    const newLeftCyl = Math.max(0, Math.abs(leftOldCyl) - 0.25) * Math.sign(leftOldCyl || 1);

    setOldRefractionFormData(prev => ({ 
      ...prev, 
      r_cyl: newRightCyl === 0 ? undefined : newRightCyl,
      l_cyl: newLeftCyl === 0 ? undefined : newLeftCyl
    }));

    toast.success("צילינדר הופחת ב-0.25D להתאמה מולטיפוקלית");
  };

  const handleMultifocalSubjective = () => {
    const rightSubjCyl = subjectiveFormData.r_cyl || 0;
    const leftSubjCyl = subjectiveFormData.l_cyl || 0;
    
    if (rightSubjCyl === 0 && leftSubjCyl === 0) {
      toast.info("אין ערכי צילינדר לעדכון");
      return;
    }

    const newRightCyl = Math.max(0, Math.abs(rightSubjCyl) - 0.25) * Math.sign(rightSubjCyl || 1);
    const newLeftCyl = Math.max(0, Math.abs(leftSubjCyl) - 0.25) * Math.sign(leftSubjCyl || 1);

    setSubjectiveFormData(prev => ({ 
      ...prev, 
      r_cyl: newRightCyl === 0 ? undefined : newRightCyl,
      l_cyl: newLeftCyl === 0 ? undefined : newLeftCyl
    }));

    toast.success("צילינדר הופחת ב-0.25D להתאמה מולטיפוקלית");
  };
  
  const handleTabChange = (value: string) => {
    if (clientId && value !== 'exams') {
      navigate({ 
        to: "/clients/$clientId", 
        params: { clientId: String(clientId) },
        search: { tab: value } 
      })
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">טוען נתונים...</h1>
        </div>
      </>
    )
  }
  
  if (!client || (!isNewMode && (!exam || !oldRefractionExam || !objectiveExam || !subjectiveExam || !additionExam))) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "בדיקה לא נמצאה"}</h1>
        </div>
      </>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          client={client}
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "בדיקה חדשה" : `בדיקה מס' ${examId}`}
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isNewMode ? "בדיקה חדשה" : "פרטי בדיקה"}</h2>
            <div className="flex gap-2">
              {!isNewMode && !isEditing && exam?.id && (
                <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }} search={{ examId: String(exam.id) }}>
                  <Button variant="outline">
                    יצירת הזמנה
                  </Button>
                </Link>
              )}
              {isNewMode && onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  ביטול
                </Button>
              )}
              <Button 
                variant={isEditing ? "outline" : "default"} 
                onClick={() => {
                  if (isEditing) {
                    handleSave();
                  } else {
                    // When starting to edit, ensure formData is based on the latest DB state
                    // This is already handled by useEffect, but good to be mindful
                    if (exam) setFormData({ ...exam });
                    if (oldRefractionExam) setOldRefractionFormData({ ...oldRefractionExam });
                    if (objectiveExam) setObjectiveFormData({ ...objectiveExam });
                    if (subjectiveExam) setSubjectiveFormData({ ...subjectiveExam });
                    if (additionExam) setAdditionFormData({ ...additionExam });
                    if (finalSubjectiveExam) setFinalSubjectiveFormData({ ...finalSubjectiveExam });
                    setIsEditing(true);
                  }
                }}
              >
                {isNewMode ? "שמור בדיקה" : (isEditing ? "שמור שינויים" : "ערוך בדיקה")}
              </Button>
            </div>
          </div>
          
          <form ref={formRef} className="pt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className=" rounded-md">
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
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{isNewMode ? formData.test_name : exam?.test_name}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">סניף</label>
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
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">{isNewMode ? formData.clinic : exam?.clinic}</div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">בודק</label>
                    <div className="h-1"></div>
                    {isEditing ? (
                      <UserSelect
                        value={formData.user_id}
                        onValueChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
                      />
                    ) : (
                      <div className="border h-9 px-3 rounded-md text-sm flex items-center">
                        {formData.user_id ? (
                          users.find(u => u.id === formData.user_id)?.username || 'משתמש לא נמצא'
                        ) : 'לא נבחר בודק'}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1">
                    <label className="font-semibold text-base">עין דומיננטית</label>
                    <div className="h-1 w-full"></div>
                    
                      <Select dir="rtl"
                      disabled={!isEditing}
                        value={formData.dominant_eye || ''} 
                        onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                      >
                        <SelectTrigger className="h-6 text-sm w-full">
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
              
              <div className="space-y-6 pt-2">
                <OldRefractionObjectiveTab
                  oldRefractionData={oldRefractionFormData}
                  objectiveData={objectiveFormData}
                  onOldRefractionChange={handleOldRefractionFieldChange}
                  onObjectiveChange={handleObjectiveFieldChange}
                  isEditing={isEditing}
                  onMultifocalClick={handleMultifocalOldRefraction}
                  onVHConfirm={handleVHConfirmOldRefraction}
                />

                <SubjectiveTab
                  subjectiveData={subjectiveFormData}
                  onSubjectiveChange={handleSubjectiveFieldChange}
                  isEditing={isEditing}
                  onVHConfirm={handleVHConfirm}
                  onMultifocalClick={handleMultifocalSubjective}
                />

                <FinalSubjectiveTab
                  finalSubjectiveData={finalSubjectiveFormData}
                  onFinalSubjectiveChange={handleFinalSubjectiveChange}
                  isEditing={isEditing}
                  onVHConfirm={handleFinalSubjectiveVHConfirm}
                />

                <AdditionTab
                  additionData={additionFormData}
                  onAdditionChange={handleAdditionFieldChange}
                  isEditing={isEditing}
                />
              </div>
              
              {/* Notes Section */}
              <div className=" rounded-md ">
                <label className="block text-base font-semibold mb-2">הערות</label>
                {isEditing ? (
                  <textarea 
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    className="text-sm w-full min-h-[90px] p-3 border shadow-sm rounded-md"
                    rows={4}
                  />
                ) : (
                  <div className="text-sm  border shadow-sm p-3 rounded-md min-h-[106px]">
                    {isNewMode ? (formData.notes || 'אין הערות') : (exam?.notes || 'אין הערות')}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </>
    )
} 