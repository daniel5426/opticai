import {
  OpticalExam,
  OldRefractionExam,
  OldRefractionExtensionExam,
  ObjectiveExam,
  SubjectiveExam,
  AdditionExam,
  FinalSubjectiveExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  UncorrectedVAExam,
  KeratometerExam,
  CoverTestExam,
} from "@/lib/db/schema"

export type ExamComponentType = 'old-refraction' | 'old-refraction-extension' | 'objective' | 'subjective' | 'addition' | 'final-subjective' | 'retinoscop' | 'retinoscop-dilation' | 'uncorrected-va' | 'keratometer' | 'cover-test'

export interface ExamComponentConfig<T = any> {
  name: string
  getData: (layoutInstanceId: number) => Promise<T | null>
  createData: (data: Omit<T, 'id'>) => Promise<T | null>
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
      try {
        const componentData = await config.getData(layoutInstanceId)
        data[type] = componentData
      } catch (error) {
        console.warn(`Failed to load ${type} data:`, error)
        data[type] = null
      }
    }
    
    return data
  }

  async saveAllData(layoutInstanceId: number, formData: Record<string, any>): Promise<Record<string, any>> {
    const savedData: Record<string, any> = {}
    
    for (const [type, config] of this.components) {
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

registry.register<OldRefractionExam>('old-refraction', {
  name: 'רפרקציה ישנה',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getOldRefractionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<OldRefractionExam, 'id'>) => window.electronAPI.db('createOldRefractionExam', data),
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
  getData: (layoutInstanceId: number) => window.electronAPI.db('getObjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<ObjectiveExam, 'id'>) => window.electronAPI.db('createObjectiveExam', data),
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
  getData: (layoutInstanceId: number) => window.electronAPI.db('getSubjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<SubjectiveExam, 'id'>) => window.electronAPI.db('createSubjectiveExam', data),
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
  getData: (layoutInstanceId: number) => window.electronAPI.db('getAdditionExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<AdditionExam, 'id'>) => window.electronAPI.db('createAdditionExam', data),
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
  getData: (layoutInstanceId: number) => window.electronAPI.db('getFinalSubjectiveExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<FinalSubjectiveExam, 'id'>) => window.electronAPI.db('createFinalSubjectiveExam', data),
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

registry.register<RetinoscopExam>('retinoscop', {
  name: 'רטינוסקופיה',
  getData: (layoutInstanceId: number) => window.electronAPI.db('getRetinoscopExamByLayoutInstanceId', layoutInstanceId),
  createData: (data: Omit<RetinoscopExam, 'id'>) => window.electronAPI.db('createRetinoscopExam', data),
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

export { registry as examComponentRegistry } 