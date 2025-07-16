import React, { createContext, useContext, useState, useEffect } from 'react'
import { Client, ContactLens, MedicalLog, Referral, File, Appointment, OpticalExam, Order } from '@/lib/db/schema'
import { getContactLensesByClientId } from '@/lib/db/contact-lens-db'
import { getExamsByClientId } from '@/lib/db/exams-db'
import { getOrdersByClientId } from '@/lib/db/orders-db'
import { getMedicalLogsByClientId } from '@/lib/db/medical-logs-db'
import { getReferralsByClientId } from '@/lib/db/referral-db'
import { getAppointmentsByClient } from '@/lib/db/appointments-db'
import { getFilesByClientId } from '@/lib/db/files-db'

interface ClientDataContextType {
  contactLenses: ContactLens[]
  exams: OpticalExam[]
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
  addContactLens: (contactLens: ContactLens) => void
  addExam: (exam: OpticalExam) => void
  addOrder: (order: Order) => void
  addMedicalLog: (medicalLog: MedicalLog) => void
  addReferral: (referral: Referral) => void
  addAppointment: (appointment: Appointment) => void
  addFile: (file: File) => void
  updateContactLens: (contactLens: ContactLens) => void
  updateExam: (exam: OpticalExam) => void
  updateOrder: (order: Order) => void
  updateMedicalLog: (medicalLog: MedicalLog) => void
  updateReferral: (referral: Referral) => void
  updateAppointment: (appointment: Appointment) => void
  updateFile: (file: File) => void
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined)

export function ClientDataProvider({ children, clientId }: { children: React.ReactNode, clientId: number }) {
  const [contactLenses, setContactLenses] = useState<ContactLens[]>([])
  const [exams, setExams] = useState<OpticalExam[]>([])
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

  // Refresh methods (existing)
  const refreshContactLenses = async () => {
    setLoading(prev => ({ ...prev, contactLenses: true }))
    const data = await getExamsByClientId(clientId, 'opticlens')
    setContactLenses(data)
    setLoading(prev => ({ ...prev, contactLenses: false }))
  }

  const refreshExams = async () => {
    setLoading(prev => ({ ...prev, exams: true }))
    const data = await getExamsByClientId(clientId, 'exam')
    setExams(data)
    setLoading(prev => ({ ...prev, exams: false }))
  }

  const refreshOrders = async () => {
    setLoading(prev => ({ ...prev, orders: true }))
    const data = await getOrdersByClientId(clientId)
    setOrders(data)
    setLoading(prev => ({ ...prev, orders: false }))
  }

  const refreshMedicalLogs = async () => {
    setLoading(prev => ({ ...prev, medicalLogs: true }))
    const data = await getMedicalLogsByClientId(clientId)
    setMedicalLogs(data)
    setLoading(prev => ({ ...prev, medicalLogs: false }))
  }

  const refreshReferrals = async () => {
    setLoading(prev => ({ ...prev, referrals: true }))
    const data = await getReferralsByClientId(clientId)
    setReferrals(data)
    setLoading(prev => ({ ...prev, referrals: false }))
  }

  const refreshAppointments = async () => {
    setLoading(prev => ({ ...prev, appointments: true }))
    const data = await getAppointmentsByClient(clientId)
    setAppointments(data)
    setLoading(prev => ({ ...prev, appointments: false }))
  }

  const refreshFiles = async () => {
    setLoading(prev => ({ ...prev, files: true }))
    const data = await getFilesByClientId(clientId)
    setFiles(data)
    setLoading(prev => ({ ...prev, files: false }))
  }

  // Optimistic update methods
  const removeContactLens = (id: number) => {
    setContactLenses(prev => prev.filter(item => item.id !== id))
  }

  const removeExam = (id: number) => {
    setExams(prev => prev.filter(item => item.id !== id))
  }

  const removeOrder = (id: number) => {
    setOrders(prev => prev.filter(item => item.id !== id))
  }

  const removeMedicalLog = (id: number) => {
    setMedicalLogs(prev => prev.filter(item => item.id !== id))
  }

  const removeReferral = (id: number) => {
    setReferrals(prev => prev.filter(item => item.id !== id))
  }

  const removeAppointment = (id: number) => {
    setAppointments(prev => prev.filter(item => item.id !== id))
  }

  const removeFile = (id: number) => {
    setFiles(prev => prev.filter(item => item.id !== id))
  }

  const addContactLens = (contactLens: ContactLens) => {
    setContactLenses(prev => [...prev, contactLens])
  }

  const addExam = (exam: OpticalExam) => {
    setExams(prev => [...prev, exam])
  }

  const addOrder = (order: Order) => {
    setOrders(prev => [...prev, order])
  }

  const addMedicalLog = (medicalLog: MedicalLog) => {
    setMedicalLogs(prev => [...prev, medicalLog])
  }

  const addReferral = (referral: Referral) => {
    setReferrals(prev => [...prev, referral])
  }

  const addAppointment = (appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment])
  }

  const addFile = (file: File) => {
    setFiles(prev => [...prev, file])
  }

  const updateContactLens = (contactLens: ContactLens) => {
    setContactLenses(prev => prev.map(item => item.id === contactLens.id ? contactLens : item))
  }

  const updateExam = (exam: OpticalExam) => {
    setExams(prev => prev.map(item => item.id === exam.id ? exam : item))
  }

  const updateOrder = (order: Order) => {
    setOrders(prev => prev.map(item => item.id === order.id ? order : item))
  }

  const updateMedicalLog = (medicalLog: MedicalLog) => {
    setMedicalLogs(prev => prev.map(item => item.id === medicalLog.id ? medicalLog : item))
  }

  const updateReferral = (referral: Referral) => {
    setReferrals(prev => prev.map(item => item.id === referral.id ? referral : item))
  }

  const updateAppointment = (appointment: Appointment) => {
    setAppointments(prev => prev.map(item => item.id === appointment.id ? appointment : item))
  }

  const updateFile = (file: File) => {
    setFiles(prev => prev.map(item => item.id === file.id ? file : item))
  }

  useEffect(() => {
    refreshContactLenses()
    refreshExams()
    refreshOrders()
    refreshMedicalLogs()
    refreshReferrals()
    refreshAppointments()
    refreshFiles()
  }, [clientId])

  return (
    <ClientDataContext.Provider value={{
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
    }}>
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