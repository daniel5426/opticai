export const pageConfig = {
  exam: {
    dbType: "exam" as const,
    sidebarTab: "exams",
    paramName: "examId",
    newTitle: "בדיקה חדשה",
    detailTitle: "פרטי בדיקה",
    headerInfo: (id: string) => `בדיקה מס' ${id}`,
    saveSuccessNew: "בדיקה חדשה נוצרה בהצלחה",
    saveSuccessUpdate: "פרטי הבדיקה עודכנו בהצלחה",
    saveErrorNew: "לא הצלחנו ליצור את הבדיקה",
    saveErrorNewData: "לא הצלחנו ליצור את נתוני הבדיקה",
  },
};
