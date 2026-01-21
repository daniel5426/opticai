// @ts-nocheck
import { apiClient } from './api-client'
import { ExamComponentType } from './exam-field-mappings'

const normalizeComponentFieldValue = (previous: unknown, rawValue: string): unknown => {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue
  if (trimmed === "") {
    if (previous === null) return null
    return undefined
  }
  if (typeof previous === "number") {
    const normalizedNumber = Number(String(trimmed).replace(",", "."))
    return Number.isFinite(normalizedNumber) ? normalizedNumber : previous
  }
  if (typeof previous === "boolean") {
    if (trimmed === "true" || trimmed === "1") return true
    if (trimmed === "false" || trimmed === "0") return false
    return previous
  }
  return rawValue
}

export interface ExamComponentConfig {
  name: string
  component: () => Promise<any>
  icon?: string
  order?: number
  isRequired?: boolean
  validationRules?: Record<string, any>
}

export class ExamComponentRegistry {
  private components = new Map<ExamComponentType, ExamComponentConfig>()

  register<T = any>(
    type: ExamComponentType,
    config: ExamComponentConfig
  ) {
    this.components.set(type, config)
  }

  get(type: ExamComponentType): ExamComponentConfig | undefined {
    return this.components.get(type)
  }

  getConfig(type: ExamComponentType): ExamComponentConfig | undefined {
    return this.components.get(type)
  }

  getAll(): Map<ExamComponentType, ExamComponentConfig> {
    return this.components
  }

  getAllTypes(): ExamComponentType[] {
    return Array.from(this.components.keys())
  }

  createFieldChangeHandler<T>(
    _type: ExamComponentType,
    setFormData: (updater: (prev: T) => T) => void
  ) {
    return (field: keyof T, rawValue: string) => {
      setFormData(prev => {
        const current = {
          ...(prev as Record<string, unknown> || {})
        }
        const previousValue = current[field as string]
        const normalized = normalizeComponentFieldValue(previousValue, rawValue)
        if (normalized === undefined) {
          delete current[field as string]
        } else {
          current[field as string] = normalized
        }
        return current as T
      })
    }
  }

  async loadAllData(layoutInstanceId: number): Promise<Record<string, unknown>> {
    try {
      const response = await apiClient.getUnifiedExamData(layoutInstanceId)
      const data = response.data || Object.create(null)
      console.log(`DiopterAdjustmentPanel: Loaded data for layout ${layoutInstanceId}:`, data)
      return data
    } catch (error) {
      console.error('Error loading exam data:', error)
      return Object.create(null)
    }
  }

  async saveAllData(layoutInstanceId: number, formData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const dataToSave: Record<string, unknown> = {}
      
      for (const [key, data] of Object.entries(formData)) {
        if (data && typeof data === 'object') {
          // Handle special cases for notes and cover-test with multiple instances
          let componentType: ExamComponentType | null = null
          
          if (key.startsWith('notes-')) {
            componentType = 'notes'
          } else if (key.startsWith('cover-test-')) {
            componentType = 'cover-test'
          } else {
            // Check if it's a direct type or a type with a suffix (type-id)
            if (this.components.has(key as ExamComponentType)) {
              componentType = key as ExamComponentType
            } else {
              // Try to find if any registered type is a prefix followed by a hyphen
              for (const type of this.components.keys()) {
                if (key.startsWith(`${type}-`)) {
                  componentType = type
                  break
                }
              }
            }
          }
          
          if (componentType) {
            // Fix the layout_instance_id to match the correct instance
            const fixedData: any = { ...data }
            if ('layout_instance_id' in fixedData) {
              fixedData.layout_instance_id = layoutInstanceId
            }
            // Filter out empty/placeholder Cover Test tabs and deleted ones
            if (componentType === 'cover-test') {
              if (fixedData && typeof fixedData === 'object') {
                if (fixedData.__deleted) {
                  continue
                }
                const meaningfulFields = ['deviation_type','deviation_direction','fv_1','fv_2','nv_1','nv_2']
                const hasContent = meaningfulFields.some(f => {
                  const v = (fixedData as any)[f]
                  return v !== undefined && v !== null && String(v).trim() !== ''
                })
                if (!hasContent) {
                  continue
                }
              }
            }
            if (componentType === 'old-refraction') {
              if (fixedData && typeof fixedData === 'object') {
                if (fixedData.__deleted) {
                  continue
                }
                const meaningfulFields = [
                  'r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_ad', 'r_j',
                  'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_ad', 'l_j',
                  'comb_va', 'comb_j'
                ]
                const hasContent = meaningfulFields.some(f => {
                  const v = (fixedData as any)[f]
                  return v !== undefined && v !== null && String(v).trim() !== ''
                })
                if (!hasContent) {
                  continue
                }
              }
            }
            if (componentType === 'diopter-adjustment-panel') {
              console.log(`DiopterAdjustmentPanel: Saving data for key ${key}:`, fixedData)
            }
            dataToSave[key] = fixedData
          }
        }
      }

      console.log('DEBUG: Saving exam data with layoutInstanceId:', layoutInstanceId)
      console.log('DEBUG: Data to save:', dataToSave)
      console.log('DEBUG: Data to save type:', typeof dataToSave)

      const response = await apiClient.saveUnifiedExamData(layoutInstanceId, dataToSave)
      // Return the original data that was saved, not the API response
      // This ensures the UI state remains consistent
      return dataToSave
    } catch (error) {
      console.error('Error saving exam data:', error)
      throw error
    }
  }
}

export const examComponentRegistry = new ExamComponentRegistry()

// Register all exam components with UI configuration only
// Note: Components will be imported dynamically when needed

examComponentRegistry.register('old-refraction', {
  name: 'רפרקציה ישנה',
  component: () => import('../components/exam/OldRefractionTab'),
  order: 2
})

examComponentRegistry.register('objective', {
  name: 'אובייקטיבי',
  component: () => import('../components/exam/ObjectiveTab'),
  order: 3
})

examComponentRegistry.register('subjective', {
  name: 'סובייקטיבי',
  component: () => import('../components/exam/SubjectiveTab'),
  order: 4
})

examComponentRegistry.register('addition', {
  name: 'תוספת',
  component: () => import('../components/exam/AdditionTab'),
  order: 5
})

examComponentRegistry.register('final-subjective', {
  name: 'סובייקטיבי סופי',
  component: () => import('../components/exam/FinalSubjectiveTab'),
  order: 6
})

examComponentRegistry.register('final-prescription', {
  name: 'מרשם סופי',
  component: () => import('../components/exam/FinalPrescriptionTab'),
  order: 7
})

examComponentRegistry.register('retinoscop', {
  name: 'רטינוסקופ',
  component: () => import('../components/exam/RetinoscopTab'),
  order: 9
})

examComponentRegistry.register('retinoscop-dilation', {
  name: 'רטינוסקופ הרחבה',
  component: () => import('../components/exam/RetinoscopDilationTab'),
  order: 10
})

examComponentRegistry.register('uncorrected-va', {
  name: 'ראייה ללא תיקון',
  component: () => import('../components/exam/UncorrectedVATab'),
  order: 11
})

examComponentRegistry.register('keratometer', {
  name: 'קרטומטר',
  component: () => import('../components/exam/KeratometerTab'),
  order: 12
})

examComponentRegistry.register('keratometer-full', {
  name: 'קרטומטר מלא',
  component: () => import('../components/exam/KeratometerFullTab'),
  order: 13
})

examComponentRegistry.register('corneal-topography', {
  name: 'טופוגרפיה קרנית',
  component: () => import('../components/exam/CornealTopographyTab'),
  order: 14
})

examComponentRegistry.register('schirmer-test', {
  name: 'בדיקת שירמר',
  component: () => import('../components/exam/SchirmerTestTab'),
  order: 15
})

examComponentRegistry.register('old-refraction-extension', {
  name: 'הרחבת רפרקציה ישנה',
  component: () => import('../components/exam/OldRefractionExtensionTab'),
  order: 16
})

examComponentRegistry.register('anamnesis', {
  name: 'היסטוריה רפואית ואופטית (אנמנזה)',
  component: () => import('../components/exam/AnamnesisTab'),
  order: 17
})

examComponentRegistry.register('notes', {
  name: 'הערות',
  component: () => import('../components/exam/ObservationTab'),
  order: 18
})

examComponentRegistry.register('contact-lens-diameters', {
  name: 'קוטר עדשות מגע',
  component: () => import('../components/exam/ContactLensDiametersTab'),
  order: 19
})

examComponentRegistry.register('contact-lens-details', {
  name: 'פרטי עדשות מגע',
  component: () => import('../components/exam/ContactLensDetailsTab'),
  order: 20
})

examComponentRegistry.register('keratometer-contact-lens', {
  name: 'קרטומטר עדשות מגע',
  component: () => import('../components/exam/KeratometerContactLensTab'),
  order: 21
})

examComponentRegistry.register('contact-lens-exam', {
  name: 'בדיקת עדשות מגע',
  component: () => import('../components/exam/ContactLensExamTab'),
  order: 22
})

examComponentRegistry.register('contact-lens-order', {
  name: 'הזמנת עדשות מגע',
  component: () => import('../components/exam/ContactLensOrderTab'),
  order: 23
})

examComponentRegistry.register('old-contact-lenses', {
  name: 'עדשות מגע ישנות',
  component: () => import('../components/exam/OldContactLensesTab'),
  order: 24
})

examComponentRegistry.register('over-refraction', {
  name: 'רפרקציה נוספת',
  component: () => import('../components/exam/OverRefractionTab'),
  order: 25
})

examComponentRegistry.register('sensation-vision-stability', {
  name: 'יציבות ראייה תחושתית',
  component: () => import('../components/exam/DiopterAdjustmentPanelTab'),
  order: 26
})

examComponentRegistry.register('fusion-range', {
  name: 'טווח פיוזיה',
  component: () => import('../components/exam/FusionRangeTab'),
  order: 27
})

examComponentRegistry.register('maddox-rod', {
  name: 'מוט מדוקס',
  component: () => import('../components/exam/MaddoxRodTab'),
  order: 28
})

examComponentRegistry.register('stereo-test', {
  name: 'בדיקת סטריאו',
  component: () => import('../components/exam/StereoTestTab'),
  order: 29
})

examComponentRegistry.register('rg', {
  name: 'RG',
  component: () => import('../components/exam/RGTab'),
  order: 30
})

examComponentRegistry.register('ocular-motor-assessment', {
  name: 'הערכת תנועות עיניים',
  component: () => import('../components/exam/OcularMotorAssessmentTab'),
  order: 31
})

examComponentRegistry.register('cover-test', {
  name: 'בדיקת כיסוי',
  component: () => import('../components/exam/CoverTestTab'),
  order: 32
})

examComponentRegistry.register('diopter-adjustment-panel', {
  name: 'פנל תיקון דיופטר',
  component: () => import('../components/exam/DiopterAdjustmentPanelTab'),
  order: 33
})
