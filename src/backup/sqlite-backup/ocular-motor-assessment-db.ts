import { connectionManager } from './connection-manager';
import { OcularMotorAssessmentExam } from './schema-interface';

export function createOcularMotorAssessmentExam(data: Omit<OcularMotorAssessmentExam, 'id'>) {
  return connectionManager.createOcularMotorAssessmentExam(data);
}

export function getOcularMotorAssessmentExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getOcularMotorAssessmentExamByLayoutInstanceId(layoutInstanceId);
}

export function updateOcularMotorAssessmentExam(data: OcularMotorAssessmentExam) {
  return connectionManager.updateOcularMotorAssessmentExam(data);
} 