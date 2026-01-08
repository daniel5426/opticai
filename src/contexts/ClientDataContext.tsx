import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { Client, MedicalLog, Referral, File, Appointment, OpticalExam, Order } from '@/lib/db/schema-interface'
import { getExamsByClientId } from '@/lib/db/exams-db'
import { getOrdersByClientId } from '@/lib/db/orders-db'
import { getMedicalLogsByClientId } from '@/lib/db/medical-logs-db'
import { getReferralsByClientId } from '@/lib/db/referral-db'
import { getAppointmentsByClient } from '@/lib/db/appointments-db'
import { getFilesByClientId } from '@/lib/db/files-db'
import { getUserById } from '@/lib/db/users-db'
import { getClientById } from '@/lib/db/clients-db'

interface ExamWithNames extends OpticalExam {
  username?: string;
  clientName?: string;
}

interface ClientDataContextType {
  contactLenses: OpticalExam[]
  exams: ExamWithNames[]
  orders: Order[]
  medicalLogs: MedicalLog[]
  referrals: Referral[]
  appointments: Appointment[]
  files: File[]
  loading: {
    contactLenses: boolean
    exams: boolean
    orders: boolean
    medicalLogs: boolean
    referrals: boolean
    appointments: boolean
    files: boolean
  }
  refreshContactLenses: () => Promise<void>
  refreshExams: () => Promise<void>
  refreshOrders: () => Promise<void>
  refreshMedicalLogs: () => Promise<void>
  refreshReferrals: () => Promise<void>
  refreshAppointments: () => Promise<void>
  refreshFiles: () => Promise<void>
  // Optimistic update methods
  removeContactLens: (id: number) => void
  removeExam: (id: number) => void
  removeOrder: (id: number) => void
  removeMedicalLog: (id: number) => void
  removeReferral: (id: number) => void
  removeAppointment: (id: number) => void
  removeFile: (id: number) => void
  addContactLens: (contactLens: OpticalExam) => void
  addExam: (exam: OpticalExam) => void
  addOrder: (order: Order) => void
  addMedicalLog: (medicalLog: MedicalLog) => void
  addReferral: (referral: Referral) => void
  addAppointment: (appointment: Appointment) => void
  addFile: (file: File) => void
  updateContactLens: (contactLens: OpticalExam) => void
  updateExam: (exam: OpticalExam) => void
  updateOrder: (order: Order) => void
  updateMedicalLog: (medicalLog: MedicalLog) => void
  updateReferral: (referral: Referral) => void
  updateAppointment: (appointment: Appointment) => void
  updateFile: (file: File) => void
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined)

export function ClientDataProvider({ children, clientId }: { children: React.ReactNode, clientId: number }) {
  const [contactLenses, setContactLenses] = useState<OpticalExam[]>([])
  const [exams, setExams] = useState<ExamWithNames[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [medicalLogs, setMedicalLogs] = useState<MedicalLog[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [files, setFiles] = useState<File[]>([])

  const [loading, setLoading] = useState({
    contactLenses: true,
    exams: true,
    orders: true,
    medicalLogs: true,
    referrals: true,
    appointments: true,
    files: true
  })

  // Refresh methods (existing) - wrapped in useCallback to prevent re-renders
  const refreshContactLenses = useCallback(async () => {
    setLoading(prev => ({ ...prev, contactLenses: true }))
    const data = await getExamsByClientId(clientId, 'opticlens')
    let clientName = ''
    if (clientId) {
      const client = await getClientById(clientId)
      clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : ''
    }
    const enriched = await Promise.all(
      data.map(async (exam) => {
        let username = ''
        if (exam.user_id) {
          const user = await getUserById(exam.user_id)
          username = user?.username || ''
        }
        return { ...exam, username, clientName }
      })
    )
    setContactLenses(enriched)
    setLoading(prev => ({ ...prev, contactLenses: false }))
  }, [clientId])

  const refreshExams = useCallback(async () => {
    setLoading(prev => ({ ...prev, exams: true }))
    const data = await getExamsByClientId(clientId, 'exam')
    let clientName = ''
    if (clientId) {
      const client = await getClientById(clientId)
      clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : ''
    }
    const enriched = await Promise.all(
      data.map(async (exam) => {
        let username = ''
        if (exam.user_id) {
          const user = await getUserById(exam.user_id)
          username = user?.username || ''
        }
        return { ...exam, username, clientName }
      })
    )
    setExams(enriched)
    setLoading(prev => ({ ...prev, exams: false }))
  }, [clientId])

  const refreshOrders = useCallback(async () => {
    setLoading(prev => ({ ...prev, orders: true }))
    const data = await getOrdersByClientId(clientId)
    setOrders(data)
    setLoading(prev => ({ ...prev, orders: false }))
  }, [clientId])

  const refreshMedicalLogs = useCallback(async () => {
    setLoading(prev => ({ ...prev, medicalLogs: true }))
    const data = await getMedicalLogsByClientId(clientId)
    setMedicalLogs(data)
    setLoading(prev => ({ ...prev, medicalLogs: false }))
  }, [clientId])

  const refreshReferrals = useCallback(async () => {
    setLoading(prev => ({ ...prev, referrals: true }))
    const data = await getReferralsByClientId(clientId)
    setReferrals(data)
    setLoading(prev => ({ ...prev, referrals: false }))
  }, [clientId])

  const refreshAppointments = useCallback(async () => {
    setLoading(prev => ({ ...prev, appointments: true }))
    const data = await getAppointmentsByClient(clientId)
    setAppointments(data)
    setLoading(prev => ({ ...prev, appointments: false }))
  }, [clientId])

  const refreshFiles = useCallback(async () => {
    setLoading(prev => ({ ...prev, files: true }))
    const data = await getFilesByClientId(clientId)
    setFiles(data)
    setLoading(prev => ({ ...prev, files: false }))
  }, [clientId])

  // Optimistic update methods - wrapped in useCallback
  const removeContactLens = useCallback((id: number) => {
    setContactLenses(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeExam = useCallback((id: number) => {
    setExams(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeOrder = useCallback((id: number) => {
    setOrders(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeMedicalLog = useCallback((id: number) => {
    setMedicalLogs(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeReferral = useCallback((id: number) => {
    setReferrals(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeAppointment = useCallback((id: number) => {
    setAppointments(prev => prev.filter(item => item.id !== id))
  }, [])

  const removeFile = useCallback((id: number) => {
    setFiles(prev => prev.filter(item => item.id !== id))
  }, [])

  const addContactLens = useCallback((contactLens: OpticalExam) => {
    setContactLenses(prev => [...prev, contactLens])
  }, [])

  const addExam = useCallback((exam: OpticalExam) => {
    setExams(prev => [...prev, exam])
  }, [])

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, order])
  }, [])

  const addMedicalLog = useCallback((medicalLog: MedicalLog) => {
    setMedicalLogs(prev => [...prev, medicalLog])
  }, [])

  const addReferral = useCallback((referral: Referral) => {
    setReferrals(prev => [...prev, referral])
  }, [])

  const addAppointment = useCallback((appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment])
  }, [])

  const addFile = useCallback((file: File) => {
    setFiles(prev => [...prev, file])
  }, [])

  const updateContactLens = useCallback((contactLens: OpticalExam) => {
    setContactLenses(prev => prev.map(item => item.id === contactLens.id ? contactLens : item))
  }, [])

  const updateExam = useCallback((exam: OpticalExam) => {
    setExams(prev => prev.map(item => item.id === exam.id ? exam : item))
  }, [])

  const updateOrder = useCallback((order: Order) => {
    setOrders(prev => prev.map(item => item.id === order.id ? order : item))
  }, [])

  const updateMedicalLog = useCallback((medicalLog: MedicalLog) => {
    setMedicalLogs(prev => prev.map(item => item.id === medicalLog.id ? medicalLog : item))
  }, [])

  const updateReferral = useCallback((referral: Referral) => {
    setReferrals(prev => prev.map(item => item.id === referral.id ? referral : item))
  }, [])

  const updateAppointment = useCallback((appointment: Appointment) => {
    setAppointments(prev => prev.map(item => item.id === appointment.id ? appointment : item))
  }, [])

  const updateFile = useCallback((file: File) => {
    setFiles(prev => prev.map(item => item.id === file.id ? file : item))
  }, [])

  useEffect(() => {
    refreshContactLenses()
    refreshExams()
    refreshOrders()
    refreshMedicalLogs()
    refreshReferrals()
    refreshAppointments()
    refreshFiles()
  }, [clientId, refreshContactLenses, refreshExams, refreshOrders, refreshMedicalLogs, refreshReferrals, refreshAppointments, refreshFiles])



  const value = useMemo(() => ({
    contactLenses,
    exams,
    orders,
    medicalLogs,
    referrals,
    appointments,
    files,
    loading,
    refreshContactLenses,
    refreshExams,
    refreshOrders,
    refreshMedicalLogs,
    refreshReferrals,
    refreshAppointments,
    refreshFiles,
    removeContactLens,
    removeExam,
    removeOrder,
    removeMedicalLog,
    removeReferral,
    removeAppointment,
    removeFile,
    addContactLens,
    addExam,
    addOrder,
    addMedicalLog,
    addReferral,
    addAppointment,
    addFile,
    updateContactLens,
    updateExam,
    updateOrder,
    updateMedicalLog,
    updateReferral,
    updateAppointment,
    updateFile
  }), [
    contactLenses,
    exams,
    orders,
    medicalLogs,
    referrals,
    appointments,
    files,
    loading,
    refreshContactLenses,
    refreshExams,
    refreshOrders,
    refreshMedicalLogs,
    refreshReferrals,
    refreshAppointments,
    refreshFiles,
    removeContactLens,
    removeExam,
    removeOrder,
    removeMedicalLog,
    removeReferral,
    removeAppointment,
    removeFile,
    addContactLens,
    addExam,
    addOrder,
    addMedicalLog,
    addReferral,
    addAppointment,
    addFile,
    updateContactLens,
    updateExam,
    updateOrder,
    updateMedicalLog,
    updateReferral,
    updateAppointment,
    updateFile
  ])

  return (
    <ClientDataContext.Provider value={value}>
      {children}
    </ClientDataContext.Provider>
  )
}

export const useClientData = () => {
  const context = useContext(ClientDataContext)
  if (context === undefined) {
    throw new Error('useClientData must be used within a ClientDataProvider')
  }
  return context
} 