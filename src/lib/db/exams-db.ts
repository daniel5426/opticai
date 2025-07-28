/// <reference path="../../types/electron.d.ts" />
import { OpticalExam } from "./schema";

// Optical Exam functions
export async function getExamsByClientId(clientId: number, type?: string): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.db('getExamsByClientId', clientId, type);
  } catch (error) {
    console.error('Error getting exams by client:', error);
    return [];
  }
}

export async function getAllExams(type?: string, clinicId?: number): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.db('getAllExams', type, clinicId);
  } catch (error) {
    console.error('Error getting all exams:', error);
    return [];
  }
}

export async function getExamById(examId: number): Promise<OpticalExam | undefined> {
  try {
    return await window.electronAPI.db('getExamById', examId);
  } catch (error) {
    console.error('Error getting exam:', error);
    return undefined;
  }
}

export async function createExam(exam: Omit<OpticalExam, 'id'>): Promise<OpticalExam | null> {
  try {
    const result = await window.electronAPI.db('createExam', exam);
    if (result && exam.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', exam.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error creating exam:', error);
    return null;
  }
}

export async function updateExam(exam: OpticalExam): Promise<OpticalExam | undefined> {
  try {
    const result = await window.electronAPI.db('updateExam', exam);
    if (result && exam.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', exam.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error updating exam:', error);
    return undefined;
  }
}

export async function deleteExam(examId: number): Promise<boolean> {
  try {
    const exam = await window.electronAPI.db('getExamById', examId);
    const result = await window.electronAPI.db('deleteExam', examId);
    if (result && exam?.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', exam.client_id);
      
    }
    return result;
  } catch (error) {
    console.error('Error deleting exam:', error);
    return false;
  }
} 