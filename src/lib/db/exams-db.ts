/// <reference path="../../types/electron.d.ts" />
import { OpticalExam, OpticalEyeExam } from "./schema";

export async function getExamsByClientId(clientId: number): Promise<OpticalExam[]> {
  try {
    return await window.electronAPI.getExamsByClient(clientId);
  } catch (error) {
    console.error('Error getting exams by client:', error);
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

export async function getEyeExamsByExamId(examId: number): Promise<OpticalEyeExam[]> {
  try {
    return await window.electronAPI.getEyeExamsByExam(examId);
  } catch (error) {
    console.error('Error getting eye exams:', error);
    return [];
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

export async function createEyeExam(eyeExam: Omit<OpticalEyeExam, 'id'>): Promise<OpticalEyeExam | null> {
  try {
    return await window.electronAPI.createEyeExam(eyeExam);
  } catch (error) {
    console.error('Error creating eye exam:', error);
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

export async function updateEyeExam(eyeExam: OpticalEyeExam): Promise<OpticalEyeExam | undefined> {
  try {
    return await window.electronAPI.updateEyeExam(eyeExam);
  } catch (error) {
    console.error('Error updating eye exam:', error);
    return undefined;
  }
} 