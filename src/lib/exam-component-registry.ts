import {
  OpticalExam,
  OldRefractionExam,
  OldRefractionExtensionExam,
  ObjectiveExam,
  SubjectiveExam,
  AdditionExam,
  FinalSubjectiveExam,
  FinalPrescriptionExam,
  CompactPrescriptionExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  UncorrectedVAExam,
  KeratometerExam,
  KeratometerFullExam,
  CornealTopographyExam,
  CoverTestExam,
  AnamnesisExam,
  NotesExam,
  SchirmerTestExam,
  OldRefExam,
  ContactLensDiameters,
  ContactLensDetails,
  KeratometerContactLens,
  ContactLensExam,
} from "@/lib/db/schema"

export type ExamComponentType =
  | 'exam-details'
  | 'old-ref'
  | 'old-refraction'
  | 'old-refraction-extension'
  | 'objective'
  | 'subjective'
  | 'addition'
  | 'retinoscop'
  | 'retinoscop-dilation'
  | 'final-subjective'
  | 'final-prescription'
  | 'compact-prescription'
  | 'uncorrected-va'
  | 'keratometer'
  | 'keratometer-full'
  | 'corneal-topography'
  | 'anamnesis'
  | 'cover-test'
  | 'schirmer-test'
  | 'notes'
  | 'contact-lens-diameters'
  | 'contact-lens-details'
  | 'keratometer-contact-lens'
  | 'contact-lens-exam'

export interface ExamComponentConfig<T = any> {
  name: string
  getData: (layoutInstanceId: number, cardInstanceId?: string) => Promise<T | null>
  createData: (data: Omit<T, 'id'>, cardInstanceId?: string) => Promise<T | null>
  updateData: (data: T) => Promise<T | null>
  validateField: (field: keyof T, value: string) => string | number | undefined
  getNumericFields: () => (keyof T)[]
  getIntegerFields: () => (keyof T)[]
  hasData: (data: T) => boolean
}

class ExamComponentRegistry {
  private components: Map<ExamComponentType, ExamComponentConfig> = new Map()

  register<T>(type: ExamComponentType, config: ExamComponentConfig<T>) {
    this.components.set(type, config)
  }

  getConfig<T>(type: ExamComponentType): ExamComponentConfig<T> | undefined {
    return this.components.get(type) as ExamComponentConfig<T> | undefined
  }

  getAllTypes(): ExamComponentType[] {
    return Array.from(this.components.keys())
  }

  async loadAllData(layoutInstanceId: number): Promise<Record<string, any>> {
    const data: Record<string, any> = {}
    
    for (const [type, config] of this.components) {
      if (type === 'notes') {
        // Handle notes card instances separately - load all notes for this layout instance
        try {
          const allNotes = await window.electronAPI.db('getAllNotesExamsByLayoutInstanceId', layoutInstanceId)
          if (allNotes && Array.isArray(allNotes)) {
            allNotes.forEach(notesData => {
              if (notesData.card_instance_id) {
                data[`notes-${notesData.card_instance_id}`] = notesData
              } else {
                // Fallback to just 'notes' if no card_instance_id
                data[type] = notesData
              }
            })
          }
        } catch (error) {
          console.warn(`Failed to load ${type} data:`, error)
        }
      } else {
        try {
          const componentData = await config.getData(layoutInstanceId)
          data[type] = componentData
        } catch (error) {
          console.warn(`Failed to load ${type} data:`, error)
          data[type] = null
        }
      }
    }
    
    return data
  }

  async saveAllData(layoutInstanceId: number, formData: Record<string, any>): Promise<Record<string, any>> {
    const savedData: Record<string, any> = {}
    
    for (const [type, config] of this.components) {
      if (type === 'notes') {
        // Handle notes card instances separately
        const notesKeys = Object.keys(formData).filter(key => key.startsWith('notes-'))
        for (const key of notesKeys) {
          const componentFormData = formData[key]
          if (!componentFormData) continue

          try {
            const hasData = config.hasData(componentFormData)
            if (!hasData) continue

            let result
            if (componentFormData.id) {
              result = await config.updateData({
                ...componentFormData,
                layout_instance_id: layoutInstanceId
              })
            } else {
              result = await config.createData({
                ...componentFormData,
                layout_instance_id: layoutInstanceId
              }, componentFormData.card_instance_id)
            }
            
            savedData[key] = result
          } catch (error) {
            console.error(`Failed to save ${key} data:`, error)
            savedData[key] = null
          }
        }
      } else {
        const componentFormData = formData[type]
        if (!componentFormData) continue

        try {
          const hasData = config.hasData(componentFormData)
          if (!hasData) continue

          let result
          if (componentFormData.id) {
            result = await config.updateData({
              ...componentFormData,
              layout_instance_id: layoutInstanceId
            })
          } else {
            result = await config.createData({
              ...componentFormData,
              layout_instance_id: layoutInstanceId
            })
          }
          
          savedData[type] = result
        } catch (error) {
          console.error(`Failed to save ${type} data:`, error)
          savedData[type] = null
        }
      }
    }
    
    return savedData
  }

  validateFieldValue<T>(type: ExamComponentType, field: keyof T, rawValue: string): string | number | undefined {
    const config = this.getConfig<T>(type)
    if (!config) return rawValue

    return config.validateField(field, rawValue)
  }

  createFieldChangeHandler<T>(
    type: ExamComponentType, 
    setFormData: (updater: (prev: T) => T) => void
  ) {
    return (field: keyof T, rawValue: string) => {
      const processedValue = this.validateFieldValue(type, field, rawValue)
      setFormData(prev => ({ ...prev, [field]: processedValue }))
    }
  }
}

const registry = new ExamComponentRegistry()

registry.register<OldRefExam>('old-ref', {
  name: 'רפרנס ישן',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getOldRefExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<OldRefExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createOldRefExam', data),
  updateData: (data: OldRefExam) => window.electronAPI.db('updateOldRefExam', data),
  getNumericFields: () => [],
  getIntegerFields: () => [],
  validateField: (field, rawValue) => {
    if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<OpticalExam>('exam-details', {
  name: 'פרטי בדיקה',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => {
    console.log('getData', layoutInstanceId)
    return Promise.resolve(null)
  },
  createData: (data: Omit<OpticalExam, 'id'>, cardInstanceId?: string) => {
    console.log('createData', data)
    return Promise.resolve(null)
  },
  updateData: (data: OpticalExam) => {
    console.log('updateData', data)
    return Promise.resolve(null)
  },
  getNumericFields: () => [],
  getIntegerFields: () => ['user_id'],
  validateField: (field, rawValue) => {
    if (rawValue === "") {
      return undefined
    }
    if (field === 'user_id') {
      const val = parseInt(rawValue, 10)
      return isNaN(val) ? undefined : val
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<OldRefractionExam>('old-refraction', {
  name: 'רפרקציה ישנה',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getOldRefractionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<OldRefractionExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createOldRefractionExam', data),
  updateData: (data: OldRefractionExam) => window.electronAPI.db('updateOldRefractionExam', data),
  getNumericFields: () => [
    "r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_ad",
    "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_ad", "comb_va"
  ],
  getIntegerFields: () => ["r_ax", "l_ax"],
  validateField: (field, rawValue) => {
    const numericFields = ["r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_ad", "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_ad", "comb_va"]
    const integerFields = ["r_ax", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<ObjectiveExam>('objective', {
  name: 'אובייקטיבי',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getObjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<ObjectiveExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createObjectiveExam', data),
  updateData: (data: ObjectiveExam) => window.electronAPI.db('updateObjectiveExam', data),
  getNumericFields: () => ["r_sph", "r_cyl", "r_se", "l_sph", "l_cyl", "l_se"],
  getIntegerFields: () => ["r_ax", "l_ax"],
  validateField: (field, rawValue) => {
    const numericFields = ["r_sph", "r_cyl", "r_se", "l_sph", "l_cyl", "l_se"]
    const integerFields = ["r_ax", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<SubjectiveExam>('subjective', {
  name: 'סובייקטיבי',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getSubjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<SubjectiveExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createSubjectiveExam', data),
  updateData: (data: SubjectiveExam) => window.electronAPI.db('updateSubjectiveExam', data),
  getNumericFields: () => [
    "r_fa", "r_fa_tuning", "r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_pd_close", "r_pd_far",
    "l_fa", "l_fa_tuning", "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_pd_close", "l_pd_far",
    "comb_fa", "comb_fa_tuning", "comb_va", "comb_pd_close", "comb_pd_far"
  ],
  getIntegerFields: () => ["r_ax", "l_ax"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_fa", "r_fa_tuning", "r_sph", "r_cyl", "r_pris", "r_base", "r_va", "r_pd_close", "r_pd_far",
      "l_fa", "l_fa_tuning", "l_sph", "l_cyl", "l_pris", "l_base", "l_va", "l_pd_close", "l_pd_far",
      "comb_fa", "comb_fa_tuning", "comb_va", "comb_pd_close", "comb_pd_far"
    ]
    const integerFields = ["r_ax", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<AdditionExam>('addition', {
  name: 'תוספות',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getAdditionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<AdditionExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createAdditionExam', data),
  updateData: (data: AdditionExam) => window.electronAPI.db('updateAdditionExam', data),
  getNumericFields: () => [
    "r_fcc", "r_read", "r_int", "r_bif", "r_mul", "r_iop",
    "l_fcc", "l_read", "l_int", "l_bif", "l_mul", "l_iop"
  ],
  getIntegerFields: () => ["r_j", "l_j"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_fcc", "r_read", "r_int", "r_bif", "r_mul", "r_iop",
      "l_fcc", "l_read", "l_int", "l_bif", "l_mul", "l_iop"
    ]
    const integerFields = ["r_j", "l_j"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<FinalSubjectiveExam>('final-subjective', {
  name: 'סובייקטיבי סופי',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getFinalSubjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<FinalSubjectiveExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createFinalSubjectiveExam', data),
  updateData: (data: FinalSubjectiveExam) => window.electronAPI.db('updateFinalSubjectiveExam', data),
  getNumericFields: () => [
    "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pr_h", "l_pr_h",
    "r_pr_v", "l_pr_v", "r_va", "l_va", "r_j", "l_j", "r_pd_far", "l_pd_far",
    "r_pd_close", "l_pd_close", "comb_pd_far", "comb_pd_close", "comb_va"
  ],
  getIntegerFields: () => ["r_ax", "l_ax", "r_j", "l_j"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pr_h", "l_pr_h",
      "r_pr_v", "l_pr_v", "r_va", "l_va", "r_j", "l_j", "r_pd_far", "l_pd_far",
      "r_pd_close", "l_pd_close", "comb_pd_far", "comb_pd_close", "comb_va"
    ]
    const integerFields = ["r_ax", "l_ax", "r_j", "l_j"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<FinalPrescriptionExam>('final-prescription', {
  name: 'מרשם סופי',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getFinalPrescriptionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<FinalPrescriptionExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createFinalPrescriptionExam', data),
  updateData: (data: FinalPrescriptionExam) => window.electronAPI.db('updateFinalPrescriptionExam', data),
  getNumericFields: () => [
    "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pris", "l_pris",
    "r_va", "l_va", "r_ad", "l_ad", "r_pd", "l_pd", "r_high", "l_high",
    "r_diam", "l_diam", "comb_va", "comb_pd", "comb_high"
  ],
  getIntegerFields: () => ["r_ax", "l_ax"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pris", "l_pris",
      "r_va", "l_va", "r_ad", "l_ad", "r_pd", "l_pd", "r_high", "l_high",
      "r_diam", "l_diam", "comb_va", "comb_pd", "comb_high"
    ]
    const integerFields = ["r_ax", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<CompactPrescriptionExam>('compact-prescription', {
  name: 'מרשם קומפקטי',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getCompactPrescriptionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<CompactPrescriptionExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createCompactPrescriptionExam', data),
  updateData: (data: CompactPrescriptionExam) => window.electronAPI.db('updateCompactPrescriptionExam', data),
  getNumericFields: () => [
    "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pris", "l_pris",
    "r_base", "l_base", "r_va", "l_va", "r_ad", "l_ad", "r_pd", "l_pd",
    "comb_va", "comb_pd"
  ],
  getIntegerFields: () => ["r_ax", "l_ax"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pris", "l_pris",
      "r_base", "l_base", "r_va", "l_va", "r_ad", "l_ad", "r_pd", "l_pd",
      "comb_va", "comb_pd"
    ]
    const integerFields = ["r_ax", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<RetinoscopExam>('retinoscop', {
  name: 'רטינוסקופיה',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getRetinoscopExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<RetinoscopExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createRetinoscopExam', data),
  updateData: (data: RetinoscopExam) => window.electronAPI.db('updateRetinoscopExam', data),
  getNumericFields: () => ["r_sph", "r_cyl", "r_ax", "l_sph", "l_cyl", "l_ax"],
  getIntegerFields: () => [],
  validateField: (field, rawValue) => {
    const numericFields = ["r_sph", "r_cyl", "r_ax", "l_sph", "l_cyl", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<RetinoscopDilationExam>('retinoscop-dilation', {
  name: 'רטינוסקופיה עם הרחבה',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getRetinoscopDilationExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<RetinoscopDilationExam, 'id'>) => window.electronAPI.db('createRetinoscopDilationExam', data),
  updateData: (data: RetinoscopDilationExam) => window.electronAPI.db('updateRetinoscopDilationExam', data),
  getNumericFields: () => ["r_sph", "r_cyl", "r_ax", "l_sph", "l_cyl", "l_ax"],
  getIntegerFields: () => [],
  validateField: (field, rawValue) => {
    const numericFields = ["r_sph", "r_cyl", "r_ax", "l_sph", "l_cyl", "l_ax"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<UncorrectedVAExam>('uncorrected-va', {
  name: 'Uncorrected VA',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getUncorrectedVAExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<UncorrectedVAExam, 'id'>) => window.electronAPI.db('createUncorrectedVAExam', data),
  updateData: (data: UncorrectedVAExam) => window.electronAPI.db('updateUncorrectedVAExam', data),
  getNumericFields: () => [],
  getIntegerFields: () => [],
  validateField: (_field, rawValue) => rawValue === '' ? undefined : rawValue,
  hasData: (data) => !!data && Object.values(data).some(v => v !== null && v !== undefined && v !== '')
})

registry.register<KeratometerExam>('keratometer', {
  name: 'Keratometer',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getKeratometerExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<KeratometerExam, 'id'>) => window.electronAPI.db('createKeratometerExam', data),
  updateData: (data: KeratometerExam) => window.electronAPI.db('updateKeratometerExam', data),
  getNumericFields: () => ['r_k1', 'r_k2', 'l_k1', 'l_k2'],
  getIntegerFields: () => ['r_axis', 'l_axis'],
  validateField: (field, value) => {
    if (value === '' || value === null) return undefined;
    const numericFields = ['r_k1', 'r_k2', 'l_k1', 'l_k2'];
    const integerFields = ['r_axis', 'l_axis'];
    if (numericFields.includes(field as string)) {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    if (integerFields.includes(field as string)) {
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    }
    return value;
  },
  hasData: (data) => !!data && Object.values(data).some(v => v !== null && v !== undefined && v !== '')
});

registry.register<KeratometerFullExam>('keratometer-full', {
  name: 'Keratometer Full',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getKeratometerFullExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<KeratometerFullExam, 'id'>) => window.electronAPI.db('createKeratometerFullExam', data),
  updateData: (data: KeratometerFullExam) => window.electronAPI.db('updateKeratometerFullExam', data),
  getNumericFields: () => [
    'r_dpt_k1', 'r_dpt_k2', 'l_dpt_k1', 'l_dpt_k2',
    'r_mm_k1', 'r_mm_k2', 'l_mm_k1', 'l_mm_k2',
    'r_mer_k1', 'r_mer_k2', 'l_mer_k1', 'l_mer_k2'
  ],
  getIntegerFields: () => [],
  validateField: (field, value) => {
    if (value === '' || value === null) return undefined;
    const numericFields = [
      'r_dpt_k1', 'r_dpt_k2', 'l_dpt_k1', 'l_dpt_k2',
      'r_mm_k1', 'r_mm_k2', 'l_mm_k1', 'l_mm_k2',
      'r_mer_k1', 'r_mer_k2', 'l_mer_k1', 'l_mer_k2'
    ];
    const booleanFields = ['r_astig', 'l_astig'];
    if (numericFields.includes(field as string)) {
      const num = parseFloat(value as string);
      return isNaN(num) ? undefined : num;
    }
    if (booleanFields.includes(field as string)) {
      return value === 'true' || (typeof value === 'boolean' && value) ? 1 : 0;
    }
    return value;
  },
  hasData: (data) => !!data && Object.values(data).some(v => v !== null && v !== undefined && v !== '')
});

registry.register<CornealTopographyExam>('corneal-topography', {
  name: 'Corneal Topography',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getCornealTopographyExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<CornealTopographyExam, 'id'>) => window.electronAPI.db('createCornealTopographyExam', data),
  updateData: (data: CornealTopographyExam) => window.electronAPI.db('updateCornealTopographyExam', data),
  getNumericFields: () => [],
  getIntegerFields: () => [],
  validateField: (field, value) => {
    if (value === '' || value === null) return undefined;
    return value;
  },
  hasData: (data) => !!data && (!!data.l_note || !!data.r_note || !!data.title)
});

registry.register<CoverTestExam>('cover-test', {
  name: 'בדיקת כיסוי',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getCoverTestExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<CoverTestExam, 'id'>) => window.electronAPI.db('createCoverTestExam', data),
  updateData: (data: CoverTestExam) => window.electronAPI.db('updateCoverTestExam', data),
  getNumericFields: () => ['fv_1', 'fv_2', 'nv_1', 'nv_2'],
  getIntegerFields: () => [],
  validateField: (field, value) => {
    if (value === '' || value === null) return undefined;
    const numericFields = ['fv_1', 'fv_2', 'nv_1', 'nv_2'];
    if (numericFields.includes(field as string)) {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return value;
  },
  hasData: (data) => !!data && Object.values(data).some(v => v !== null && v !== undefined && v !== '')
});

registry.register<SchirmerTestExam>('schirmer-test', {
  name: 'בדיקת שירמר',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getSchirmerTestExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<SchirmerTestExam, 'id'>) => window.electronAPI.db('createSchirmerTestExam', data),
  updateData: (data: SchirmerTestExam) => window.electronAPI.db('updateSchirmerTestExam', data),
  getNumericFields: () => ['r_mm', 'l_mm', 'r_but', 'l_but'],
  getIntegerFields: () => [],
  validateField: (field, value) => {
    if (value === '' || value === null) return undefined;
    const numericFields = ['r_mm', 'l_mm', 'r_but', 'l_but'];
    if (numericFields.includes(field as string)) {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return value;
  },
  hasData: (data) => !!data && Object.values(data).some(v => v !== null && v !== undefined && v !== '')
});

registry.register<OldRefractionExtensionExam>('old-refraction-extension', {
  name: 'רפרקציה ישנה E',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getOldRefractionExtensionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<OldRefractionExtensionExam, 'id'>) => window.electronAPI.db('createOldRefractionExtensionExam', data),
  updateData: (data: OldRefractionExtensionExam) => window.electronAPI.db('updateOldRefractionExtensionExam', data),
  getNumericFields: () => [
    "r_sph", "r_cyl", "r_pr_h", "r_pr_v", "r_va", "r_ad", "r_pd_far", "r_pd_close",
    "l_sph", "l_cyl", "l_pr_h", "l_pr_v", "l_va", "l_ad", "l_pd_far", "l_pd_close",
    "comb_va", "comb_pd_far", "comb_pd_close"
  ],
  getIntegerFields: () => ["r_ax", "l_ax", "r_j", "l_j"],
  validateField: (field, rawValue) => {
    const numericFields = [
      "r_sph", "r_cyl", "r_pr_h", "r_pr_v", "r_va", "r_ad", "r_pd_far", "r_pd_close",
      "l_sph", "l_cyl", "l_pr_h", "l_pr_v", "l_va", "l_ad", "l_pd_far", "l_pd_close",
      "comb_va", "comb_pd_far", "comb_pd_close"
    ]
    const integerFields = ["r_ax", "l_ax", "r_j", "l_j"]
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10)
      return rawValue === "" || isNaN(val) ? undefined : val
    } else if (rawValue === "") {
      return undefined
    }
    return rawValue
  },
  hasData: (data) => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  )
})

registry.register<AnamnesisExam>('anamnesis', {
  name: 'אנמנזה',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getAnamnesisExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<AnamnesisExam, 'id'>) => window.electronAPI.db('createAnamnesisExam', data),
  updateData: (data: AnamnesisExam) => window.electronAPI.db('updateAnamnesisExam', data),
  getNumericFields: () => [],
  getIntegerFields: () => ["contact_lens_wear"],
  validateField: (field, rawValue) => {
    if (["contact_lens_wear"].includes(field as string)) {
      if (typeof rawValue === 'boolean') {
        return rawValue ? 1 : 0;
      }
      return rawValue === 'true' ? 1 : 0;
    }
    return rawValue === "" ? undefined : rawValue;
  },
  hasData: (data) => Object.values(data).some(value =>
    value !== undefined && value !== null && value !== ''
  )
});

registry.register<NotesExam>('notes', {
  name: 'הערות',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => {
    if (cardInstanceId) {
      return window.electronAPI.db('getNotesExamByLayoutInstanceId', layoutInstanceId, cardInstanceId)
    } else {
      return window.electronAPI.db('getNotesExamByLayoutInstanceId', layoutInstanceId)
    }
  },
  createData: (data: Omit<NotesExam, 'id'>, cardInstanceId?: string) => {
    const dataWithInstance = cardInstanceId ? { ...data, card_instance_id: cardInstanceId } : data
    return window.electronAPI.db('createNotesExam', dataWithInstance)
  },
  updateData: (data: NotesExam) => window.electronAPI.db('updateNotesExam', data),
  getNumericFields: () => [],
  getIntegerFields: () => [],
  validateField: (field, rawValue) => {
    if (rawValue === '') {
      return undefined;
    }
    return rawValue;
  },
  hasData: (data) => !!data && (!!data.note || !!data.title)
});

registry.register<ContactLensDiameters>('contact-lens-diameters', {
  name: 'קוטרי עדשות מגע',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getContactLensDiametersByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<ContactLensDiameters, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createContactLensDiameters', data),
  updateData: (data: ContactLensDiameters) => window.electronAPI.db('updateContactLensDiameters', data),
  getNumericFields: () => ['pupil_diameter', 'corneal_diameter', 'eyelid_aperture'],
  getIntegerFields: () => [],
  validateField: (field, rawValue) => {
    const numericFields = ['pupil_diameter', 'corneal_diameter', 'eyelid_aperture'];
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      return undefined;
    }
    return rawValue;
  },
  hasData: (data) => Object.values(data).some(value =>
    value !== undefined && value !== null && value !== ''
  )
});

registry.register<ContactLensDetails>('contact-lens-details', {
  name: 'פרטי עדשות מגע',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getContactLensDetailsByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<ContactLensDetails, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createContactLensDetails', data),
  updateData: (data: ContactLensDetails) => window.electronAPI.db('updateContactLensDetails', data),
  getNumericFields: () => ['l_quantity', 'r_quantity', 'l_order_quantity', 'r_order_quantity'],
  getIntegerFields: () => ['l_quantity', 'r_quantity', 'l_order_quantity', 'r_order_quantity'],
  validateField: (field, rawValue) => {
    const integerFields = ['l_quantity', 'r_quantity', 'l_order_quantity', 'r_order_quantity'];
    const booleanFields = ['l_dx', 'r_dx'];
    
    if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (booleanFields.includes(field as string)) {
      if (typeof rawValue === 'boolean') {
        return rawValue ? 1 : 0;
      }
      return rawValue === 'true' ? 1 : 0;
    } else if (rawValue === "") {
      return undefined;
    }
    return rawValue;
  },
  hasData: (data) => Object.values(data).some(value =>
    value !== undefined && value !== null && value !== ''
  )
});

registry.register<KeratometerContactLens>('keratometer-contact-lens', {
  name: 'קרטומטר עדשות מגע',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getKeratometerContactLensByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<KeratometerContactLens, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createKeratometerContactLens', data),
  updateData: (data: KeratometerContactLens) => window.electronAPI.db('updateKeratometerContactLens', data),
  getNumericFields: () => ['l_rh', 'l_rv', 'l_avg', 'l_cyl', 'l_ecc', 'r_rh', 'r_rv', 'r_avg', 'r_cyl', 'r_ecc'],
  getIntegerFields: () => ['l_ax', 'r_ax'],
  validateField: (field, rawValue) => {
    const numericFields = ['l_rh', 'l_rv', 'l_avg', 'l_cyl', 'l_ecc', 'r_rh', 'r_rv', 'r_avg', 'r_cyl', 'r_ecc'];
    const integerFields = ['l_ax', 'r_ax'];
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      return undefined;
    }
    return rawValue;
  },
  hasData: (data) => Object.values(data).some(value =>
    value !== undefined && value !== null && value !== ''
  )
});

registry.register<ContactLensExam>('contact-lens-exam', {
  name: 'בדיקת עדשות מגע',
  getData: (layoutInstanceId: number, cardInstanceId?: string) => window.electronAPI.db('getContactLensExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<ContactLensExam, 'id'>, cardInstanceId?: string) => window.electronAPI.db('createContactLensExam', data),
  updateData: (data: ContactLensExam) => window.electronAPI.db('updateContactLensExam', data),
  getNumericFields: () => [
    'comb_va', 'l_bc', 'l_bc_2', 'l_oz', 'l_diam', 'l_sph', 'l_cyl', 'l_read_ad', 'l_va', 'l_j',
    'r_bc', 'r_bc_2', 'r_oz', 'r_diam', 'r_sph', 'r_cyl', 'r_read_ad', 'r_va', 'r_j'
  ],
  getIntegerFields: () => ['l_ax', 'r_ax'],
  validateField: (field, rawValue) => {
    const numericFields = [
      'comb_va', 'l_bc', 'l_bc_2', 'l_oz', 'l_diam', 'l_sph', 'l_cyl', 'l_read_ad', 'l_va', 'l_j',
      'r_bc', 'r_bc_2', 'r_oz', 'r_diam', 'r_sph', 'r_cyl', 'r_read_ad', 'r_va', 'r_j'
    ];
    const integerFields = ['l_ax', 'r_ax'];
    
    if (numericFields.includes(field as string)) {
      const val = parseFloat(rawValue);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field as string)) {
      const val = parseInt(rawValue, 10);
      return rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      return undefined;
    }
    return rawValue;
  },
  hasData: (data) => Object.values(data).some(value =>
    value !== undefined && value !== null && value !== ''
  )
});


export { registry as examComponentRegistry }