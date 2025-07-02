/// <reference path="../../types/electron.d.ts" />
import { OpticalExam } from "./schema";

// Optical Exam functions
export async function getExamsByClientId(clientId: number): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.db('getExamsByClientId', clientId);
  } catch (error) {
    console.error('Error getting exams by client:', error);
    return [];
  }
}

export async function getAllExams(): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.db('getAllExams');
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
    return await window.electronAPI.db('createExam', exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    return null;
  }
}

export async function updateExam(exam: OpticalExam): Promise<OpticalExam | undefined> {
  try {
    return await window.electronAPI.db('updateExam', exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    return undefined;
  }
}

export async function deleteExam(examId: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteExam', examId);
  } catch (error) {
    console.error('Error deleting exam:', error);
    return false;
  }
} 