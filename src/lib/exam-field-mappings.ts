import { 
  OldRefractionExam, 
  ObjectiveExam, 
  SubjectiveExam, 
  FinalSubjectiveExam, 
  AdditionExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  UncorrectedVAExam,
  KeratometerExam
} from './db/schema'

export type ExamComponentType = 'old-refraction' | 'objective' | 'subjective' | 'final-subjective' | 'addition' | 'retinoscop' | 'retinoscop-dilation' | 'uncorrected-va' | 'keratometer'

export type ExamDataType = OldRefractionExam | ObjectiveExam | SubjectiveExam | FinalSubjectiveExam | AdditionExam | RetinoscopExam | RetinoscopDilationExam | UncorrectedVAExam | KeratometerExam

export interface FieldMapping {
  [sourceField: string]: string | null
}

export interface ComponentFieldMappings {
  [targetComponentType: string]: FieldMapping
}

export class ExamFieldMapper {
  private static defaultMaps: Record<ExamComponentType, ExamComponentType[]> = {
    'old-refraction': ['objective', 'subjective', 'final-subjective'],
    'objective': ['old-refraction', 'subjective', 'final-subjective'],
    'subjective': ['old-refraction', 'objective', 'final-subjective'],
    'final-subjective': ['old-refraction', 'objective', 'subjective'],
    'addition': ['final-subjective'],
    'retinoscop': ['old-refraction', 'objective', 'subjective', 'final-subjective'],
    'retinoscop-dilation': ['old-refraction', 'objective', 'subjective', 'final-subjective', 'retinoscop'],
    'uncorrected-va': ['old-refraction', 'objective', 'subjective', 'final-subjective'],
    'keratometer': ['objective', 'subjective']
  }

  private static explicitMappings: Partial<Record<ExamComponentType, ComponentFieldMappings>> = {
    'keratometer': {
      'objective': {
        r_k1: 'r_sph',
        r_k2: 'r_cyl',
        r_axis: 'r_ax',
        l_k1: 'l_sph',
        l_k2: 'l_cyl',
        l_axis: 'l_ax'
      },
      'subjective': {
        r_k1: 'r_sph',
        r_k2: 'r_cyl',
        r_axis: 'r_ax',
        l_k1: 'l_sph',
        l_k2: 'l_cyl',
        l_axis: 'l_ax'
      }
    }
  }

  private static getFieldNames(componentType: ExamComponentType): string[] {
    switch (componentType) {
      case 'old-refraction':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_ad', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_ad', 'comb_va']
      case 'objective':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_se', 'l_sph', 'l_cyl', 'l_ax', 'l_se']
      case 'subjective':
        return ['r_fa', 'r_fa_tuning', 'r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_pd_close', 'r_pd_far', 'l_fa', 'l_fa_tuning', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_pd_close', 'l_pd_far', 'comb_fa', 'comb_fa_tuning', 'comb_va', 'comb_pd_close', 'comb_pd_far']
      case 'final-subjective':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pr_h', 'r_base_h', 'r_pr_v', 'r_base_v', 'r_va', 'r_j', 'r_pd_close', 'r_pd_far', 'l_sph', 'l_cyl', 'l_ax', 'l_pr_h', 'l_base_h', 'l_pr_v', 'l_base_v', 'l_va', 'l_j', 'l_pd_close', 'l_pd_far', 'comb_va', 'comb_pd_close', 'comb_pd_far']
      case 'addition':
        return ['r_fcc', 'r_read', 'r_int', 'r_bif', 'r_mul', 'r_j', 'r_iop', 'l_fcc', 'l_read', 'l_int', 'l_bif', 'l_mul', 'l_j', 'l_iop']
      case 'retinoscop':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_reflex', 'l_sph', 'l_cyl', 'l_ax', 'l_reflex']
      case 'retinoscop-dilation':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_reflex', 'l_sph', 'l_cyl', 'l_ax', 'l_reflex']
      case 'uncorrected-va':
        return ['r_fv', 'r_iv', 'r_nv_j', 'l_fv', 'l_iv', 'l_nv_j']
      case 'keratometer':
        return ['r_k1', 'r_k2', 'r_axis', 'l_k1', 'l_k2', 'l_axis']
      default:
        return []
    }
  }

  private static generateDefaultMapping(sourceType: ExamComponentType, targetType: ExamComponentType): FieldMapping {
    const sourceFields = this.getFieldNames(sourceType)
    const targetFields = this.getFieldNames(targetType)
    const mapping: FieldMapping = {}

    sourceFields.forEach(sourceField => {
      if (targetFields.includes(sourceField)) {
        mapping[sourceField] = sourceField
      } else {
        mapping[sourceField] = null
      }
    })

    return mapping
  }

  static getFieldMapping(sourceType: ExamComponentType, targetType: ExamComponentType): FieldMapping {
    const explicitMapping = this.explicitMappings[sourceType]?.[targetType]
    if (explicitMapping) {
      return explicitMapping
    }

    const defaultMapList = this.defaultMaps[sourceType] || []
    if (defaultMapList.includes(targetType)) {
      return this.generateDefaultMapping(sourceType, targetType)
    }

    return {}
  }

  static copyData<T extends ExamDataType, U extends ExamDataType>(
    sourceData: T,
    targetData: U,
    sourceType: ExamComponentType,
    targetType: ExamComponentType
  ): Partial<U> {
    const mapping = this.getFieldMapping(sourceType, targetType)
    const result: Partial<U> = { ...targetData }

    Object.entries(mapping).forEach(([sourceField, targetField]) => {
      if (targetField && sourceField in sourceData && targetField in result) {
        const sourceValue = sourceData[sourceField as keyof T]
        if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
          (result as any)[targetField] = sourceValue
        }
      }
    })

    return result
  }

  static clearData<T extends ExamDataType>(data: T): Partial<T> {
    const clearedData: Partial<T> = { ...data }
    
    Object.keys(clearedData).forEach(key => {
      if (key !== 'id' && key !== 'layout_instance_id') {
        (clearedData as any)[key] = ''
      }
    })

    return clearedData
  }

  static updateMapping(
    sourceType: ExamComponentType,
    targetType: ExamComponentType,
    newMapping: FieldMapping
  ): void {
    if (!this.explicitMappings[sourceType]) {
      this.explicitMappings[sourceType] = {}
    }
    this.explicitMappings[sourceType][targetType] = newMapping
  }

  static addToDefaultMap(sourceType: ExamComponentType, targetType: ExamComponentType): void {
    if (!this.defaultMaps[sourceType]) {
      this.defaultMaps[sourceType] = []
    }
    if (!this.defaultMaps[sourceType].includes(targetType)) {
      this.defaultMaps[sourceType].push(targetType)
    }
  }

  static removeFromDefaultMap(sourceType: ExamComponentType, targetType: ExamComponentType): void {
    if (this.defaultMaps[sourceType]) {
      this.defaultMaps[sourceType] = this.defaultMaps[sourceType].filter(type => type !== targetType)
    }
  }

  static isInDefaultMap(sourceType: ExamComponentType, targetType: ExamComponentType): boolean {
    return this.defaultMaps[sourceType]?.includes(targetType) || false
  }

  static isComponentAvailable(componentType: ExamComponentType, availableComponents: ExamComponentType[]): boolean {
    return availableComponents.includes(componentType)
  }

  static getAvailableTargets(sourceType: ExamComponentType, availableComponents: ExamComponentType[]): ExamComponentType[] {
    const defaultTargets = this.defaultMaps[sourceType] || []
    const explicitTargets = Object.keys(this.explicitMappings[sourceType] || {}) as ExamComponentType[]
    
    const allTargets = [...new Set([...defaultTargets, ...explicitTargets])]
    return allTargets.filter(target => this.isComponentAvailable(target, availableComponents))
  }
} 