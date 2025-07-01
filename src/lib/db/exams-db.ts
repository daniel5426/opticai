/// <reference path="../../types/electron.d.ts" />
import { OpticalExam, OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam } from "./schema";

// Optical Exam functions
export async function getExamsByClientId(clientId: number): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.getExamsByClient(clientId);
  } catch (error) {
    console.error('Error getting exams by client:', error);
    return [];
  }
}

export async function getAllExams(): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.getAllExams();
  } catch (error) {
    console.error('Error getting all exams:', error);
    return [];
  }
}

export async function getExamById(examId: number): Promise<OpticalExam | undefined> {
  try {
    return await window.electronAPI.getExam(examId);
  } catch (error) {
    console.error('Error getting exam:', error);
    return undefined;
  }
}

export async function createExam(exam: Omit<OpticalExam, 'id'>): Promise<OpticalExam | null> {
  try {
    return await window.electronAPI.createExam(exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    return null;
  }
}

export async function updateExam(exam: OpticalExam): Promise<OpticalExam | undefined> {
  try {
    return await window.electronAPI.updateExam(exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    return undefined;
  }
}

export async function deleteExam(examId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteExam(examId);
  } catch (error) {
    console.error('Error deleting exam:', error);
    return false;
  }
}

// Old Refraction Exam functions
export async function getOldRefractionExamByLayoutInstanceId(layoutInstanceId: number): Promise<OldRefractionExam | null> {
  try {
    return await window.electronAPI.getOldRefractionExamByLayoutInstance(layoutInstanceId);
  } catch (error) {
    console.error('Error getting old refraction exam:', error);
    return null;
  }
}

export async function getOldRefractionExamByExamId(examId: number): Promise<OldRefractionExam | null> {
  try {
    // This is maintained for backward compatibility
    // It looks up the active layout for the exam and gets its components
    return await window.electronAPI.getOldRefractionExam(examId);
  } catch (error) {
    console.error('Error getting old refraction exam:', error);
    return null;
  }
}

export async function createOldRefractionExam(exam: Omit<OldRefractionExam, 'id'>): Promise<OldRefractionExam | null> {
  try {
    return await window.electronAPI.createOldRefractionExam(exam);
  } catch (error) {
    console.error('Error creating old refraction exam:', error);
    return null;
  }
}

export async function updateOldRefractionExam(exam: OldRefractionExam): Promise<OldRefractionExam | null> {
  try {
    return await window.electronAPI.updateOldRefractionExam(exam);
  } catch (error) {
    console.error('Error updating old refraction exam:', error);
    return null;
  }
}

// Objective Exam functions
export async function getObjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<ObjectiveExam | null> {
  try {
    return await window.electronAPI.getObjectiveExamByLayoutInstance(layoutInstanceId);
  } catch (error) {
    console.error('Error getting objective exam:', error);
    return null;
  }
}

export async function getObjectiveExamByExamId(examId: number): Promise<ObjectiveExam | null> {
  try {
    // This is maintained for backward compatibility
    // It looks up the active layout for the exam and gets its components
    return await window.electronAPI.getObjectiveExam(examId);
  } catch (error) {
    console.error('Error getting objective exam:', error);
    return null;
  }
}

export async function createObjectiveExam(exam: Omit<ObjectiveExam, 'id'>): Promise<ObjectiveExam | null> {
  try {
    return await window.electronAPI.createObjectiveExam(exam);
  } catch (error) {
    console.error('Error creating objective exam:', error);
    return null;
  }
}

export async function updateObjectiveExam(exam: ObjectiveExam): Promise<ObjectiveExam | null> {
  try {
    return await window.electronAPI.updateObjectiveExam(exam);
  } catch (error) {
    console.error('Error updating objective exam:', error);
    return null;
  }
}

// Subjective Exam functions
export async function getSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<SubjectiveExam | null> {
  try {
    return await window.electronAPI.getSubjectiveExamByLayoutInstance(layoutInstanceId);
  } catch (error) {
    console.error('Error getting subjective exam:', error);
    return null;
  }
}

export async function getSubjectiveExamByExamId(examId: number): Promise<SubjectiveExam | null> {
  try {
    // This is maintained for backward compatibility
    // It looks up the active layout for the exam and gets its components
    return await window.electronAPI.getSubjectiveExam(examId);
  } catch (error) {
    console.error('Error getting subjective exam:', error);
    return null;
  }
}

export async function createSubjectiveExam(exam: Omit<SubjectiveExam, 'id'>): Promise<SubjectiveExam | null> {
  try {
    return await window.electronAPI.createSubjectiveExam(exam);
  } catch (error) {
    console.error('Error creating subjective exam:', error);
    return null;
  }
}

export async function updateSubjectiveExam(exam: SubjectiveExam): Promise<SubjectiveExam | null> {
  try {
    return await window.electronAPI.updateSubjectiveExam(exam);
  } catch (error) {
    console.error('Error updating subjective exam:', error);
    return null;
  }
}

// Addition Exam functions
export async function getAdditionExamByLayoutInstanceId(layoutInstanceId: number): Promise<AdditionExam | null> {
  try {
    return await window.electronAPI.getAdditionExamByLayoutInstance(layoutInstanceId);
  } catch (error) {
    console.error('Error getting addition exam:', error);
    return null;
  }
}

export async function getAdditionExamByExamId(examId: number): Promise<AdditionExam | null> {
  try {
    // This is maintained for backward compatibility
    // It looks up the active layout for the exam and gets its components
    return await window.electronAPI.getAdditionExam(examId);
  } catch (error) {
    console.error('Error getting addition exam:', error);
    return null;
  }
}

export async function createAdditionExam(exam: Omit<AdditionExam, 'id'>): Promise<AdditionExam | null> {
  try {
    return await window.electronAPI.createAdditionExam(exam);
  } catch (error) {
    console.error('Error creating addition exam:', error);
    return null;
  }
}

export async function updateAdditionExam(exam: AdditionExam): Promise<AdditionExam | null> {
  try {
    return await window.electronAPI.updateAdditionExam(exam);
  } catch (error) {
    console.error('Error updating addition exam:', error);
    return null;
  }
}

// Final Subjective Exam functions
export async function getFinalSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.getFinalSubjectiveExamByLayoutInstance(layoutInstanceId);
  } catch (error) {
    console.error('Error getting final subjective exam:', error);
    return null;
  }
}

export async function getFinalSubjectiveExamByExamId(examId: number): Promise<FinalSubjectiveExam | null> {
  try {
    // This is maintained for backward compatibility
    // It looks up the active layout for the exam and gets its components
    return await window.electronAPI.getFinalSubjectiveExam(examId);
  } catch (error) {
    console.error('Error getting final subjective exam:', error);
    return null;
  }
}

export async function createFinalSubjectiveExam(exam: Omit<FinalSubjectiveExam, 'id'>): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.createFinalSubjectiveExam(exam);
  } catch (error) {
    console.error('Error creating final subjective exam:', error);
    return null;
  }
}

export async function updateFinalSubjectiveExam(exam: FinalSubjectiveExam): Promise<FinalSubjectiveExam | null> {
  try {
    return await window.electronAPI.updateFinalSubjectiveExam(exam);
  } catch (error) {
    console.error('Error updating final subjective exam:', error);
    return null;
  }
} 