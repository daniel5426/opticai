/// <reference path="../../types/electron.d.ts" />
import { OpticalExam } from "./schema-interface";
import { apiClient } from '../api-client';

// Optical Exam functions
export async function getExamsByClientId(clientId: number, type?: string): Promise<OpticalExam[]> {
  try {
    const response = await apiClient.getExamsByClient(clientId);
    if (response.error) {
      console.error('Error getting exams by client:', response.error);
      return [];
    }
    // Filter by type if specified
    if (type && response.data) {
      return response.data.filter(exam => exam.type === type);
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting exams by client:', error);
    return [];
  }
}

export async function getAllExams(type?: string, clinicId?: number): Promise<OpticalExam[]> {
  try {
    const response = await apiClient.getExams(type, clinicId);
    if (response.error) {
      console.error('Error getting all exams:', response.error);
      return [];
    }
    let exams = response.data || [];
    
    // Filter by type if specified
    if (type) {
      exams = exams.filter(exam => exam.type === type);
    }
    
    // Filter by clinic if specified (API should handle this automatically)
    if (clinicId) {
      exams = exams.filter(exam => exam.clinic_id === clinicId);
    }
    
    return exams;
  } catch (error) {
    console.error('Error getting all exams:', error);
    return [];
  }
}

export async function getAllEnrichedExams(type?: string, clinicId?: number, options?: { limit?: number; offset?: number; order?: 'exam_date_desc' | 'exam_date_asc' }): Promise<any[]> {
  try {
    const effectiveOptions = options ?? { limit: 100, offset: 0, order: 'exam_date_desc' as const };
    const response = await apiClient.getEnrichedExams(type, clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting enriched exams:', response.error);
      return [];
    }
    const payload = response.data as { items: any[]; total: number } | undefined;
    return payload?.items || [];
  } catch (error) {
    console.error('Error getting enriched exams:', error);
    return [];
  }
}

export async function getPaginatedEnrichedExams(
  type?: string,
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: 'exam_date_desc' | 'exam_date_asc'; search?: string }
): Promise<{ items: any[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'exam_date_desc' as const };
    const response = await apiClient.getEnrichedExams(type, clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting enriched exams (paginated):', response.error);
      return { items: [], total: 0 };
    }
    const payload = response.data as { items: any[]; total: number } | undefined;
    return { items: payload?.items || [], total: payload?.total || 0 };
  } catch (error) {
    console.error('Error getting enriched exams (paginated):', error);
    return { items: [], total: 0 };
  }
}

export async function getExamById(examId: number): Promise<OpticalExam | undefined> {
  try {
    const response = await apiClient.getExam(examId);
    if (response.error) {
      console.error('Error getting exam:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error getting exam:', error);
    return undefined;
  }
}

export async function getExamWithLayouts(examId: number): Promise<any> {
  try {
    const response = await apiClient.getExamWithLayouts(examId);
    if (response.error) {
      console.error('Error getting exam with layouts:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error getting exam with layouts:', error);
    return undefined;
  }
}

export async function getExamPageData(examId: number): Promise<any> {
  try {
    const response = await apiClient.getExamPageData(examId);
    if (response.error) {
      console.error('Error getting exam page data:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error getting exam page data:', error);
    return undefined;
  }
}

export async function createExam(exam: Omit<OpticalExam, 'id'>): Promise<OpticalExam | null> {
  try {
    const response = await apiClient.createExam(exam);
    if (response.error) {
      console.error('Error creating exam:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating exam:', error);
    return null;
  }
}

export async function updateExam(exam: OpticalExam): Promise<OpticalExam | undefined> {
  try {
    if (!exam.id) {
      console.error('Error updating exam: No exam ID provided');
      return undefined;
    }
    const response = await apiClient.updateExam(exam.id, exam);
    if (response.error) {
      console.error('Error updating exam:', response.error);
      return undefined;
    }
    return response.data || undefined;
  } catch (error) {
    console.error('Error updating exam:', error);
    return undefined;
  }
}

export async function deleteExam(examId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteExam(examId);
    if (response.error) {
      console.error('Error deleting exam:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting exam:', error);
    return false;
  }
} 