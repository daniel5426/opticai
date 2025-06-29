/// <reference path="../../types/electron.d.ts" />
import { OpticalExam, OldRefractionExam, ObjectiveExam, SubjectiveExam, AdditionExam } from "./schema";

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

// Old Refraction Exam functions
export async function getOldRefractionExamByExamId(examId: number): Promise<OldRefractionExam | undefined> {
  try {
    return await window.electronAPI.getOldRefractionExam(examId);
  } catch (error) {
    console.error('Error getting old refraction exam:', error);
    return undefined;
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

export async function updateOldRefractionExam(exam: OldRefractionExam): Promise<OldRefractionExam | undefined> {
  try {
    return await window.electronAPI.updateOldRefractionExam(exam);
  } catch (error) {
    console.error('Error updating old refraction exam:', error);
    return undefined;
  }
}

// Objective Exam functions
export async function getObjectiveExamByExamId(examId: number): Promise<ObjectiveExam | undefined> {
  try {
    return await window.electronAPI.getObjectiveExam(examId);
  } catch (error) {
    console.error('Error getting objective exam:', error);
    return undefined;
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

export async function updateObjectiveExam(exam: ObjectiveExam): Promise<ObjectiveExam | undefined> {
  try {
    return await window.electronAPI.updateObjectiveExam(exam);
  } catch (error) {
    console.error('Error updating objective exam:', error);
    return undefined;
  }
}

// Subjective Exam functions
export async function getSubjectiveExamByExamId(examId: number): Promise<SubjectiveExam | undefined> {
  try {
    return await window.electronAPI.getSubjectiveExam(examId);
  } catch (error) {
    console.error('Error getting subjective exam:', error);
    return undefined;
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

export async function updateSubjectiveExam(exam: SubjectiveExam): Promise<SubjectiveExam | undefined> {
  try {
    return await window.electronAPI.updateSubjectiveExam(exam);
  } catch (error) {
    console.error('Error updating subjective exam:', error);
    return undefined;
  }
}

// Addition Exam functions
export async function getAdditionExamByExamId(examId: number): Promise<AdditionExam | undefined> {
  try {
    return await window.electronAPI.getAdditionExam(examId);
  } catch (error) {
    console.error('Error getting addition exam:', error);
    return undefined;
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

export async function updateAdditionExam(exam: AdditionExam): Promise<AdditionExam | undefined> {
  try {
    return await window.electronAPI.updateAdditionExam(exam);
  } catch (error) {
    console.error('Error updating addition exam:', error);
    return undefined;
  }
} 