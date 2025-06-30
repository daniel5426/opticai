import React from "react"
import { ExamsTable } from "@/components/exams-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"
import { OpticalExam } from "@/lib/db/schema";

export function ClientExamsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { exams, loading, refreshExams } = useClientData()
  const [currentExams, setCurrentExams] = React.useState<OpticalExam[]>(exams);

  React.useEffect(() => {
    setCurrentExams(exams);
  }, [exams]);

  const handleExamDeleted = (deletedExamId: number) => {
    setCurrentExams(prevExams => prevExams.filter(exam => exam.id !== deletedExamId));
  };

  const handleExamDeleteFailed = () => {
    refreshExams(); // Trigger a full refresh only on failure
  };


  return (
    <ExamsTable 
      data={currentExams} 
      clientId={Number(clientId)} 
      onExamDeleted={handleExamDeleted} 
      onExamDeleteFailed={handleExamDeleteFailed}
      loading={loading.exams}
    />
  )
} 