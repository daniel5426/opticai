import { ExamLayout, ExamLayoutInstance } from './schema'

export async function getAllExamLayouts(): Promise<ExamLayout[]> {
  try {
    return await window.electronAPI.db('getAllExamLayouts')
  } catch (error) {
    console.error('Error getting exam layouts:', error)
    return []
  }
}

export async function getExamLayoutsByType(type: 'opticlens' | 'exam'): Promise<ExamLayout[]> {
  try {
    return await window.electronAPI.db('getExamLayoutsByType', type)
  } catch (error) {
    console.error('Error getting exam layouts by type:', error)
    return []
  }
}

export async function getExamLayoutById(id: number): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.db('getExamLayoutById', id)
  } catch (error) {
    console.error('Error getting exam layout by id:', error)
    return null
  }
}

export async function createExamLayout(layout: Omit<ExamLayout, 'id'>): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.db('createExamLayout', layout)
  } catch (error) {
    console.error('Error creating exam layout:', error)
    return null
  }
}

export async function updateExamLayout(layout: ExamLayout): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.db('updateExamLayout', layout)
  } catch (error) {
    console.error('Error updating exam layout:', error)
    return null
  }
}

export async function deleteExamLayout(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteExamLayout', id)
  } catch (error) {
    console.error('Error deleting exam layout:', error)
    return false
  }
}

export async function getDefaultExamLayout(): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.db('getDefaultExamLayout')
  } catch (error) {
    console.error('Error getting default exam layout:', error)
    return null
  }
}

export async function getDefaultExamLayouts(): Promise<ExamLayout[]> {
  try {
    return await window.electronAPI.db('getDefaultExamLayouts')
  } catch (error) {
    console.error('Error getting default exam layouts:', error)
    return []
  }
}

export async function getDefaultExamLayoutsByType(type: 'opticlens' | 'exam'): Promise<ExamLayout[]> {
  try {
    const allDefaultLayouts = await window.electronAPI.db('getDefaultExamLayouts')
    return allDefaultLayouts.filter((layout: ExamLayout) => layout.type === type)
  } catch (error) {
    console.error('Error getting default exam layouts by type:', error)
    return []
  }
}

// Get layouts for a specific exam
export async function getLayoutsByExamId(examId: number): Promise<ExamLayout[]> {
  try {
    return await window.electronAPI.db('getLayoutsByExamId', examId)
  } catch (error) {
    console.error('Error getting layouts for exam:', error)
    return []
  }
}

// ExamLayoutInstance API
export async function getExamLayoutInstanceById(id: number): Promise<ExamLayoutInstance | null> {
  try {
    return await window.electronAPI.db('getExamLayoutInstanceById', id)
  } catch (error) {
    console.error('Error getting exam layout instance by id:', error)
    return null
  }
}

export async function getExamLayoutInstancesByExamId(examId: number): Promise<ExamLayoutInstance[]> {
  try {
    return await window.electronAPI.db('getExamLayoutInstancesByExamId', examId)
  } catch (error) {
    console.error('Error getting exam layout instances for exam:', error)
    return []
  }
}

export async function getActiveExamLayoutInstanceByExamId(examId: number): Promise<ExamLayoutInstance | null> {
  try {
    return await window.electronAPI.db('getActiveExamLayoutInstanceByExamId', examId)
  } catch (error) {
    console.error('Error getting active exam layout instance:', error)
    return null
  }
}

export async function createExamLayoutInstance(instance: Omit<ExamLayoutInstance, 'id'>): Promise<ExamLayoutInstance | null> {
  try {
    return await window.electronAPI.db('createExamLayoutInstance', instance)
  } catch (error) {
    console.error('Error creating exam layout instance:', error)
    return null
  }
}

export async function updateExamLayoutInstance(instance: ExamLayoutInstance): Promise<ExamLayoutInstance | null> {
  try {
    return await window.electronAPI.db('updateExamLayoutInstance', instance)
  } catch (error) {
    console.error('Error updating exam layout instance:', error)
    return null
  }
}

export async function deleteExamLayoutInstance(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteExamLayoutInstance', id)
  } catch (error) {
    console.error('Error deleting exam layout instance:', error)
    return false
  }
}

export async function setActiveExamLayoutInstance(examId: number, layoutInstanceId: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('setActiveExamLayoutInstance', examId, layoutInstanceId)
  } catch (error) {
    console.error('Error setting active exam layout instance:', error)
    return false
  }
}

// Ensure an exam has at least one layout instance
export async function ensureExamHasLayout(examId: number): Promise<ExamLayoutInstance | null> {
  try {
    return await window.electronAPI.db('ensureExamHasLayout', examId)
  } catch (error) {
    console.error('Error ensuring exam has layout instance:', error)
    return null
  }
}

// Add a layout to an exam
export async function addLayoutToExam(examId: number, layoutId: number, isActive: boolean = false, order: number = 0): Promise<ExamLayoutInstance | null> {
  try {
    const instance: Omit<ExamLayoutInstance, 'id'> = {
      exam_id: examId,
      layout_id: layoutId,
      is_active: isActive,
      order: order
    };
    
    return await createExamLayoutInstance(instance)
  } catch (error) {
    console.error('Error adding layout to exam:', error)
    return null
  }
} 