import { OpticalExam, OpticalEyeExam } from "./schema";

// Mock data for optical exams
const mockOpticalExams: OpticalExam[] = [
  {
    id: 1,
    client_id: 1,
    clinic: "מרפאת עיניים ראשית",
    examiner_name: "ד״ר אביב כהן",
    exam_date: "2023-05-15",
    test_name: "בדיקת ראייה מקיפה",
    dominant_eye: "R",
    notes: "הלקוח מתלונן על כאבי ראש בעת קריאה ממושכת.",
    comb_subj_va: 1.0,
    comb_old_va: 0.8,
    comb_fa: 6,
    comb_fa_tuning: 0,
    comb_pd_close: 62,
    comb_pd_far: 64
  },
  {
    id: 2,
    client_id: 1,
    clinic: "מרפאת עיניים צפון",
    examiner_name: "ד״ר גל לוי",
    exam_date: "2023-08-22",
    test_name: "בדיקת לחץ תוך עיני",
    dominant_eye: "R",
    notes: "לחץ תקין בשתי העיניים.",
    comb_subj_va: 1.0,
    comb_old_va: 1.0,
    comb_fa: 6,
    comb_fa_tuning: 0,
    comb_pd_close: 62,
    comb_pd_far: 64
  },
  {
    id: 3,
    client_id: 1,
    clinic: "מרפאת עיניים ראשית",
    examiner_name: "ד״ר אביב כהן",
    exam_date: "2024-01-10",
    test_name: "בדיקת ראייה מקיפה",
    dominant_eye: "R",
    notes: "שינוי קל במרשם משקפיים.",
    comb_subj_va: 1.0,
    comb_old_va: 1.0,
    comb_fa: 6,
    comb_fa_tuning: 0,
    comb_pd_close: 62,
    comb_pd_far: 64
  }
];

// Mock data for optical eye exams
const mockOpticalEyeExams: OpticalEyeExam[] = [
  // Exam 1 - Right Eye
  {
    id: 1,
    exam_id: 1,
    eye: "R",
    old_sph: -1.25,
    old_cyl: -0.5,
    old_ax: 180,
    old_pris: 0,
    old_base: 0,
    old_va: 0.6,
    old_ad: 0,
    obj_sph: -1.5,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -1.875,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.5,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 32,
    subj_pd_far: 33,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.00,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 14
  },
  // Exam 1 - Left Eye
  {
    id: 2,
    exam_id: 1,
    eye: "L",
    old_sph: -1.00,
    old_cyl: -0.25,
    old_ax: 90,
    old_pris: 0,
    old_base: 0,
    old_va: 0.6,
    old_ad: 0,
    obj_sph: -1.25,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.5,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.25,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 31,
    subj_pd_far: 32,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.00,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 15
  },
  // Exam 2 - Right Eye
  {
    id: 3,
    exam_id: 2,
    eye: "R",
    old_sph: -1.5,
    old_cyl: -0.75,
    old_ax: 175,
    old_pris: 0,
    old_base: 0,
    old_va: 1.0,
    old_ad: 0,
    obj_sph: -1.5,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -1.875,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.5,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 32,
    subj_pd_far: 33,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.00,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 14
  },
  // Exam 2 - Left Eye
  {
    id: 4,
    exam_id: 2,
    eye: "L",
    old_sph: -1.25,
    old_cyl: -0.50,
    old_ax: 85,
    old_pris: 0,
    old_base: 0,
    old_va: 1.0,
    old_ad: 0,
    obj_sph: -1.25,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.5,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.25,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 31,
    subj_pd_far: 32,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.00,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 15
  },
  // Exam 3 - Right Eye
  {
    id: 5,
    exam_id: 3,
    eye: "R",
    old_sph: -1.5,
    old_cyl: -0.75,
    old_ax: 175,
    old_pris: 0,
    old_base: 0,
    old_va: 1.0,
    old_ad: 0,
    obj_sph: -1.75,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -2.125,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.75,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 32,
    subj_pd_far: 33,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.25,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 13
  },
  // Exam 3 - Left Eye
  {
    id: 6,
    exam_id: 3,
    eye: "L",
    old_sph: -1.25,
    old_cyl: -0.50,
    old_ax: 85,
    old_pris: 0,
    old_base: 0,
    old_va: 1.0,
    old_ad: 0,
    obj_sph: -1.50,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.75,
    subj_fa: 6,
    subj_fa_tuning: 0,
    subj_sph: -1.50,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: 0,
    subj_va: 1.0,
    subj_pd_close: 31,
    subj_pd_far: 32,
    subj_ph: 1.0,
    ad_fcc: 0,
    ad_read: 2.25,
    ad_int: 0,
    ad_bif: 0,
    ad_mul: 0,
    ad_j: 0,
    iop: 14
  }
];

// Get all exams for a specific client
export function getExamsByClientId(clientId: number): OpticalExam[] {
  const exams = JSON.parse(localStorage.getItem('exams') || JSON.stringify(mockOpticalExams));
  return exams.filter((exam: OpticalExam) => exam.client_id === clientId);
}

// Get a specific exam by ID
export function getExamById(examId: number): OpticalExam | undefined {
  const exams = JSON.parse(localStorage.getItem('exams') || JSON.stringify(mockOpticalExams));
  return exams.find((exam: OpticalExam) => exam.id === examId);
}

// Get eye exams for a specific exam ID
export function getEyeExamsByExamId(examId: number): OpticalEyeExam[] {
  const eyeExams = JSON.parse(localStorage.getItem('eyeExams') || JSON.stringify(mockOpticalEyeExams));
  return eyeExams.filter((eyeExam: OpticalEyeExam) => eyeExam.exam_id === examId);
}

// Create a new exam
export function createExam(exam: Partial<OpticalExam>): OpticalExam {
  const exams = JSON.parse(localStorage.getItem('exams') || JSON.stringify(mockOpticalExams));
  const maxId = exams.length > 0 ? Math.max(...exams.map((e: OpticalExam) => e.id || 0)) : 0;
  const newExam: OpticalExam = {
    id: maxId + 1,
    client_id: exam.client_id || 0,
    clinic: exam.clinic || '',
    examiner_name: exam.examiner_name || '',
    exam_date: exam.exam_date || new Date().toISOString().split('T')[0],
    test_name: exam.test_name || '',
    dominant_eye: exam.dominant_eye || '',
    notes: exam.notes || '',
    comb_subj_va: exam.comb_subj_va,
    comb_old_va: exam.comb_old_va,
    comb_fa: exam.comb_fa,
    comb_fa_tuning: exam.comb_fa_tuning,
    comb_pd_close: exam.comb_pd_close,
    comb_pd_far: exam.comb_pd_far
  };
  exams.push(newExam);
  localStorage.setItem('exams', JSON.stringify(exams));
  return newExam;
}

// Create a new eye exam
export function createEyeExam(eyeExam: Partial<OpticalEyeExam>): OpticalEyeExam {
  const eyeExams = JSON.parse(localStorage.getItem('eyeExams') || JSON.stringify(mockOpticalEyeExams));
  const maxId = eyeExams.length > 0 ? Math.max(...eyeExams.map((e: OpticalEyeExam) => e.id || 0)) : 0;
  const newEyeExam: OpticalEyeExam = {
    id: maxId + 1,
    exam_id: eyeExam.exam_id || 0,
    eye: eyeExam.eye || 'R',
    old_sph: eyeExam.old_sph,
    old_cyl: eyeExam.old_cyl,
    old_ax: eyeExam.old_ax,
    old_pris: eyeExam.old_pris,
    old_base: eyeExam.old_base,
    old_va: eyeExam.old_va,
    old_ad: eyeExam.old_ad,
    obj_sph: eyeExam.obj_sph,
    obj_cyl: eyeExam.obj_cyl,
    obj_ax: eyeExam.obj_ax,
    obj_se: eyeExam.obj_se,
    subj_fa: eyeExam.subj_fa,
    subj_fa_tuning: eyeExam.subj_fa_tuning,
    subj_sph: eyeExam.subj_sph,
    subj_cyl: eyeExam.subj_cyl,
    subj_ax: eyeExam.subj_ax,
    subj_pris: eyeExam.subj_pris,
    subj_base: eyeExam.subj_base,
    subj_va: eyeExam.subj_va,
    subj_pd_close: eyeExam.subj_pd_close,
    subj_pd_far: eyeExam.subj_pd_far,
    subj_ph: eyeExam.subj_ph,
    ad_fcc: eyeExam.ad_fcc,
    ad_read: eyeExam.ad_read,
    ad_int: eyeExam.ad_int,
    ad_bif: eyeExam.ad_bif,
    ad_mul: eyeExam.ad_mul,
    ad_j: eyeExam.ad_j,
    iop: eyeExam.iop
  };
  eyeExams.push(newEyeExam);
  localStorage.setItem('eyeExams', JSON.stringify(eyeExams));
  return newEyeExam;
}

// Update an exam
export function updateExam(exam: OpticalExam): OpticalExam | undefined {
  const exams = JSON.parse(localStorage.getItem('exams') || JSON.stringify(mockOpticalExams));
  const index = exams.findIndex((e: OpticalExam) => e.id === exam.id);
  if (index !== -1) {
    exams[index] = exam;
    localStorage.setItem('exams', JSON.stringify(exams));
    return exam;
  }
  return undefined;
}

// Update an eye exam
export function updateEyeExam(eyeExam: OpticalEyeExam): OpticalEyeExam | undefined {
  const eyeExams = JSON.parse(localStorage.getItem('eyeExams') || JSON.stringify(mockOpticalEyeExams));
  const index = eyeExams.findIndex((e: OpticalEyeExam) => e.id === eyeExam.id);
  if (index !== -1) {
    eyeExams[index] = eyeExam;
    localStorage.setItem('eyeExams', JSON.stringify(eyeExams));
    return eyeExam;
  }
  return undefined;
} 