import { FinalSubjectiveExam } from './schema'

export async function getFinalSubjectiveExamByExamId(examId: number): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.getFinalSubjectiveExam(examId)
  } catch (error) {
    console.error('Error getting final subjective exam:', error)
    return null
  }
}

export async function createFinalSubjectiveExam(data: Omit<FinalSubjectiveExam, 'id'>): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.createFinalSubjectiveExam(data)
  } catch (error) {
    console.error('Error creating final subjective exam:', error)
    return null
  }
}

export async function updateFinalSubjectiveExam(data: FinalSubjectiveExam): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.updateFinalSubjectiveExam(data)
  } catch (error) {
    console.error('Error updating final subjective exam:', error)
    return null
  }
} 