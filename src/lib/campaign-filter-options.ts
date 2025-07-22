export const FILTER_FIELDS = {
  // Personal Info
  'first_name': { label: 'שם פרטי', type: 'text', category: 'מידע אישי' },
  'last_name': { label: 'שם משפחה', type: 'text', category: 'מידע אישי' },
  'gender': { label: 'מין', type: 'select', options: ['זכר', 'נקבה'], category: 'מידע אישי' },
  'age': { label: 'גיל', type: 'number', category: 'מידע אישי' },
  'date_of_birth': { label: 'תאריך לידה', type: 'date', category: 'מידע אישי' },
  'national_id': { label: 'תעודת זהות', type: 'text', category: 'מידע אישי' },
  'health_fund': { label: 'קופת חולים', type: 'select', options: ['כללית', 'מכבי', 'לאומית', 'מאוחדת'], category: 'מידע אישי' },
  
  // Contact Info
  'phone_mobile': { label: 'טלפון נייד', type: 'text', category: 'פרטי התקשרות' },
  'email': { label: 'דואר אלקטרוני', type: 'text', category: 'פרטי התקשרות' },
  'address_city': { label: 'עיר', type: 'text', category: 'פרטי התקשרות' },
  
  // Family
  'has_family': { label: 'יש משפחה', type: 'boolean', category: 'משפחה' },
  'family_role': { label: 'תפקיד במשפחה', type: 'select', options: ['אב', 'אם', 'בן', 'בת', 'אח', 'אחות'], category: 'משפחה' },
  
  // Status & Financial
  'status': { label: 'סטטוס', type: 'select', options: ['פעיל', 'לא פעיל', 'חסום'], category: 'סטטוס' },
  'blocked_checks': { label: 'חסום לצ\'קים', type: 'boolean', category: 'סטטוס' },
  'blocked_credit': { label: 'חסום לאשראי', type: 'boolean', category: 'סטטוס' },
  'discount_percent': { label: 'אחוז הנחה', type: 'number', category: 'סטטוס' },
  
  // Dates
  'file_creation_date': { label: 'תאריך יצירת תיק', type: 'date', category: 'תאריכים' },
  'membership_end': { label: 'תאריך סיום חברות', type: 'date', category: 'תאריכים' },
  'service_end': { label: 'תאריך סיום שירות', type: 'date', category: 'תאריכים' },
  
  // Activity
  'last_exam_days': { label: 'ימים מאז בדיקה אחרונה', type: 'number', category: 'פעילות' },
  'last_order_days': { label: 'ימים מאז הזמנה אחרונה', type: 'number', category: 'פעילות' },
  'last_appointment_days': { label: 'ימים מאז תור אחרון', type: 'number', category: 'פעילות' },
  'has_appointments': { label: 'יש תורים', type: 'boolean', category: 'פעילות' },
  'has_exams': { label: 'יש בדיקות', type: 'boolean', category: 'פעילות' },
  'has_orders': { label: 'יש הזמנות', type: 'boolean', category: 'פעילות' },
  'total_orders': { label: 'סך הזמנות', type: 'number', category: 'פעילות' },
  'total_exams': { label: 'סך בדיקות', type: 'number', category: 'פעילות' },
} as const;

export const OPERATORS = {
  text: [
    { value: 'contains', label: 'מכיל' },
    { value: 'not_contains', label: 'לא מכיל' },
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'starts_with', label: 'מתחיל ב' },
    { value: 'ends_with', label: 'מסתיים ב' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  number: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'greater_than', label: 'גדול מ' },
    { value: 'less_than', label: 'קטן מ' },
    { value: 'greater_equal', label: 'גדול או שווה ל' },
    { value: 'less_equal', label: 'קטן או שווה ל' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  date: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'after', label: 'אחרי' },
    { value: 'before', label: 'לפני' },
    { value: 'last_days', label: 'ב X ימים האחרונים' },
    { value: 'next_days', label: 'ב X ימים הבאים' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  boolean: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
  ],
  select: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
  ],
};