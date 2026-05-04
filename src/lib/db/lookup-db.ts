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
  LookupContactLensModel,
  LookupCleaningSolution,
  LookupDisinfectionSolution,
  LookupRinsingSolution,
  LookupManufacturingLab,
  LookupAdvisor,
  LookupVAMeter,
  LookupVADecimal
} from './schema-interface';
import { apiClient } from '../api-client';

// Generic lookup functions
async function getLookupItems<T>(tableName: string, clinicId?: number): Promise<T[]> {
  if (!clinicId) return [];
  try {
    const response = await apiClient.getLookupTable(tableName, clinicId);
    if (response.error) {
      console.error(`Error getting ${tableName}:`, response.error);
      return [];
    }
    return (response.data as T[]) || [];
  } catch (error) {
    console.error(`Error getting ${tableName}:`, error);
    return [];
  }
}

async function createLookupItem<T>(tableName: string, data: any): Promise<T | null> {
  try {
    const response = await apiClient.createLookupItem(tableName, data);
    if (response.error) {
      console.error(`Error creating ${tableName}:`, response.error);
      return null;
    }
    return (response.data as T) || null;
  } catch (error) {
    console.error(`Error creating ${tableName}:`, error);
    return null;
  }
}

async function updateLookupItem<T>(tableName: string, data: any): Promise<T | null> {
  try {
    if (!data.id) {
      console.error(`Error updating ${tableName}: No ID provided`);
      return null;
    }
    if (!data.clinic_id) {
      console.error(`Error updating ${tableName}: No clinic ID provided`);
      return null;
    }
    const response = await apiClient.updateLookupItem(tableName, data.id, data.clinic_id, data);
    if (response.error) {
      console.error(`Error updating ${tableName}:`, response.error);
      return null;
    }
    return (response.data as T) || null;
  } catch (error) {
    console.error(`Error updating ${tableName}:`, error);
    return null;
  }
}

async function deleteLookupItem(tableName: string, id: number, clinicId?: number): Promise<boolean> {
  if (!clinicId) return false;
  try {
    const response = await apiClient.deleteLookupItem(tableName, id, clinicId);
    if (response.error) {
      console.error(`Error deleting ${tableName}:`, response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error deleting ${tableName}:`, error);
    return false;
  }
}

// Supplier functions
export async function getAllLookupSuppliers(): Promise<LookupSupplier[]> {
  return getLookupItems<LookupSupplier>('suppliers');
}

export async function createLookupSupplier(data: Omit<LookupSupplier, 'id'>): Promise<LookupSupplier | null> {
  return createLookupItem<LookupSupplier>('suppliers', data);
}

export async function updateLookupSupplier(data: LookupSupplier): Promise<LookupSupplier | null> {
  return updateLookupItem<LookupSupplier>('suppliers', data);
}

export async function deleteLookupSupplier(id: number): Promise<boolean> {
  return deleteLookupItem('suppliers', id);
}

// Clinic functions
export async function getAllLookupClinics(): Promise<LookupClinic[]> {
  return getLookupItems<LookupClinic>('clinics');
}

export async function createLookupClinic(data: Omit<LookupClinic, 'id'>): Promise<LookupClinic | null> {
  return createLookupItem<LookupClinic>('clinics', data);
}

export async function updateLookupClinic(data: LookupClinic): Promise<LookupClinic | null> {
  return updateLookupItem<LookupClinic>('clinics', data);
}

export async function deleteLookupClinic(id: number): Promise<boolean> {
  return deleteLookupItem('clinics', id);
}

// Order Type functions
export async function getAllLookupOrderTypes(): Promise<LookupOrderType[]> {
  return getLookupItems<LookupOrderType>('order-types');
}

export async function createLookupOrderType(data: Omit<LookupOrderType, 'id'>): Promise<LookupOrderType | null> {
  return createLookupItem<LookupOrderType>('order-types', data);
}

export async function updateLookupOrderType(data: LookupOrderType): Promise<LookupOrderType | null> {
  return updateLookupItem<LookupOrderType>('order-types', data);
}

export async function deleteLookupOrderType(id: number): Promise<boolean> {
  return deleteLookupItem('order-types', id);
}

// Referral Type functions
export async function getAllLookupReferralTypes(): Promise<LookupReferralType[]> {
  return getLookupItems<LookupReferralType>('referral-types');
}

export async function createLookupReferralType(data: Omit<LookupReferralType, 'id'>): Promise<LookupReferralType | null> {
  return createLookupItem<LookupReferralType>('referral-types', data);
}

export async function updateLookupReferralType(data: LookupReferralType): Promise<LookupReferralType | null> {
  return updateLookupItem<LookupReferralType>('referral-types', data);
}

export async function deleteLookupReferralType(id: number): Promise<boolean> {
  return deleteLookupItem('referral-types', id);
}

// Lens Model functions
export async function getAllLookupLensModels(): Promise<LookupLensModel[]> {
  return getLookupItems<LookupLensModel>('lens-models');
}

export async function createLookupLensModel(data: Omit<LookupLensModel, 'id'>): Promise<LookupLensModel | null> {
  return createLookupItem<LookupLensModel>('lens-models', data);
}

export async function updateLookupLensModel(data: LookupLensModel): Promise<LookupLensModel | null> {
  return updateLookupItem<LookupLensModel>('lens-models', data);
}

export async function deleteLookupLensModel(id: number): Promise<boolean> {
  return deleteLookupItem('lens-models', id);
}

// Color functions
export async function getAllLookupColors(): Promise<LookupColor[]> {
  return getLookupItems<LookupColor>('colors');
}

export async function createLookupColor(data: Omit<LookupColor, 'id'>): Promise<LookupColor | null> {
  return createLookupItem<LookupColor>('colors', data);
}

export async function updateLookupColor(data: LookupColor): Promise<LookupColor | null> {
  return updateLookupItem<LookupColor>('colors', data);
}

export async function deleteLookupColor(id: number): Promise<boolean> {
  return deleteLookupItem('colors', id);
}

// Material functions
export async function getAllLookupMaterials(): Promise<LookupMaterial[]> {
  return getLookupItems<LookupMaterial>('materials');
}

export async function createLookupMaterial(data: Omit<LookupMaterial, 'id'>): Promise<LookupMaterial | null> {
  return createLookupItem<LookupMaterial>('materials', data);
}

export async function updateLookupMaterial(data: LookupMaterial): Promise<LookupMaterial | null> {
  return updateLookupItem<LookupMaterial>('materials', data);
}

export async function deleteLookupMaterial(id: number): Promise<boolean> {
  return deleteLookupItem('materials', id);
}

// Coating functions
export async function getAllLookupCoatings(): Promise<LookupCoating[]> {
  return getLookupItems<LookupCoating>('coatings');
}

export async function createLookupCoating(data: Omit<LookupCoating, 'id'>): Promise<LookupCoating | null> {
  return createLookupItem<LookupCoating>('coatings', data);
}

export async function updateLookupCoating(data: LookupCoating): Promise<LookupCoating | null> {
  return updateLookupItem<LookupCoating>('coatings', data);
}

export async function deleteLookupCoating(id: number): Promise<boolean> {
  return deleteLookupItem('coatings', id);
}

// Manufacturer functions
export async function getAllLookupManufacturers(): Promise<LookupManufacturer[]> {
  return getLookupItems<LookupManufacturer>('manufacturers');
}

export async function createLookupManufacturer(data: Omit<LookupManufacturer, 'id'>): Promise<LookupManufacturer | null> {
  return createLookupItem<LookupManufacturer>('manufacturers', data);
}

export async function updateLookupManufacturer(data: LookupManufacturer): Promise<LookupManufacturer | null> {
  return updateLookupItem<LookupManufacturer>('manufacturers', data);
}

export async function deleteLookupManufacturer(id: number): Promise<boolean> {
  return deleteLookupItem('manufacturers', id);
}

// Frame Model functions
export async function getAllLookupFrameModels(): Promise<LookupFrameModel[]> {
  return getLookupItems<LookupFrameModel>('frame-models');
}

export async function createLookupFrameModel(data: Omit<LookupFrameModel, 'id'>): Promise<LookupFrameModel | null> {
  return createLookupItem<LookupFrameModel>('frame-models', data);
}

export async function updateLookupFrameModel(data: LookupFrameModel): Promise<LookupFrameModel | null> {
  return updateLookupItem<LookupFrameModel>('frame-models', data);
}

export async function deleteLookupFrameModel(id: number): Promise<boolean> {
  return deleteLookupItem('frame-models', id);
}

// Contact Lens Type functions
export async function getAllLookupContactLensTypes(): Promise<LookupContactLensType[]> {
  return getLookupItems<LookupContactLensType>('contact-lens-types');
}

export async function createLookupContactLensType(data: Omit<LookupContactLensType, 'id'>): Promise<LookupContactLensType | null> {
  return createLookupItem<LookupContactLensType>('contact-lens-types', data);
}

export async function updateLookupContactLensType(data: LookupContactLensType): Promise<LookupContactLensType | null> {
  return updateLookupItem<LookupContactLensType>('contact-lens-types', data);
}

export async function deleteLookupContactLensType(id: number): Promise<boolean> {
  return deleteLookupItem('contact-lens-types', id);
}

// Contact Eye Lens Type functions
export async function getAllLookupContactEyeLensTypes(): Promise<LookupContactEyeLensType[]> {
  return getLookupItems<LookupContactEyeLensType>('contact-eye-lens-types');
}

export async function createLookupContactEyeLensType(data: Omit<LookupContactEyeLensType, 'id'>): Promise<LookupContactEyeLensType | null> {
  return createLookupItem<LookupContactEyeLensType>('contact-eye-lens-types', data);
}

export async function updateLookupContactEyeLensType(data: LookupContactEyeLensType): Promise<LookupContactEyeLensType | null> {
  return updateLookupItem<LookupContactEyeLensType>('contact-eye-lens-types', data);
}

export async function deleteLookupContactEyeLensType(id: number): Promise<boolean> {
  return deleteLookupItem('contact-eye-lens-types', id);
}

// Contact Eye Material functions
export async function getAllLookupContactEyeMaterials(): Promise<LookupContactEyeMaterial[]> {
  return getLookupItems<LookupContactEyeMaterial>('contact-eye-materials');
}

export async function createLookupContactEyeMaterial(data: Omit<LookupContactEyeMaterial, 'id'>): Promise<LookupContactEyeMaterial | null> {
  return createLookupItem<LookupContactEyeMaterial>('contact-eye-materials', data);
}

export async function updateLookupContactEyeMaterial(data: LookupContactEyeMaterial): Promise<LookupContactEyeMaterial | null> {
  return updateLookupItem<LookupContactEyeMaterial>('contact-eye-materials', data);
}

export async function deleteLookupContactEyeMaterial(id: number): Promise<boolean> {
  return deleteLookupItem('contact-eye-materials', id);
}

// Contact Lens Model functions
export async function getAllLookupContactLensModels(): Promise<LookupContactLensModel[]> {
  return getLookupItems<LookupContactLensModel>('contact-lens-models');
}

export async function createLookupContactLensModel(data: Omit<LookupContactLensModel, 'id'>): Promise<LookupContactLensModel | null> {
  return createLookupItem<LookupContactLensModel>('contact-lens-models', data);
}

export async function updateLookupContactLensModel(data: LookupContactLensModel): Promise<LookupContactLensModel | null> {
  return updateLookupItem<LookupContactLensModel>('contact-lens-models', data);
}

export async function deleteLookupContactLensModel(id: number): Promise<boolean> {
  return deleteLookupItem('contact-lens-models', id);
}

// Cleaning Solution functions
export async function getAllLookupCleaningSolutions(): Promise<LookupCleaningSolution[]> {
  return getLookupItems<LookupCleaningSolution>('cleaning-solutions');
}

export async function createLookupCleaningSolution(data: Omit<LookupCleaningSolution, 'id'>): Promise<LookupCleaningSolution | null> {
  return createLookupItem<LookupCleaningSolution>('cleaning-solutions', data);
}

export async function updateLookupCleaningSolution(data: LookupCleaningSolution): Promise<LookupCleaningSolution | null> {
  return updateLookupItem<LookupCleaningSolution>('cleaning-solutions', data);
}

export async function deleteLookupCleaningSolution(id: number): Promise<boolean> {
  return deleteLookupItem('cleaning-solutions', id);
}

// Disinfection Solution functions
export async function getAllLookupDisinfectionSolutions(): Promise<LookupDisinfectionSolution[]> {
  return getLookupItems<LookupDisinfectionSolution>('disinfection-solutions');
}

export async function createLookupDisinfectionSolution(data: Omit<LookupDisinfectionSolution, 'id'>): Promise<LookupDisinfectionSolution | null> {
  return createLookupItem<LookupDisinfectionSolution>('disinfection-solutions', data);
}

export async function updateLookupDisinfectionSolution(data: LookupDisinfectionSolution): Promise<LookupDisinfectionSolution | null> {
  return updateLookupItem<LookupDisinfectionSolution>('disinfection-solutions', data);
}

export async function deleteLookupDisinfectionSolution(id: number): Promise<boolean> {
  return deleteLookupItem('disinfection-solutions', id);
}

// Rinsing Solution functions
export async function getAllLookupRinsingSolutions(): Promise<LookupRinsingSolution[]> {
  return getLookupItems<LookupRinsingSolution>('rinsing-solutions');
}

export async function createLookupRinsingSolution(data: Omit<LookupRinsingSolution, 'id'>): Promise<LookupRinsingSolution | null> {
  return createLookupItem<LookupRinsingSolution>('rinsing-solutions', data);
}

export async function updateLookupRinsingSolution(data: LookupRinsingSolution): Promise<LookupRinsingSolution | null> {
  return updateLookupItem<LookupRinsingSolution>('rinsing-solutions', data);
}

export async function deleteLookupRinsingSolution(id: number): Promise<boolean> {
  return deleteLookupItem('rinsing-solutions', id);
}

// Manufacturing Lab functions
export async function getAllLookupManufacturingLabs(): Promise<LookupManufacturingLab[]> {
  return getLookupItems<LookupManufacturingLab>('manufacturing-labs');
}

export async function createLookupManufacturingLab(data: Omit<LookupManufacturingLab, 'id'>): Promise<LookupManufacturingLab | null> {
  return createLookupItem<LookupManufacturingLab>('manufacturing-labs', data);
}

export async function updateLookupManufacturingLab(data: LookupManufacturingLab): Promise<LookupManufacturingLab | null> {
  return updateLookupItem<LookupManufacturingLab>('manufacturing-labs', data);
}

export async function deleteLookupManufacturingLab(id: number): Promise<boolean> {
  return deleteLookupItem('manufacturing-labs', id);
}

// Advisor functions
export async function getAllLookupAdvisors(): Promise<LookupAdvisor[]> {
  return getLookupItems<LookupAdvisor>('advisors');
}

export async function createLookupAdvisor(data: Omit<LookupAdvisor, 'id'>): Promise<LookupAdvisor | null> {
  return createLookupItem<LookupAdvisor>('advisors', data);
}

export async function updateLookupAdvisor(data: LookupAdvisor): Promise<LookupAdvisor | null> {
  return updateLookupItem<LookupAdvisor>('advisors', data);
}

export async function deleteLookupAdvisor(id: number): Promise<boolean> {
  return deleteLookupItem('advisors', id);
}

// VA Meter functions
export async function getAllLookupVAMeters(): Promise<LookupVAMeter[]> {
  return getLookupItems<LookupVAMeter>('va-meter');
}

export async function createLookupVAMeter(data: Omit<LookupVAMeter, 'id'>): Promise<LookupVAMeter | null> {
  return createLookupItem<LookupVAMeter>('va-meter', data);
}

export async function updateLookupVAMeter(data: LookupVAMeter): Promise<LookupVAMeter | null> {
  return updateLookupItem<LookupVAMeter>('va-meter', data);
}

export async function deleteLookupVAMeter(id: number): Promise<boolean> {
  return deleteLookupItem('va-meter', id);
}

// VA Decimal functions
export async function getAllLookupVADecimals(): Promise<LookupVADecimal[]> {
  return getLookupItems<LookupVADecimal>('va-decimal');
}

export async function createLookupVADecimal(data: Omit<LookupVADecimal, 'id'>): Promise<LookupVADecimal | null> {
  return createLookupItem<LookupVADecimal>('va-decimal', data);
}

export async function updateLookupVADecimal(data: LookupVADecimal): Promise<LookupVADecimal | null> {
  return updateLookupItem<LookupVADecimal>('va-decimal', data);
}

export async function deleteLookupVADecimal(id: number): Promise<boolean> {
  return deleteLookupItem('va-decimal', id);
}

function makeLookupTable<T>(tableName: string, displayName: string) {
  return {
    getAll: (clinicId?: number) => getLookupItems<T>(tableName, clinicId),
    create: (data: any) => createLookupItem<T>(tableName, data),
    update: (data: any) => updateLookupItem<T>(tableName, data),
    delete: (id: number, clinicId?: number) => deleteLookupItem(tableName, id, clinicId),
    displayName,
  }
}

export const lookupTables = {
  supplier: {
    ...makeLookupTable<LookupSupplier>('suppliers', 'ספקים'),
    displayName: 'ספקים'
  },
  clinic: {
    ...makeLookupTable<LookupClinic>('clinics', 'מרפאות/סניפים'),
    displayName: 'מרפאות/סניפים'
  },
  orderType: {
    ...makeLookupTable<LookupOrderType>('order-types', 'סוגי הזמנות'),
    displayName: 'סוגי הזמנות'
  },
  referralType: {
    ...makeLookupTable<LookupReferralType>('referral-types', 'סוגי הפניות'),
    displayName: 'סוגי הפניות'
  },
  lensModel: {
    ...makeLookupTable<LookupLensModel>('lens-models', 'דגמי עדשות'),
    displayName: 'דגמי עדשות'
  },
  color: {
    ...makeLookupTable<LookupColor>('colors', 'צבעים'),
    displayName: 'צבעים'
  },
  material: {
    ...makeLookupTable<LookupMaterial>('materials', 'חומרים'),
    displayName: 'חומרים'
  },
  coating: {
    ...makeLookupTable<LookupCoating>('coatings', 'ציפויים'),
    displayName: 'ציפויים'
  },
  manufacturer: {
    ...makeLookupTable<LookupManufacturer>('manufacturers', 'יצרנים'),
    displayName: 'יצרנים'
  },
  frameModel: {
    ...makeLookupTable<LookupFrameModel>('frame-models', 'דגמי מסגרות'),
    displayName: 'דגמי מסגרות'
  },
  contactLensType: {
    ...makeLookupTable<LookupContactLensType>('contact-lens-types', 'סוגי עדשות מגע'),
    displayName: 'סוגי עדשות מגע'
  },
  contactEyeLensType: {
    ...makeLookupTable<LookupContactEyeLensType>('contact-eye-lens-types', 'סוגי עדשות מגע לעין'),
    displayName: 'סוגי עדשות מגע לעין'
  },
  contactEyeMaterial: {
    ...makeLookupTable<LookupContactEyeMaterial>('contact-eye-materials', 'חומרי עדשות מגע'),
    displayName: 'חומרי עדשות מגע'
  },
  contactLensModel: {
    ...makeLookupTable<LookupContactLensModel>('contact-lens-models', 'דגמי עדשות מגע'),
    displayName: 'דגמי עדשות מגע'
  },
  cleaningSolution: {
    ...makeLookupTable<LookupCleaningSolution>('cleaning-solutions', 'תמיסות ניקוי'),
    displayName: 'תמיסות ניקוי'
  },
  disinfectionSolution: {
    ...makeLookupTable<LookupDisinfectionSolution>('disinfection-solutions', 'תמיסות חיטוי'),
    displayName: 'תמיסות חיטוי'
  },
  rinsingSolution: {
    ...makeLookupTable<LookupRinsingSolution>('rinsing-solutions', 'תמיסות שטיפה'),
    displayName: 'תמיסות שטיפה'
  },
  manufacturingLab: {
    ...makeLookupTable<LookupManufacturingLab>('manufacturing-labs', 'מעבדות ייצור'),
    displayName: 'מעבדות ייצור'
  },
  advisor: {
    ...makeLookupTable<LookupAdvisor>('advisors', 'יועצים'),
    displayName: 'יועצים'
  },
  vaMeter: {
    ...makeLookupTable<LookupVAMeter>('va-meter', 'חדות ראייה - מטר'),
    displayName: 'חדות ראייה - מטר'
  },
  vaDecimal: {
    ...makeLookupTable<LookupVADecimal>('va-decimal', 'חדות ראייה - דצימלי'),
    displayName: 'חדות ראייה - דצימלי'
  }
}
