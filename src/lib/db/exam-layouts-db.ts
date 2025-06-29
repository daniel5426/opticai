import { ExamLayout } from './schema'

export async function getAllExamLayouts(): Promise<ExamLayout[]> {
  try {
    return await window.electronAPI.getAllExamLayouts()
  } catch (error) {
    console.error('Error getting exam layouts:', error)
    return []
  }
}

export async function getExamLayoutById(id: number): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.getExamLayoutById(id)
  } catch (error) {
    console.error('Error getting exam layout by id:', error)
    return null
  }
}

export async function createExamLayout(layout: Omit<ExamLayout, 'id'>): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.createExamLayout(layout)
  } catch (error) {
    console.error('Error creating exam layout:', error)
    return null
  }
}

export async function updateExamLayout(layout: ExamLayout): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.updateExamLayout(layout)
  } catch (error) {
    console.error('Error updating exam layout:', error)
    return null
  }
}

export async function deleteExamLayout(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteExamLayout(id)
  } catch (error) {
    console.error('Error deleting exam layout:', error)
    return false
  }
}

export async function getDefaultExamLayout(): Promise<ExamLayout | null> {
  try {
    return await window.electronAPI.getDefaultExamLayout()
  } catch (error) {
    console.error('Error getting default exam layout:', error)
    return null
  }
} 