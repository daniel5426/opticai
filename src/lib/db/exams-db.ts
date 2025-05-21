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
    notes: "הלקוח מתלונן על כאבי ראש בעת קריאה ממושכת."
  },
  {
    id: 2,
    client_id: 1,
    clinic: "מרפאת עיניים צפון",
    examiner_name: "ד״ר גל לוי",
    exam_date: "2023-08-22",
    test_name: "בדיקת לחץ תוך עיני",
    dominant_eye: "R",
    notes: "לחץ תקין בשתי העיניים."
  },
  {
    id: 3,
    client_id: 1,
    clinic: "מרפאת עיניים ראשית",
    examiner_name: "ד״ר אביב כהן",
    exam_date: "2024-01-10",
    test_name: "בדיקת ראייה מקיפה",
    dominant_eye: "R",
    notes: "שינוי קל במרשם משקפיים."
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
    old_base: "",
    old_va: "6/9",
    old_ad: 0,
    obj_sph: -1.5,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -1.875,
    subj_fa: "6m",
    subj_sph: -1.5,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "32",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.00",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
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
    old_base: "",
    old_va: "6/9",
    old_ad: 0,
    obj_sph: -1.25,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.5,
    subj_fa: "6m",
    subj_sph: -1.25,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "31",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.00",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
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
    old_base: "",
    old_va: "6/6",
    old_ad: 0,
    obj_sph: -1.5,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -1.875,
    subj_fa: "6m",
    subj_sph: -1.5,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "32",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.00",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
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
    old_base: "",
    old_va: "6/6",
    old_ad: 0,
    obj_sph: -1.25,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.5,
    subj_fa: "6m",
    subj_sph: -1.25,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "31",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.00",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
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
    old_base: "",
    old_va: "6/6",
    old_ad: 0,
    obj_sph: -1.75,
    obj_cyl: -0.75,
    obj_ax: 175,
    obj_se: -2.125,
    subj_fa: "6m",
    subj_sph: -1.75,
    subj_cyl: -0.75,
    subj_ax: 175,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "32",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.25",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
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
    old_base: "",
    old_va: "6/6",
    old_ad: 0,
    obj_sph: -1.50,
    obj_cyl: -0.50,
    obj_ax: 85,
    obj_se: -1.75,
    subj_fa: "6m",
    subj_sph: -1.50,
    subj_cyl: -0.50,
    subj_ax: 85,
    subj_pris: 0,
    subj_base: "",
    subj_va: "6/6",
    subj_pd: "31",
    subj_ph: "6/6",
    ad_fcc: "",
    ad_read: "+2.25",
    ad_int: "",
    ad_bif: "",
    ad_mul: 0,
    ad_j: 0
  }
];

// Get all exams for a specific client
export function getExamsByClientId(clientId: number): OpticalExam[] {
  return mockOpticalExams.filter(exam => exam.client_id === clientId);
}

// Get a specific exam by ID
export function getExamById(examId: number): OpticalExam | undefined {
  return mockOpticalExams.find(exam => exam.id === examId);
}

// Get eye exams for a specific exam ID
export function getEyeExamsByExamId(examId: number): OpticalEyeExam[] {
  return mockOpticalEyeExams.filter(eyeExam => eyeExam.exam_id === examId);
}

// Create a new exam
export function createExam(exam: OpticalExam): OpticalExam {
  const newExam = {
    ...exam,
    id: Math.max(0, ...mockOpticalExams.map(e => e.id || 0)) + 1
  };
  mockOpticalExams.push(newExam);
  return newExam;
}

// Create a new eye exam
export function createEyeExam(eyeExam: OpticalEyeExam): OpticalEyeExam {
  const newEyeExam = {
    ...eyeExam,
    id: Math.max(0, ...mockOpticalEyeExams.map(e => e.id || 0)) + 1
  };
  mockOpticalEyeExams.push(newEyeExam);
  return newEyeExam;
}

// Update an exam
export function updateExam(exam: OpticalExam): OpticalExam | undefined {
  const index = mockOpticalExams.findIndex(e => e.id === exam.id);
  if (index !== -1) {
    mockOpticalExams[index] = exam;
    return exam;
  }
  return undefined;
}

// Update an eye exam
export function updateEyeExam(eyeExam: OpticalEyeExam): OpticalEyeExam | undefined {
  const index = mockOpticalEyeExams.findIndex(e => e.id === eyeExam.id);
  if (index !== -1) {
    mockOpticalEyeExams[index] = eyeExam;
    return eyeExam;
  }
  return undefined;
} 