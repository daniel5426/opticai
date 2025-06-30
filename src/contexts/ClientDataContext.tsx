import React, { createContext, useContext, useState, useEffect } from 'react'
import { Client, ContactLens, MedicalLog, Referral, File } from '@/lib/db/schema'
import { getContactLensesByClientId } from '@/lib/db/contact-lens-db'
import { getExamsByClientId } from '@/lib/db/exams-db'
import { getOrdersByClientId } from '@/lib/db/orders-db'
import { getMedicalLogsByClientId } from '@/lib/db/medical-logs-db'
import { getReferralsByClientId } from '@/lib/db/referral-db'
import { getAppointmentsByClient } from '@/lib/db/appointments-db'
import { getFilesByClientId } from '@/lib/db/files-db'

interface ClientDataContextType {
  contactLenses: ContactLens[]
  exams: any[]
  orders: any[]
  medicalLogs: MedicalLog[]
  referrals: Referral[]
  appointments: any[]
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
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined)

export function ClientDataProvider({ children, clientId }: { children: React.ReactNode, clientId: number }) {
  const [contactLenses, setContactLenses] = useState<ContactLens[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [medicalLogs, setMedicalLogs] = useState<MedicalLog[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
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

  const refreshContactLenses = async () => {
    setLoading(prev => ({ ...prev, contactLenses: true }))
    const data = await getContactLensesByClientId(clientId)
    setContactLenses(data)
    setLoading(prev => ({ ...prev, contactLenses: false }))
  }

  const refreshExams = async () => {
    setLoading(prev => ({ ...prev, exams: true }))
    const data = await getExamsByClientId(clientId)
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
      refreshFiles
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