import { connectionManager } from './connection-manager';
import { NotesExam } from './schema-interface';

export function createNotesExam(data: Omit<NotesExam, 'id'>): NotesExam | null {
  return connectionManager.createNotesExam(data);
}

export function updateNotesExam(data: NotesExam): NotesExam | null {
  return connectionManager.updateNotesExam(data);
}

export function getAllNotesExamsByLayoutInstanceId(layoutInstanceId: number): NotesExam[] {
  return connectionManager.getAllNotesExamsByLayoutInstanceId(layoutInstanceId);
}

export function getNotesExamById(id: number): NotesExam | null {
  return connectionManager.getNotesExamById(id);
}

export function getNotesExamByLayoutInstanceId(layout_instance_id: number): NotesExam | null {
  return connectionManager.getNotesExamByLayoutInstanceId(layout_instance_id);
}

export function deleteNotesExam(id: number): boolean {
  return connectionManager.deleteNotesExam(id);
} 