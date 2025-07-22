import {
  OpticalExam,
  OldRefExam,
  OldRefractionExam,
  OldRefractionExtensionExam,
  ObjectiveExam,
  SubjectiveExam,
  FinalSubjectiveExam,
  FinalPrescriptionExam,
  CompactPrescriptionExam,
  AdditionExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  UncorrectedVAExam,
  KeratometerExam,
  KeratometerFullExam,
  CornealTopographyExam,
  CoverTestExam,
  SchirmerTestExam,
  ContactLensDiameters,
  ContactLensDetails,
  KeratometerContactLens,
  ContactLensExam,
  ContactLensOrder
} from './db/schema'

export type ExamComponentType =
  | 'exam-details'
  | 'old-ref'
  | 'old-refraction'
  | 'old-refraction-extension'
  | 'objective'
  | 'subjective'
  | 'addition'
  | 'final-subjective'
  | 'final-prescription'
  | 'compact-prescription'
  | 'retinoscop'
  | 'retinoscop-dilation'
  | 'uncorrected-va'
  | 'keratometer'
  | 'keratometer-full'
  | 'corneal-topography'
  | 'cover-test'
  | 'schirmer-test'
  | 'anamnesis'
  | 'notes'
  | 'contact-lens-diameters'
  | 'contact-lens-details'
  | 'keratometer-contact-lens'
  | 'contact-lens-exam'
  | 'contact-lens-order';

export const fullExamsList: ExamComponentType[] = [
  'exam-details',
  'old-ref',
  'old-refraction',
  'old-refraction-extension',
  'objective',
  'subjective',
  'addition',
  'final-subjective',
  'final-prescription',
  'compact-prescription',
  'retinoscop',
  'retinoscop-dilation',
  'uncorrected-va',
  'keratometer',
  'keratometer-full',
  'corneal-topography',
  'cover-test',
  'schirmer-test',
  'anamnesis',
  'notes',
  'contact-lens-diameters',
  'contact-lens-details',
  'keratometer-contact-lens',
  'contact-lens-exam',
  'contact-lens-order',
];

export const examComponentTypeToExamFields: Record<ExamComponentType, ExamComponentType[]> = {
  'exam-details': [],
  'old-ref': [],
  'old-refraction': [],
  'old-refraction-extension': [],
  'objective': [],
  'subjective': [],
  'addition': [],
  'final-subjective': [],
  'final-prescription': [],
  'compact-prescription': [],
  'retinoscop': [],
  'retinoscop-dilation': [],
  'uncorrected-va': [],
  'keratometer': [],
  'keratometer-full': [],
  'corneal-topography': [],
  'cover-test': [],
  'schirmer-test': [],
  'anamnesis': [],
  'notes': [],
  'contact-lens-diameters': [],
  'contact-lens-details': [],
  'keratometer-contact-lens': [],
  'contact-lens-exam': [],
  'contact-lens-order': [],
};

export type ExamDataType = OpticalExam | OldRefExam | OldRefractionExam | OldRefractionExtensionExam | ObjectiveExam | SubjectiveExam | FinalSubjectiveExam | FinalPrescriptionExam | CompactPrescriptionExam | AdditionExam | RetinoscopExam | RetinoscopDilationExam | UncorrectedVAExam | KeratometerExam | KeratometerFullExam | CornealTopographyExam | CoverTestExam | SchirmerTestExam | ContactLensDiameters | ContactLensDetails | KeratometerContactLens | ContactLensExam | ContactLensOrder

export interface FieldMapping {
  [sourceField: string]: string | null
}

export interface ComponentFieldMappings {
  [targetComponentType: string]: FieldMapping
}

export class ExamFieldMapper {
  private static defaultMaps: Record<ExamComponentType, ExamComponentType[]> = {
    'exam-details': [],
    'old-ref': [],
    'old-refraction': fullExamsList,
    'old-refraction-extension': fullExamsList,
    'objective': fullExamsList,
    'subjective': fullExamsList,
    'final-subjective': fullExamsList,
    'final-prescription': fullExamsList,
    'compact-prescription': fullExamsList,
    'addition': fullExamsList,
    'retinoscop': fullExamsList,
    'retinoscop-dilation': fullExamsList,
    'uncorrected-va': [],
    'keratometer': fullExamsList,
    'keratometer-full': fullExamsList,
    'corneal-topography': fullExamsList,
    'cover-test': [],
    'schirmer-test': [],
    'anamnesis': [],
    'notes': [],
    'contact-lens-diameters': fullExamsList,
    'contact-lens-details': fullExamsList,
    'keratometer-contact-lens': fullExamsList,
    'contact-lens-exam': fullExamsList,
    'contact-lens-order': []
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
      case 'exam-details':
        return ['exam_date', 'test_name', 'clinic', 'user_id', 'dominant_eye']
      case 'old-ref':
        return ['role', 'source', 'contacts']
      case 'old-refraction':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_ad', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_ad', 'comb_va']
      case 'old-refraction-extension':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pr_h', 'r_base_h', 'r_pr_v', 'r_base_v', 'r_va', 'r_ad', 'r_j', 'r_pd_far', 'r_pd_close', 'l_sph', 'l_cyl', 'l_ax', 'l_pr_h', 'l_base_h', 'l_pr_v', 'l_base_v', 'l_va', 'l_ad', 'l_j', 'l_pd_far', 'l_pd_close', 'comb_va', 'comb_pd_far', 'comb_pd_close']
      case 'objective':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_se', 'l_sph', 'l_cyl', 'l_ax', 'l_se']
      case 'subjective':
        return ['r_fa', 'r_fa_tuning', 'r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_pd_close', 'r_pd_far', 'l_fa', 'l_fa_tuning', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_pd_close', 'l_pd_far', 'comb_fa', 'comb_fa_tuning', 'comb_va', 'comb_pd_close', 'comb_pd_far']
      case 'final-subjective':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pr_h', 'r_base_h', 'r_pr_v', 'r_base_v', 'r_va', 'r_j', 'r_pd_close', 'r_pd_far', 'l_sph', 'l_cyl', 'l_ax', 'l_pr_h', 'l_base_h', 'l_pr_v', 'l_base_v', 'l_va', 'l_j', 'l_pd_close', 'l_pd_far', 'comb_va', 'comb_pd_close', 'comb_pd_far']
      case 'final-prescription':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_ad', 'r_pd', 'r_high', 'r_diam', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_ad', 'l_pd', 'l_high', 'l_diam', 'comb_va', 'comb_pd', 'comb_high']
      case 'compact-prescription':
        return ['r_sph', 'r_cyl', 'r_ax', 'r_pris', 'r_base', 'r_va', 'r_ad', 'r_pd', 'l_sph', 'l_cyl', 'l_ax', 'l_pris', 'l_base', 'l_va', 'l_ad', 'l_pd', 'comb_va', 'comb_pd']
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
      case 'keratometer-full':
        return [
          'r_dpt_k1', 'r_dpt_k2', 'l_dpt_k1', 'l_dpt_k2',
          'r_mm_k1', 'r_mm_k2', 'l_mm_k1', 'l_mm_k2',
          'r_mer_k1', 'r_mer_k2', 'l_mer_k1', 'l_mer_k2',
          'r_astig', 'l_astig'
        ]
      case 'corneal-topography':
        return ['l_note', 'r_note', 'title']
      case 'cover-test':
        return ['deviation_type', 'deviation_direction', 'fv_1', 'fv_2', 'nv_1', 'nv_2']
      case 'schirmer-test':
        return ['r_mm', 'l_mm', 'r_but', 'l_but']
      case 'notes':
        return ['title', 'note']
      case 'contact-lens-diameters':
        return ['pupil_diameter', 'corneal_diameter', 'eyelid_aperture']
      case 'contact-lens-details':
        return ['r_type', 'r_model', 'r_supplier', 'r_material', 'r_color', 'r_quantity', 'r_order_quantity', 'r_dx', 'l_type', 'l_model', 'l_supplier', 'l_material', 'l_color', 'l_quantity', 'l_order_quantity', 'l_dx']
      case 'keratometer-contact-lens':
        return ['r_rh', 'r_rv', 'r_avg', 'r_cyl', 'r_ax', 'r_ecc', 'l_rh', 'l_rv', 'l_avg', 'l_cyl', 'l_ax', 'l_ecc']
      case 'contact-lens-exam':
        return ['r_bc', 'r_oz', 'r_diam', 'r_sph', 'r_cyl', 'r_ax', 'r_read_ad', 'r_va', 'r_j', 'l_bc', 'l_oz', 'l_diam', 'l_sph', 'l_cyl', 'l_ax', 'l_read_ad', 'l_va', 'l_j', 'comb_va']
      case 'contact-lens-order':
        return ['contact_lens_id', 'branch', 'supply_in_branch', 'order_status', 'advisor', 'deliverer', 'delivery_date', 'priority', 'guaranteed_date', 'approval_date', 'cleaning_solution', 'disinfection_solution', 'rinsing_solution']
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

  static copyData(
    sourceData: Record<string, any>,
    targetData: Record<string, any>,
    sourceType: ExamComponentType,
    targetType: ExamComponentType
  ): Record<string, any> {
    const mapping = this.getFieldMapping(sourceType, targetType)
    const result: Record<string, any> = { ...targetData }

    Object.entries(mapping).forEach(([sourceField, targetField]) => {
      if (targetField) {
        const sourceValue = (sourceData as any)[sourceField] ?? ''
        ;(result as any)[targetField] = sourceValue
      }
    })

    return result
  }

  static clearData(data: Record<string, any>, componentType: ExamComponentType): Record<string, any> {
    const clearedData: Record<string, any> = { ...data }

    this.getFieldNames(componentType).forEach(key => {
      clearedData[key as keyof Record<string, any>] = '' as any
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