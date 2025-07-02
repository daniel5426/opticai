import { 
  LookupSupplier,
  LookupClinic,
  LookupOrderType,
  LookupReferralType,
  LookupLensModel,
  LookupColor,
  LookupMaterial,
  LookupCoating,
  LookupManufacturer,
  LookupFrameModel,
  LookupContactLensType,
  LookupContactEyeLensType,
  LookupContactEyeMaterial,
  LookupCleaningSolution,
  LookupDisinfectionSolution,
  LookupRinsingSolution,
  LookupManufacturingLab,
  LookupAdvisor
} from './schema'

export async function getAllLookupSuppliers(): Promise<LookupSupplier[]> {
  try {
    return await window.electronAPI.db('getAllLookupSuppliers')
  } catch (error) {
    console.error('Error getting suppliers:', error)
    return []
  }
}

export async function createLookupSupplier(data: Omit<LookupSupplier, 'id'>): Promise<LookupSupplier | null> {
  try {
    return await window.electronAPI.db('createLookupSupplier', data)
  } catch (error) {
    console.error('Error creating supplier:', error)
    return null
  }
}

export async function updateLookupSupplier(data: LookupSupplier): Promise<LookupSupplier | null> {
  try {
    return await window.electronAPI.db('updateLookupSupplier', data)
  } catch (error) {
    console.error('Error updating supplier:', error)
    return null
  }
}

export async function deleteLookupSupplier(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupSupplier', id)
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return false
  }
}

export async function getAllLookupClinics(): Promise<LookupClinic[]> {
  try {
    return await window.electronAPI.db('getAllLookupClinics')
  } catch (error) {
    console.error('Error getting clinics:', error)
    return []
  }
}

export async function createLookupClinic(data: Omit<LookupClinic, 'id'>): Promise<LookupClinic | null> {
  try {
    return await window.electronAPI.db('createLookupClinic', data)
  } catch (error) {
    console.error('Error creating clinic:', error)
    return null
  }
}

export async function updateLookupClinic(data: LookupClinic): Promise<LookupClinic | null> {
  try {
    return await window.electronAPI.db('updateLookupClinic', data)
  } catch (error) {
    console.error('Error updating clinic:', error)
    return null
  }
}

export async function deleteLookupClinic(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupClinic', id)
  } catch (error) {
    console.error('Error deleting clinic:', error)
    return false
  }
}

export async function getAllLookupOrderTypes(): Promise<LookupOrderType[]> {
  try {
    return await window.electronAPI.db('getAllLookupOrderTypes')
  } catch (error) {
    console.error('Error getting order types:', error)
    return []
  }
}

export async function createLookupOrderType(data: Omit<LookupOrderType, 'id'>): Promise<LookupOrderType | null> {
  try {
    return await window.electronAPI.db('createLookupOrderType', data)
  } catch (error) {
    console.error('Error creating order type:', error)
    return null
  }
}

export async function updateLookupOrderType(data: LookupOrderType): Promise<LookupOrderType | null> {
  try {
    return await window.electronAPI.db('updateLookupOrderType', data)
  } catch (error) {
    console.error('Error updating order type:', error)
    return null
  }
}

export async function deleteLookupOrderType(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupOrderType', id)
  } catch (error) {
    console.error('Error deleting order type:', error)
    return false
  }
}

export async function getAllLookupReferralTypes(): Promise<LookupReferralType[]> {
  try {
    return await window.electronAPI.db('getAllLookupReferralTypes')
  } catch (error) {
    console.error('Error getting referral types:', error)
    return []
  }
}

export async function createLookupReferralType(data: Omit<LookupReferralType, 'id'>): Promise<LookupReferralType | null> {
  try {
    return await window.electronAPI.db('createLookupReferralType', data)
  } catch (error) {
    console.error('Error creating referral type:', error)
    return null
  }
}

export async function updateLookupReferralType(data: LookupReferralType): Promise<LookupReferralType | null> {
  try {
    return await window.electronAPI.db('updateLookupReferralType', data)
  } catch (error) {
    console.error('Error updating referral type:', error)
    return null
  }
}

export async function deleteLookupReferralType(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupReferralType', id)
  } catch (error) {
    console.error('Error deleting referral type:', error)
    return false
  }
}

export async function getAllLookupLensModels(): Promise<LookupLensModel[]> {
  try {
    return await window.electronAPI.db('getAllLookupLensModels')
  } catch (error) {
    console.error('Error getting lens models:', error)
    return []
  }
}

export async function createLookupLensModel(data: Omit<LookupLensModel, 'id'>): Promise<LookupLensModel | null> {
  try {
    return await window.electronAPI.db('createLookupLensModel', data)
  } catch (error) {
    console.error('Error creating lens model:', error)
    return null
  }
}

export async function updateLookupLensModel(data: LookupLensModel): Promise<LookupLensModel | null> {
  try {
    return await window.electronAPI.db('updateLookupLensModel', data)
  } catch (error) {
    console.error('Error updating lens model:', error)
    return null
  }
}

export async function deleteLookupLensModel(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupLensModel', id)
  } catch (error) {
    console.error('Error deleting lens model:', error)
    return false
  }
}

export async function getAllLookupColors(): Promise<LookupColor[]> {
  try {
    return await window.electronAPI.db('getAllLookupColors')
  } catch (error) {
    console.error('Error getting colors:', error)
    return []
  }
}

export async function createLookupColor(data: Omit<LookupColor, 'id'>): Promise<LookupColor | null> {
  try {
    return await window.electronAPI.db('createLookupColor', data)
  } catch (error) {
    console.error('Error creating color:', error)
    return null
  }
}

export async function updateLookupColor(data: LookupColor): Promise<LookupColor | null> {
  try {
    return await window.electronAPI.db('updateLookupColor', data)
  } catch (error) {
    console.error('Error updating color:', error)
    return null
  }
}

export async function deleteLookupColor(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupColor', id)
  } catch (error) {
    console.error('Error deleting color:', error)
    return false
  }
}

export async function getAllLookupMaterials(): Promise<LookupMaterial[]> {
  try {
    return await window.electronAPI.db('getAllLookupMaterials')
  } catch (error) {
    console.error('Error getting materials:', error)
    return []
  }
}

export async function createLookupMaterial(data: Omit<LookupMaterial, 'id'>): Promise<LookupMaterial | null> {
  try {
    return await window.electronAPI.db('createLookupMaterial', data)
  } catch (error) {
    console.error('Error creating material:', error)
    return null
  }
}

export async function updateLookupMaterial(data: LookupMaterial): Promise<LookupMaterial | null> {
  try {
    return await window.electronAPI.db('updateLookupMaterial', data)
  } catch (error) {
    console.error('Error updating material:', error)
    return null
  }
}

export async function deleteLookupMaterial(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupMaterial', id)
  } catch (error) {
    console.error('Error deleting material:', error)
    return false
  }
}

export async function getAllLookupCoatings(): Promise<LookupCoating[]> {
  try {
    return await window.electronAPI.db('getAllLookupCoatings')
  } catch (error) {
    console.error('Error getting coatings:', error)
    return []
  }
}

export async function createLookupCoating(data: Omit<LookupCoating, 'id'>): Promise<LookupCoating | null> {
  try {
    return await window.electronAPI.db('createLookupCoating', data)
  } catch (error) {
    console.error('Error creating coating:', error)
    return null
  }
}

export async function updateLookupCoating(data: LookupCoating): Promise<LookupCoating | null> {
  try {
    return await window.electronAPI.db('updateLookupCoating', data)
  } catch (error) {
    console.error('Error updating coating:', error)
    return null
  }
}

export async function deleteLookupCoating(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupCoating', id)
  } catch (error) {
    console.error('Error deleting coating:', error)
    return false
  }
}

export async function getAllLookupManufacturers(): Promise<LookupManufacturer[]> {
  try {
    return await window.electronAPI.db('getAllLookupManufacturers')
  } catch (error) {
    console.error('Error getting manufacturers:', error)
    return []
  }
}

export async function createLookupManufacturer(data: Omit<LookupManufacturer, 'id'>): Promise<LookupManufacturer | null> {
  try {
    return await window.electronAPI.db('createLookupManufacturer', data)
  } catch (error) {
    console.error('Error creating manufacturer:', error)
    return null
  }
}

export async function updateLookupManufacturer(data: LookupManufacturer): Promise<LookupManufacturer | null> {
  try {
    return await window.electronAPI.db('updateLookupManufacturer', data)
  } catch (error) {
    console.error('Error updating manufacturer:', error)
    return null
  }
}

export async function deleteLookupManufacturer(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupManufacturer', id)
  } catch (error) {
    console.error('Error deleting manufacturer:', error)
    return false
  }
}

export async function getAllLookupFrameModels(): Promise<LookupFrameModel[]> {
  try {
    return await window.electronAPI.db('getAllLookupFrameModels')
  } catch (error) {
    console.error('Error getting frame models:', error)
    return []
  }
}

export async function createLookupFrameModel(data: Omit<LookupFrameModel, 'id'>): Promise<LookupFrameModel | null> {
  try {
    return await window.electronAPI.db('createLookupFrameModel', data)
  } catch (error) {
    console.error('Error creating frame model:', error)
    return null
  }
}

export async function updateLookupFrameModel(data: LookupFrameModel): Promise<LookupFrameModel | null> {
  try {
    return await window.electronAPI.db('updateLookupFrameModel', data)
  } catch (error) {
    console.error('Error updating frame model:', error)
    return null
  }
}

export async function deleteLookupFrameModel(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupFrameModel', id)
  } catch (error) {
    console.error('Error deleting frame model:', error)
    return false
  }
}

export async function getAllLookupContactLensTypes(): Promise<LookupContactLensType[]> {
  try {
    return await window.electronAPI.db('getAllLookupContactLensTypes')
  } catch (error) {
    console.error('Error getting contact lens types:', error)
    return []
  }
}

export async function createLookupContactLensType(data: Omit<LookupContactLensType, 'id'>): Promise<LookupContactLensType | null> {
  try {
    return await window.electronAPI.db('createLookupContactLensType', data)
  } catch (error) {
    console.error('Error creating contact lens type:', error)
    return null
  }
}

export async function updateLookupContactLensType(data: LookupContactLensType): Promise<LookupContactLensType | null> {
  try {
    return await window.electronAPI.db('updateLookupContactLensType', data)
  } catch (error) {
    console.error('Error updating contact lens type:', error)
    return null
  }
}

export async function deleteLookupContactLensType(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupContactLensType', id)
  } catch (error) {
    console.error('Error deleting contact lens type:', error)
    return false
  }
}

export async function getAllLookupContactEyeLensTypes(): Promise<LookupContactEyeLensType[]> {
  try {
    return await window.electronAPI.db('getAllLookupContactEyeLensTypes')
  } catch (error) {
    console.error('Error getting contact eye lens types:', error)
    return []
  }
}

export async function createLookupContactEyeLensType(data: Omit<LookupContactEyeLensType, 'id'>): Promise<LookupContactEyeLensType | null> {
  try {
    return await window.electronAPI.db('createLookupContactEyeLensType', data)
  } catch (error) {
    console.error('Error creating contact eye lens type:', error)
    return null
  }
}

export async function updateLookupContactEyeLensType(data: LookupContactEyeLensType): Promise<LookupContactEyeLensType | null> {
  try {
    return await window.electronAPI.db('updateLookupContactEyeLensType', data)
  } catch (error) {
    console.error('Error updating contact eye lens type:', error)
    return null
  }
}

export async function deleteLookupContactEyeLensType(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupContactEyeLensType', id)
  } catch (error) {
    console.error('Error deleting contact eye lens type:', error)
    return false
  }
}

export async function getAllLookupContactEyeMaterials(): Promise<LookupContactEyeMaterial[]> {
  try {
    return await window.electronAPI.db('getAllLookupContactEyeMaterials')
  } catch (error) {
    console.error('Error getting contact eye materials:', error)
    return []
  }
}

export async function createLookupContactEyeMaterial(data: Omit<LookupContactEyeMaterial, 'id'>): Promise<LookupContactEyeMaterial | null> {
  try {
    return await window.electronAPI.db('createLookupContactEyeMaterial', data)
  } catch (error) {
    console.error('Error creating contact eye material:', error)
    return null
  }
}

export async function updateLookupContactEyeMaterial(data: LookupContactEyeMaterial): Promise<LookupContactEyeMaterial | null> {
  try {
    return await window.electronAPI.db('updateLookupContactEyeMaterial', data)
  } catch (error) {
    console.error('Error updating contact eye material:', error)
    return null
  }
}

export async function deleteLookupContactEyeMaterial(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupContactEyeMaterial', id)
  } catch (error) {
    console.error('Error deleting contact eye material:', error)
    return false
  }
}

export async function getAllLookupCleaningSolutions(): Promise<LookupCleaningSolution[]> {
  try {
    return await window.electronAPI.db('getAllLookupCleaningSolutions')
  } catch (error) {
    console.error('Error getting cleaning solutions:', error)
    return []
  }
}

export async function createLookupCleaningSolution(data: Omit<LookupCleaningSolution, 'id'>): Promise<LookupCleaningSolution | null> {
  try {
    return await window.electronAPI.db('createLookupCleaningSolution', data)
  } catch (error) {
    console.error('Error creating cleaning solution:', error)
    return null
  }
}

export async function updateLookupCleaningSolution(data: LookupCleaningSolution): Promise<LookupCleaningSolution | null> {
  try {
    return await window.electronAPI.db('updateLookupCleaningSolution', data)
  } catch (error) {
    console.error('Error updating cleaning solution:', error)
    return null
  }
}

export async function deleteLookupCleaningSolution(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupCleaningSolution', id)
  } catch (error) {
    console.error('Error deleting cleaning solution:', error)
    return false
  }
}

export async function getAllLookupDisinfectionSolutions(): Promise<LookupDisinfectionSolution[]> {
  try {
    return await window.electronAPI.db('getAllLookupDisinfectionSolutions')
  } catch (error) {
    console.error('Error getting disinfection solutions:', error)
    return []
  }
}

export async function createLookupDisinfectionSolution(data: Omit<LookupDisinfectionSolution, 'id'>): Promise<LookupDisinfectionSolution | null> {
  try {
    return await window.electronAPI.db('createLookupDisinfectionSolution', data)
  } catch (error) {
    console.error('Error creating disinfection solution:', error)
    return null
  }
}

export async function updateLookupDisinfectionSolution(data: LookupDisinfectionSolution): Promise<LookupDisinfectionSolution | null> {
  try {
    return await window.electronAPI.db('updateLookupDisinfectionSolution', data)
  } catch (error) {
    console.error('Error updating disinfection solution:', error)
    return null
  }
}

export async function deleteLookupDisinfectionSolution(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupDisinfectionSolution', id)
  } catch (error) {
    console.error('Error deleting disinfection solution:', error)
    return false
  }
}

export async function getAllLookupRinsingSolutions(): Promise<LookupRinsingSolution[]> {
  try {
    return await window.electronAPI.db('getAllLookupRinsingSolutions')
  } catch (error) {
    console.error('Error getting rinsing solutions:', error)
    return []
  }
}

export async function createLookupRinsingSolution(data: Omit<LookupRinsingSolution, 'id'>): Promise<LookupRinsingSolution | null> {
  try {
    return await window.electronAPI.db('createLookupRinsingSolution', data)
  } catch (error) {
    console.error('Error creating rinsing solution:', error)
    return null
  }
}

export async function updateLookupRinsingSolution(data: LookupRinsingSolution): Promise<LookupRinsingSolution | null> {
  try {
    return await window.electronAPI.db('updateLookupRinsingSolution', data)
  } catch (error) {
    console.error('Error updating rinsing solution:', error)
    return null
  }
}

export async function deleteLookupRinsingSolution(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupRinsingSolution', id)
  } catch (error) {
    console.error('Error deleting rinsing solution:', error)
    return false
  }
}

export async function getAllLookupManufacturingLabs(): Promise<LookupManufacturingLab[]> {
  try {
    return await window.electronAPI.db('getAllLookupManufacturingLabs')
  } catch (error) {
    console.error('Error getting manufacturing labs:', error)
    return []
  }
}

export async function createLookupManufacturingLab(data: Omit<LookupManufacturingLab, 'id'>): Promise<LookupManufacturingLab | null> {
  try {
    return await window.electronAPI.db('createLookupManufacturingLab', data)
  } catch (error) {
    console.error('Error creating manufacturing lab:', error)
    return null
  }
}

export async function updateLookupManufacturingLab(data: LookupManufacturingLab): Promise<LookupManufacturingLab | null> {
  try {
    return await window.electronAPI.db('updateLookupManufacturingLab', data)
  } catch (error) {
    console.error('Error updating manufacturing lab:', error)
    return null
  }
}

export async function deleteLookupManufacturingLab(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupManufacturingLab', id)
  } catch (error) {
    console.error('Error deleting manufacturing lab:', error)
    return false
  }
}

export async function getAllLookupAdvisors(): Promise<LookupAdvisor[]> {
  try {
    return await window.electronAPI.db('getAllLookupAdvisors')
  } catch (error) {
    console.error('Error getting advisors:', error)
    return []
  }
}

export async function createLookupAdvisor(data: Omit<LookupAdvisor, 'id'>): Promise<LookupAdvisor | null> {
  try {
    return await window.electronAPI.db('createLookupAdvisor', data)
  } catch (error) {
    console.error('Error creating advisor:', error)
    return null
  }
}

export async function updateLookupAdvisor(data: LookupAdvisor): Promise<LookupAdvisor | null> {
  try {
    return await window.electronAPI.db('updateLookupAdvisor', data)
  } catch (error) {
    console.error('Error updating advisor:', error)
    return null
  }
}

export async function deleteLookupAdvisor(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteLookupAdvisor', id)
  } catch (error) {
    console.error('Error deleting advisor:', error)
    return false
  }
}

export const lookupTables = {
  supplier: {
    getAll: getAllLookupSuppliers,
    create: createLookupSupplier,
    update: updateLookupSupplier,
    delete: deleteLookupSupplier,
    displayName: 'ספקים'
  },
  clinic: {
    getAll: getAllLookupClinics,
    create: createLookupClinic,
    update: updateLookupClinic,
    delete: deleteLookupClinic,
    displayName: 'מרפאות/סניפים'
  },
  orderType: {
    getAll: getAllLookupOrderTypes,
    create: createLookupOrderType,
    update: updateLookupOrderType,
    delete: deleteLookupOrderType,
    displayName: 'סוגי הזמנות'
  },
  referralType: {
    getAll: getAllLookupReferralTypes,
    create: createLookupReferralType,
    update: updateLookupReferralType,
    delete: deleteLookupReferralType,
    displayName: 'סוגי הפניות'
  },
  lensModel: {
    getAll: getAllLookupLensModels,
    create: createLookupLensModel,
    update: updateLookupLensModel,
    delete: deleteLookupLensModel,
    displayName: 'דגמי עדשות'
  },
  color: {
    getAll: getAllLookupColors,
    create: createLookupColor,
    update: updateLookupColor,
    delete: deleteLookupColor,
    displayName: 'צבעים'
  },
  material: {
    getAll: getAllLookupMaterials,
    create: createLookupMaterial,
    update: updateLookupMaterial,
    delete: deleteLookupMaterial,
    displayName: 'חומרים'
  },
  coating: {
    getAll: getAllLookupCoatings,
    create: createLookupCoating,
    update: updateLookupCoating,
    delete: deleteLookupCoating,
    displayName: 'ציפויים'
  },
  manufacturer: {
    getAll: getAllLookupManufacturers,
    create: createLookupManufacturer,
    update: updateLookupManufacturer,
    delete: deleteLookupManufacturer,
    displayName: 'יצרנים'
  },
  frameModel: {
    getAll: getAllLookupFrameModels,
    create: createLookupFrameModel,
    update: updateLookupFrameModel,
    delete: deleteLookupFrameModel,
    displayName: 'דגמי מסגרות'
  },
  contactLensType: {
    getAll: getAllLookupContactLensTypes,
    create: createLookupContactLensType,
    update: updateLookupContactLensType,
    delete: deleteLookupContactLensType,
    displayName: 'סוגי עדשות מגע'
  },
  contactEyeLensType: {
    getAll: getAllLookupContactEyeLensTypes,
    create: createLookupContactEyeLensType,
    update: updateLookupContactEyeLensType,
    delete: deleteLookupContactEyeLensType,
    displayName: 'סוגי עדשות מגע לעין'
  },
  contactEyeMaterial: {
    getAll: getAllLookupContactEyeMaterials,
    create: createLookupContactEyeMaterial,
    update: updateLookupContactEyeMaterial,
    delete: deleteLookupContactEyeMaterial,
    displayName: 'חומרי עדשות מגע'
  },
  cleaningSolution: {
    getAll: getAllLookupCleaningSolutions,
    create: createLookupCleaningSolution,
    update: updateLookupCleaningSolution,
    delete: deleteLookupCleaningSolution,
    displayName: 'תמיסות ניקוי'
  },
  disinfectionSolution: {
    getAll: getAllLookupDisinfectionSolutions,
    create: createLookupDisinfectionSolution,
    update: updateLookupDisinfectionSolution,
    delete: deleteLookupDisinfectionSolution,
    displayName: 'תמיסות חיטוי'
  },
  rinsingSolution: {
    getAll: getAllLookupRinsingSolutions,
    create: createLookupRinsingSolution,
    update: updateLookupRinsingSolution,
    delete: deleteLookupRinsingSolution,
    displayName: 'תמיסות שטיפה'
  },
  manufacturingLab: {
    getAll: getAllLookupManufacturingLabs,
    create: createLookupManufacturingLab,
    update: updateLookupManufacturingLab,
    delete: deleteLookupManufacturingLab,
    displayName: 'מעבדות ייצור'
  },
  advisor: {
    getAll: getAllLookupAdvisors,
    create: createLookupAdvisor,
    update: updateLookupAdvisor,
    delete: deleteLookupAdvisor,
    displayName: 'יועצים'
  }
} 