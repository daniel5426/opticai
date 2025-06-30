import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById, getOldRefractionExamByExamId, getObjectiveExamByExamId, getSubjectiveExamByExamId, getAdditionExamByExamId, updateExam, updateOldRefractionExam, updateObjectiveExam, updateSubjectiveExam, updateAdditionExam, createExam, createOldRefractionExam, createObjectiveExam, createSubjectiveExam, createAdditionExam, getOldRefractionExamByLayoutId, getObjectiveExamByLayoutId, getSubjectiveExamByLayoutId, getAdditionExamByLayoutId, getFinalSubjectiveExamByLayoutId } from "@/lib/db/exams-db"
import { OpticalExam, OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam, Client, User, FinalSubjectiveExam, ExamLayout, ExamLayoutInstance } from "@/lib/db/schema"
import { getFinalSubjectiveExamByExamId, createFinalSubjectiveExam, updateFinalSubjectiveExam } from "@/lib/db/final-subjective-db"
import { getAllExamLayouts, getDefaultExamLayout, getLayoutsByExamId, getExamLayoutInstancesByExamId, getActiveExamLayoutInstanceByExamId, setActiveExamLayoutInstance, addLayoutToExam, ensureExamHasLayout, getExamLayoutById, deleteExamLayoutInstance } from "@/lib/db/exam-layouts-db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PlusCircleIcon, Trash2Icon, X as XIcon } from "lucide-react"
import { toast } from "sonner"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { getAllUsers } from "@/lib/db/users-db"
import { ExamCardRenderer, CardItem, DetailProps, calculateCardWidth, hasNoteCard } from "@/components/exam/ExamCardRenderer"


interface ExamDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  examId?: string;
  onSave?: (exam: OpticalExam, oldRefractionExam: OldRefractionExam, objectiveExam: ObjectiveExam, subjectiveExam: SubjectiveExam, additionExam: AdditionExam) => void;
  onCancel?: () => void;
}

interface CardRow {
  id: string
  cards: CardItem[]
}

interface LayoutTab {
  id: number
  layout_id: number
  name: string
  layout_data: string
  isActive: boolean
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
  const [availableLayouts, setAvailableLayouts] = useState<ExamLayout[]>([])
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null)
  const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([])
  const { currentUser } = useUser()

  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('exams')

  const [formData, setFormData] = useState<Partial<OpticalExam>>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    test_name: '',
    clinic: '',
    user_id: currentUser?.id,
    notes: '',
    dominant_eye: ''
  } : {})
  
  const [oldRefractionFormData, setOldRefractionFormData] = useState<OldRefractionExam>({} as OldRefractionExam)
  const [objectiveFormData, setObjectiveFormData] = useState<ObjectiveExam>({} as ObjectiveExam)
  const [subjectiveFormData, setSubjectiveFormData] = useState<SubjectiveExam>({} as SubjectiveExam)
  const [additionFormData, setAdditionFormData] = useState<AdditionExam>({} as AdditionExam)
  const [finalSubjectiveFormData, setFinalSubjectiveFormData] = useState<FinalSubjectiveExam>({} as FinalSubjectiveExam)

  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const [cardRows, setCardRows] = useState<CardRow[]>([
    { id: 'row-1', cards: [{ id: 'exam-details', type: 'exam-details' }] },
    { id: 'row-2', cards: [{ id: 'old-refraction', type: 'old-refraction' }] },
    { id: 'row-3', cards: [{ id: 'objective', type: 'objective' }] },
    { id: 'row-4', cards: [{ id: 'subjective', type: 'subjective' }] },
    { id: 'row-5', cards: [{ id: 'final-subjective', type: 'final-subjective' }] },
    { id: 'row-6', cards: [{ id: 'addition', type: 'addition' }] },
    { id: 'row-7', cards: [{ id: 'notes', type: 'notes' }] }
  ])

  const [customWidths, setCustomWidths] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return

      try {
        setLoading(true)

        // Load available layouts
        const layoutsData = await getAllExamLayouts()
        setAvailableLayouts(layoutsData)

        const clientData = await getClientById(Number(clientId))
        setClient(clientData || null)

        if (examId && !isNewMode) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)

          if (examData) {
            // Load layout instances associated with this exam
            const layoutInstances = await getExamLayoutInstancesByExamId(Number(examId))
            
            if (layoutInstances.length > 0) {
              // Get the active layout instance
              const activeInstance = await getActiveExamLayoutInstanceByExamId(Number(examId))
              
              // Convert instances to layout tabs
              const tabs = await Promise.all(layoutInstances.map(async (instance) => {
                const layout = await getExamLayoutById(instance.layout_id)
                return {
                  id: instance.id || 0,
                  layout_id: instance.layout_id,
                  name: layout?.name || '',
                  layout_data: layout?.layout_data || '',
                  isActive: instance.is_active || false
                };
              }));
              
              setLayoutTabs(tabs)
              
              // Find active layout instance
              if (activeInstance) {
                setActiveLayoutId(activeInstance.layout_id || 0)
                
                // Get the active layout data
                const activeLayout = await getExamLayoutById(activeInstance.layout_id)
                
                if (activeLayout && activeLayout.layout_data) {
                  // Load the layout
                  const parsedLayout = JSON.parse(activeLayout.layout_data)
                  if (Array.isArray(parsedLayout)) {
                    setCardRows(parsedLayout)
                    setCustomWidths({})
                  } else {
                    setCardRows(parsedLayout.rows || [])
                    setCustomWidths(parsedLayout.customWidths || {})
                  }
                
                  // Now load exam components for this layout
                  const oldRefractionData = await getOldRefractionExamByLayoutId(activeInstance.layout_id)
                  const objectiveData = await getObjectiveExamByLayoutId(activeInstance.layout_id)
                  const subjectiveData = await getSubjectiveExamByLayoutId(activeInstance.layout_id)
                  const additionData = await getAdditionExamByLayoutId(activeInstance.layout_id)
                  const finalSubjectiveData = await getFinalSubjectiveExamByLayoutId(activeInstance.layout_id)

                  setOldRefractionExam(oldRefractionData || null)
                  setObjectiveExam(objectiveData || null)
                  setSubjectiveExam(subjectiveData || null)
                  setAdditionExam(additionData || null)
                  setFinalSubjectiveExam(finalSubjectiveData || null)
                }
              } else {
                // Fallback to exam-based retrieval for backward compatibility
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
            } else {
              // No layouts found, create one from default
              let defaultLayout = await getDefaultExamLayout()
              if (!defaultLayout && layoutsData.length > 0) {
                defaultLayout = layoutsData[0]
              }

              if (defaultLayout) {
                // Create a layout instance for this exam
                const newLayoutInstance = await addLayoutToExam(Number(examId), defaultLayout.id || 1, true)
                
                if (newLayoutInstance) {
                  setActiveLayoutId(defaultLayout.id || 0)
                  setLayoutTabs([{
                    id: newLayoutInstance.id || 0,
                    layout_id: defaultLayout.id || 0,
                    name: defaultLayout.name || '',
                    layout_data: defaultLayout.layout_data || '',
                    isActive: true
                  }])
                  
                  const parsedLayout = JSON.parse(defaultLayout.layout_data)
                  if (Array.isArray(parsedLayout)) {
                    setCardRows(parsedLayout)
                    setCustomWidths({})
                  } else {
                    setCardRows(parsedLayout.rows || [])
                    setCustomWidths(parsedLayout.customWidths || {})
                  }
                  
                  // Load exam components using exam ID (since this is a new layout)
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
            }
          }
        } else {
          // For new exams, use default layout
          let defaultLayout = await getDefaultExamLayout()
          if (!defaultLayout && layoutsData.length > 0) {
            defaultLayout = layoutsData[0]
          }

          if (defaultLayout) {
            setActiveLayoutId(defaultLayout.id || 0)
            const parsedLayout = JSON.parse(defaultLayout.layout_data)
            if (Array.isArray(parsedLayout)) {
              setCardRows(parsedLayout)
              setCustomWidths({})
            } else {
              setCardRows(parsedLayout.rows || [])
              setCustomWidths(parsedLayout.customWidths || {})
            }
            // Initialize layout tab for new exam
            setLayoutTabs([{
              id: 0, // Temporary ID for new exam
              layout_id: defaultLayout.id || 0,
              name: defaultLayout.name || '',
              layout_data: defaultLayout.layout_data || '',
              isActive: true
            }])
            
            // Initialize empty form data for new components
            setOldRefractionFormData({ layout_id: defaultLayout.id || 0 } as OldRefractionExam)
            setObjectiveFormData({ layout_id: defaultLayout.id || 0 } as ObjectiveExam)
            setSubjectiveFormData({ layout_id: defaultLayout.id || 0 } as SubjectiveExam)
            setAdditionFormData({ layout_id: defaultLayout.id || 0 } as AdditionExam)
            setFinalSubjectiveFormData({ layout_id: defaultLayout.id || 0 } as FinalSubjectiveExam)
          }
        }

        // Load users for display purposes
        const usersData = await getAllUsers()
        setUsers(usersData)
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
          // Make sure we have an active layout
          const activeLayout = layoutTabs.find(tab => tab.isActive) || layoutTabs[0];
          
          if (!activeLayout) {
            toast.error("לא נמצאה פריסה פעילה לבדיקה");
            return;
          }
          
          // Create layout instance for the new exam
          const layoutInstance = await addLayoutToExam(
            newExam.id, 
            activeLayout.layout_id, 
            true  // Make it active
          );
          
          if (!layoutInstance) {
            toast.error("שגיאה ביצירת פריסת בדיקה");
            return;
          }
          
          // Create exam components
          const newOldRefractionExam = await createOldRefractionExam({
            ...oldRefractionFormData,
            layout_id: activeLayout.layout_id
          })

          const newObjectiveExam = await createObjectiveExam({
            ...objectiveFormData,
            layout_id: activeLayout.layout_id
          })

          const newSubjectiveExam = await createSubjectiveExam({
            ...subjectiveFormData,
            layout_id: activeLayout.layout_id
          })

          const newAdditionExam = await createAdditionExam({
            ...additionFormData,
            layout_id: activeLayout.layout_id
          })

          // Save final subjective exam data if there's data
          let newFinalSubjectiveExam: FinalSubjectiveExam | null = null
          const hasFinalSubjectiveData = Object.values(finalSubjectiveFormData).some(value =>
            value !== undefined && value !== null && value !== ''
          );

          if (hasFinalSubjectiveData) {
            newFinalSubjectiveExam = await createFinalSubjectiveExam({
              ...finalSubjectiveFormData,
              layout_id: activeLayout.layout_id
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
        const updatedExam = await updateExam(formData as OpticalExam)
        
        // Get the current active layout tab
        const activeLayout = layoutTabs.find(tab => tab.isActive);
        
        if (!activeLayout) {
          toast.error("לא נמצאה פריסה פעילה לבדיקה");
          return;
        }
        
        // Update the active layout status in the database
        await setActiveExamLayoutInstance(Number(examId), activeLayout.id);
        
        // Update exam components with the active layout
        const updatedOldRefractionExam = await updateOldRefractionExam({
          ...oldRefractionFormData,
          layout_id: activeLayout.layout_id
        })
        
        const updatedObjectiveExam = await updateObjectiveExam({
          ...objectiveFormData,
          layout_id: activeLayout.layout_id
        })
        
        const updatedSubjectiveExam = await updateSubjectiveExam({
          ...subjectiveFormData,
          layout_id: activeLayout.layout_id
        })
        
        const updatedAdditionExam = await updateAdditionExam({
          ...additionFormData,
          layout_id: activeLayout.layout_id
        })

        // Save final subjective exam data if there's data
        let updatedFinalSubjective: FinalSubjectiveExam | null = null
        const hasFinalSubjectiveData = Object.values(finalSubjectiveFormData).some(value =>
          value !== undefined && value !== null && value !== ''
        );

        if (hasFinalSubjectiveData) {
          if (finalSubjectiveExam && finalSubjectiveExam.id) {
            updatedFinalSubjective = await updateFinalSubjectiveExam({
              ...finalSubjectiveFormData,
              layout_id: activeLayout.layout_id,
              id: finalSubjectiveExam.id
            });
          } else {
            updatedFinalSubjective = await createFinalSubjectiveExam({
              ...finalSubjectiveFormData,
              layout_id: activeLayout.layout_id
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

  const handleLayoutChange = async (layoutId: string) => {
    try {
      const selectedLayout = availableLayouts.find(layout => layout.id === Number(layoutId))
      if (selectedLayout && selectedLayout.layout_data) {
        setActiveLayoutId(Number(layoutId))
        
        // Update the layout data display
        const parsedLayout = JSON.parse(selectedLayout.layout_data)
        if (Array.isArray(parsedLayout)) {
          setCardRows(parsedLayout)
          setCustomWidths({})
        } else {
          setCardRows(parsedLayout.rows || [])
          setCustomWidths(parsedLayout.customWidths || {})
        }
        
        // If this is for an existing exam, create a layout instance
        if (exam && exam.id && !isNewMode) {
          // Check if this layout is already associated with the exam
          const layoutInstanceId = layoutTabs.find(tab => tab.layout_id === Number(layoutId))?.id
          
          if (layoutInstanceId) {
            // Just make this one active
            await setActiveExamLayoutInstance(exam.id, layoutInstanceId)
            
            // Update the UI
            const updatedTabs = layoutTabs.map(tab => ({
              ...tab,
              isActive: tab.layout_id === Number(layoutId)
            }))
            setLayoutTabs(updatedTabs)
          } else {
            // Create a new layout instance for this exam
            const newInstance = await addLayoutToExam(
              exam.id, 
              Number(layoutId), 
              true // Make it active
            )
            
            if (newInstance) {
              // Make all other tabs inactive
              const updatedTabs = layoutTabs.map(tab => ({
                ...tab,
                isActive: false
              }))
              
              // Add the new tab
              updatedTabs.push({
                id: newInstance.id || 0,
                layout_id: Number(layoutId),
                name: selectedLayout.name || '',
                layout_data: selectedLayout.layout_data || '',
                isActive: true
              })
              
              setLayoutTabs(updatedTabs)
            }
          }
        }
        toast.success(`פריסה "${selectedLayout.name}" הוחלה`)
      }
    } catch (error) {
      console.error('Error applying layout:', error)
      toast.error('שגיאה בהחלת הפריסה')
    }
  }

  const handleLayoutTabChange = async (tabId: number) => {
    // Find the tab
    const selectedTab = layoutTabs.find(tab => tab.id === tabId)
    if (!selectedTab) return
    
    try {
      // Set all tabs to inactive and this one to active
      const updatedTabs = layoutTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
      
      setLayoutTabs(updatedTabs)
      setActiveLayoutId(selectedTab.layout_id)
      
      // Update the active layout in the database if we have an exam
      if (exam && exam.id && !isNewMode) {
        await setActiveExamLayoutInstance(exam.id, tabId)
      }
      
      // Apply the layout
      const parsedLayout = JSON.parse(selectedTab.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
    } catch (error) {
      console.error('Error changing layout tab:', error)
      toast.error('שגיאה בהחלפת לשונית פריסה')
    }
  }

  const handleAddLayoutTab = async (layoutId: number) => {
    const layoutToAdd = availableLayouts.find(layout => layout.id === layoutId)
    if (!layoutToAdd) return
    
    // Check if tab already exists
    if (layoutTabs.some(tab => tab.layout_id === layoutId)) {
      toast.info(`הפריסה "${layoutToAdd.name}" כבר קיימת בלשוניות`)
      handleLayoutTabChange(layoutTabs.find(tab => tab.layout_id === layoutId)?.id || 0) // Switch to this tab if it already exists
      return
    }
    
    if (exam && exam.id && !isNewMode) {
      // Create a new layout instance
      const newLayoutInstance = await addLayoutToExam(
        exam.id,
        layoutId,
        true // Make it active
      )
      
      if (newLayoutInstance) {
        // Set all other tabs to inactive
        const updatedTabs = layoutTabs.map(tab => ({
          ...tab,
          isActive: false
        }))
        
        // Add the new tab
        const newTab = {
          id: newLayoutInstance.id || 0,
          layout_id: layoutId,
          name: layoutToAdd.name || '',
          layout_data: layoutToAdd.layout_data || '',
          isActive: true
        }
        
        setLayoutTabs([...updatedTabs, newTab])
        setActiveLayoutId(layoutId)
        
        // Apply the layout
        const parsedLayout = JSON.parse(layoutToAdd.layout_data)
        if (Array.isArray(parsedLayout)) {
          setCardRows(parsedLayout)
          setCustomWidths({})
        } else {
          setCardRows(parsedLayout.rows || [])
          setCustomWidths(parsedLayout.customWidths || {})
        }
        toast.success(`פריסה "${layoutToAdd.name}" הוספה והוחלה`)
      } else {
        toast.error('שגיאה בהוספת לשונית פריסה')
      }
    } else {
      // For new exam, just add to the tabs in memory (will be persisted on save)
      // Set all other tabs to inactive
      const updatedTabs = layoutTabs.map(tab => ({
        ...tab,
        isActive: false
      }))
      
      // Add the new tab
      const newTab = {
        id: -Date.now(), // Temporary negative ID for unsaved tabs
        layout_id: layoutId,
        name: layoutToAdd.name || '',
        layout_data: layoutToAdd.layout_data || '',
        isActive: true
      }
      
      setLayoutTabs([...updatedTabs, newTab])
      setActiveLayoutId(layoutId)
      
      // Apply the layout
      const parsedLayout = JSON.parse(layoutToAdd.layout_data)
      if (Array.isArray(parsedLayout)) {
        setCardRows(parsedLayout)
        setCustomWidths({})
      } else {
        setCardRows(parsedLayout.rows || [])
        setCustomWidths(parsedLayout.customWidths || {})
      }
      toast.success(`פריסה "${layoutToAdd.name}" הוספה והוחלה`)
    }
  }

  const handleRemoveLayoutTab = async (tabId: number) => {
    console.log('Removing layout tab with ID:', tabId);
    
    // Don't allow removing the only tab
    if (layoutTabs.length <= 1) {
      toast.error('לא ניתן להסיר את הלשונית האחרונה');
      return;
    }
    
    const tabIndex = layoutTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) {
      console.error('Tab not found:', tabId);
      return;
    }
    
    const tabToRemove = layoutTabs[tabIndex];
    const isActive = tabToRemove.isActive;
    
    try {
      // Delete the layout instance if this is for an existing exam
      if (exam && exam.id && !isNewMode && tabId > 0) {
        console.log('Deleting layout instance from database:', tabId);
        try {
          const success = await deleteExamLayoutInstance(tabId);
          if (!success) {
            console.error('Failed to delete layout instance');
            toast.error('שגיאה במחיקת פריסה');
            return;
          }
        } catch (error) {
          console.error('Error deleting layout instance:', error);
          toast.error('שגיאה במחיקת פריסה');
          return;
        }
      } else {
        console.log('Skipping database deletion for temporary tab or new exam');
      }
      
      // Update the tabs in state
      console.log('Updating layout tabs in state');
      const updatedTabs = [...layoutTabs];
      updatedTabs.splice(tabIndex, 1);
      
      // If removing active tab, activate another one
      if (isActive && updatedTabs.length > 0) {
        console.log('Removed tab was active, activating another tab');
        // Activate the tab at same position or the last one
        const newActiveIndex = Math.min(tabIndex, updatedTabs.length - 1);
        updatedTabs[newActiveIndex].isActive = true;
        
        // Set the new active layout in the DB if this is an existing exam
        if (exam && exam.id && !isNewMode) {
          console.log('Setting new active layout in database:', updatedTabs[newActiveIndex].id);
          await setActiveExamLayoutInstance(exam.id, updatedTabs[newActiveIndex].id);
        }
        
        setActiveLayoutId(updatedTabs[newActiveIndex].layout_id);
        
        // Apply the new active layout
        try {
          const newActiveTab = updatedTabs[newActiveIndex];
          console.log('Applying new active layout:', newActiveTab.name);
          const parsedLayout = JSON.parse(newActiveTab.layout_data);
          if (Array.isArray(parsedLayout)) {
            setCardRows(parsedLayout);
            setCustomWidths({});
          } else {
            setCardRows(parsedLayout.rows || []);
            setCustomWidths(parsedLayout.customWidths || {});
          }
        } catch (error) {
          console.error('Error applying layout after tab removal:', error);
        }
      }
      
      setLayoutTabs(updatedTabs);
      toast.success('לשונית הפריסה הוסרה');
    } catch (error) {
      console.error('Error removing layout tab:', error);
      toast.error('שגיאה במחיקת לשונית פריסה');
    }
  }

  const handleEditButtonClick = () => {
    if (isEditing) {
      handleSave();
    } else {
      if (exam) setFormData({ ...exam });
      if (oldRefractionExam) setOldRefractionFormData({ ...oldRefractionExam });
      if (objectiveExam) setObjectiveFormData({ ...objectiveExam });
      if (subjectiveExam) setSubjectiveFormData({ ...subjectiveExam });
      if (additionExam) setAdditionFormData({ ...additionExam });
      if (finalSubjectiveExam) setFinalSubjectiveFormData({ ...finalSubjectiveExam });
      setIsEditing(true);
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

  const detailProps: DetailProps = {
    isEditing,
    isNewMode,
    exam,
    formData,
    oldRefractionFormData,
    objectiveFormData,
    subjectiveFormData,
    finalSubjectiveFormData,
    additionFormData,
    handleInputChange,
    handleSelectChange,
    setFormData,
    handleOldRefractionFieldChange,
    handleObjectiveFieldChange,
    handleSubjectiveFieldChange,
    handleFinalSubjectiveChange,
    handleAdditionFieldChange,
    handleMultifocalOldRefraction,
    handleVHConfirmOldRefraction,
    handleVHConfirm,
    handleMultifocalSubjective,
    handleFinalSubjectiveVHConfirm,
  }

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

            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-1">
                  <span>פריסות</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-sm font-bold" disabled>הוספת פריסה</DropdownMenuItem>
                {availableLayouts.map((layout) => (
                  <DropdownMenuItem 
                    key={layout.id} 
                    onClick={() => handleAddLayoutTab(layout.id || 0)}
                    className="text-sm"
                  >
                    <PlusCircleIcon className="h-4 w-4 mr-2" />
                    {layout.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isNewMode && onCancel && (
              <Button variant="outline" onClick={onCancel}>
                ביטול
              </Button>
            )}
            <Button
              variant={isEditing ? "outline" : "default"}
              onClick={handleEditButtonClick}
            >
              {isNewMode ? "שמור בדיקה" : (isEditing ? "שמור שינויים" : "ערוך בדיקה")}
            </Button>
          </div>
        </div>

        {/* Layout Tabs */}
        {layoutTabs.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {layoutTabs.map((tab) => (
                <div 
                  key={tab.id}
                  className={`
                    group relative flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer
                    ${tab.isActive 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'bg-muted/50 hover:bg-muted text-foreground'}
                  `}
                  onClick={() => handleLayoutTabChange(tab.id)}
                >
                  <span className="text-sm font-medium">{tab.name}</span>
                  {layoutTabs.length > 1 && isEditing && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveLayoutTab(tab.id);
                      }}
                      className={`
                        absolute top-1/2 -translate-y-1/2 right-2
                        rounded-full p-1 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200
                        flex items-center justify-center
                        ${tab.isActive 
                          ? 'hover:bg-primary-foreground/20 text-primary-foreground/80' 
                          : 'hover:bg-muted-foreground/20 text-muted-foreground'}
                        hover:text-red-500
                      `}
                      aria-label="הסר לשונית"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form ref={formRef} className="pt-4">
          <div className="space-y-4" style={{ scrollbarWidth: 'none' }}>
            {cardRows.map((row) => {
              const cardWidths = calculateCardWidth(row.cards, row.id, customWidths)

              return (
                <div key={row.id} className="w-full">
                    <div className="flex gap-4 flex-1" dir="ltr">
                      {row.cards.map((card, index) => (
                        <div
                          key={card.id}
                          style={{
                            width: `${cardWidths[card.id]}%`,
                            minWidth: row.cards.length > 1 ? '200px' : 'auto'
                          }}
                        >
                          <ExamCardRenderer
                            item={card}
                            rowCards={row.cards}
                            mode="detail"
                            detailProps={detailProps}
                            hideEyeLabels={index === 1}
                            matchHeight={hasNoteCard(row.cards) && row.cards.length > 1}
                          />
                        </div>
                      ))}
                    </div>
                </div>
              )
            })}
          </div>
        </form>
      </div>
    </>
  )
} 