import { ExamLayout, ExamLayoutInstance } from './schema-interface';
import { apiClient } from '../api-client';

export async function getAllExamLayouts(clinicId?: number): Promise<ExamLayout[]> {
  try {
    const response = await apiClient.getExamLayouts(clinicId);
    if (response.error) {
      console.error('Error getting exam layouts:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting exam layouts:', error);
    return [];
  }
}

export async function getExamLayoutsByClinicId(clinicId?: number): Promise<ExamLayout[]> {
  try {
    const response = await apiClient.getExamLayouts(clinicId);
    if (response.error) {
      console.error('Error getting exam layouts by clinic:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting exam layouts:', error);
    return [];
  }
}



export async function getExamLayoutById(id: number): Promise<ExamLayout | null> {
  try {
    const response = await apiClient.getExamLayout(id);
    if (response.error) {
      console.error('Error getting exam layout:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting exam layout:', error);
    return null;
  }
}

export async function createExamLayout(layout: Omit<ExamLayout, 'id'>): Promise<ExamLayout | null> {
  try {
    const response = await apiClient.createExamLayout(layout);
    if (response.error) {
      console.error('Error creating exam layout:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating exam layout:', error);
    return null;
  }
}

export async function updateExamLayout(layout: ExamLayout): Promise<ExamLayout | null> {
  try {
    if (!layout.id) {
      console.error('Error updating exam layout: No layout ID provided');
      return null;
    }
    const response = await apiClient.updateExamLayout(layout.id, layout);
    if (response.error) {
      console.error('Error updating exam layout:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating exam layout:', error);
    return null;
  }
}

export async function deleteExamLayout(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteExamLayout(id);
    if (response.error) {
      console.error('Error deleting exam layout:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting exam layout:', error);
    return false;
  }
}

export async function reorderExamLayouts(data: { clinic_id?: number; items: Array<{ id: number; sort_index: number; parent_layout_id?: number | null }> }): Promise<ExamLayout[]> {
  try {
    const response = await apiClient.reorderExamLayouts(data);
    if (response.error) {
      console.error('Error reordering exam layouts:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error reordering exam layouts:', error);
    return [];
  }
}

export async function createExamLayoutGroup(data: { clinic_id?: number; name: string; layout_ids: number[] }): Promise<ExamLayout | null> {
  try {
    const response = await apiClient.createExamLayoutGroup(data);
    if (response.error) {
      console.error('Error creating exam layout group:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating exam layout group:', error);
    return null;
  }
}

export async function bulkDeleteExamLayouts(data: { clinic_id?: number; layout_ids: number[] }): Promise<ExamLayout[]> {
  try {
    const response = await apiClient.bulkDeleteExamLayouts(data);
    if (response.error) {
      console.error('Error bulk deleting exam layouts:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error bulk deleting exam layouts:', error);
    return [];
  }
}

export async function getDefaultExamLayout(): Promise<ExamLayout | null> {
  try {
    const response = await apiClient.getExamLayouts();
    if (response.error) {
      console.error('Error getting default exam layout:', response.error);
      return null;
    }
    const defaultLayout = (response.data || []).find(layout => layout.is_default);
    return defaultLayout || null;
  } catch (error) {
    console.error('Error getting default exam layout:', error);
    return null;
  }
}

export async function getDefaultExamLayouts(): Promise<ExamLayout[]> {
  try {
    const response = await apiClient.getExamLayouts();
    if (response.error) {
      console.error('Error getting default exam layouts:', response.error);
      return [];
    }
    return (response.data || []).filter(layout => layout.is_default);
  } catch (error) {
    console.error('Error getting default exam layouts:', error);
    return [];
  }
}



export async function setDefaultExamLayout(layoutId: number): Promise<boolean> {
  try {
    const allDefaultLayouts = await apiClient.getExamLayouts();
    if (allDefaultLayouts.error) {
      console.error('Error getting exam layouts for setting default:', allDefaultLayouts.error);
      return false;
    }

    // This would need a specific endpoint in the API to handle setting defaults
    console.warn('setDefaultExamLayout: API endpoint not yet implemented');
    return false;
  } catch (error) {
    console.error('Error setting default exam layout:', error);
    return false;
  }
}

export async function getLayoutsByExamId(examId: number): Promise<ExamLayoutInstance[]> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getLayoutsByExamId: API endpoint not yet implemented');
    return [];
  } catch (error) {
    console.error('Error getting layouts by exam ID:', error);
    return [];
  }
}

export async function getExamLayoutInstanceById(id: number): Promise<ExamLayoutInstance | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getExamLayoutInstanceById: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error getting exam layout instance:', error);
    return null;
  }
}

export async function getExamLayoutInstancesByExamId(examId: number): Promise<ExamLayoutInstance[]> {
  try {
    const response = await apiClient.getExamLayoutInstances(examId);
    if (response.error) {
      console.error('Error getting exam layout instances by exam ID:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting exam layout instances by exam ID:', error);
    return [];
  }
}

export async function getActiveExamLayoutInstanceByExamId(examId: number): Promise<ExamLayoutInstance | null> {
  try {
    const response = await apiClient.getActiveExamLayoutInstance(examId);
    if (response.error) {
      console.error('Error getting active exam layout instance:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting active exam layout instance:', error);
    return null;
  }
}

export async function createExamLayoutInstance(instance: Omit<ExamLayoutInstance, 'id'>): Promise<ExamLayoutInstance | null> {
  try {
    const response = await apiClient.createExamLayoutInstance(instance);
    if (response.error) {
      console.error('Error creating exam layout instance:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating exam layout instance:', error);
    return null;
  }
}

export async function updateExamLayoutInstance(instance: ExamLayoutInstance): Promise<ExamLayoutInstance | null> {
  try {
    if (!instance.id) {
      console.error('Error updating exam layout instance: No instance ID provided');
      return null;
    }
    const response = await apiClient.updateExamLayoutInstance(instance.id, instance);
    if (response.error) {
      console.error('Error updating exam layout instance:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating exam layout instance:', error);
    return null;
  }
}

export async function deleteExamLayoutInstance(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteExamLayoutInstance(id);
    if (response.error) {
      console.error('Error deleting exam layout instance:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting exam layout instance:', error);
    return false;
  }
}

export async function setActiveExamLayoutInstance(examId: number, layoutInstanceId: number): Promise<boolean> {
  try {
    const response = await apiClient.setActiveExamLayoutInstance(examId, layoutInstanceId);
    if (response.error) {
      console.error('Error setting active exam layout instance:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error setting active exam layout instance:', error);
    return false;
  }
}

export async function ensureExamHasLayout(examId: number): Promise<boolean> {
  try {
    // Check if exam already has any layout instances
    const instances = await getExamLayoutInstancesByExamId(examId);
    if (instances.length > 0) {
      return true; // Exam already has layouts
    }
    
    // Get default layouts for exam type
    const defaultLayouts = await getDefaultExamLayouts();
    if (defaultLayouts.length === 0) {
      console.error('No default layouts found');
      return false;
    }
    
    // Add the first default layout to the exam
    const defaultLayout = defaultLayouts[0];
    if (!defaultLayout.id) {
      console.error('Default layout has no ID');
      return false;
    }
    const newInstance = await addLayoutToExam(examId, defaultLayout.id, true, 0);
    
    return newInstance !== null;
  } catch (error) {
    console.error('Error ensuring exam has layout:', error);
    return false;
  }
}

export async function addLayoutToExam(examId: number, layoutId: number, isActive: boolean = false, order: number = 0): Promise<ExamLayoutInstance | null> {
  try {
    const instanceData = {
      exam_id: examId,
      layout_id: layoutId,
      is_active: isActive,
      order: order
    };
    
    const response = await apiClient.createExamLayoutInstance(instanceData);
    if (response.error) {
      console.error('Error adding layout to exam:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error adding layout to exam:', error);
    return null;
  }
} 