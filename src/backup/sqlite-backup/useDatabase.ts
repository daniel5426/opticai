import { useState, useEffect } from 'react'
import { Client, OpticalExam, Order } from './schema-interface'
import * as clientsDb from './clients-db'
import * as examsDb from './exams-db'
import * as ordersDb from './orders-db'

// Define return types for each database operation
type DbOperationResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

export const useDatabase = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [exams, setExams] = useState<OpticalExam[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [clientsData, examsData, ordersData] = await Promise.all([
          clientsDb.getAllClients(),
          [],
          []
        ])
        setClients(clientsData)
        setExams(examsData)
        setOrders(ordersData)
      } catch (error) {
        console.error('Error loading database data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const refreshClients = async () => {
    try {
      const clientsData = await clientsDb.getAllClients()
      setClients(clientsData)
    } catch (error) {
      console.error('Error refreshing clients:', error)
    }
  }

  const refreshExamsByClient = async (clientId: number) => {
    try {
      const examsData = await examsDb.getExamsByClientId(clientId)
      setExams(examsData)
    } catch (error) {
      console.error('Error refreshing exams:', error)
    }
  }

  const refreshOrdersByClient = async (clientId: number) => {
    try {
      const ordersData = await ordersDb.getOrdersByClientId(clientId)
      setOrders(ordersData)
    } catch (error) {
      console.error('Error refreshing orders:', error)
    }
  }

  return {
    clients,
    exams,
    orders,
    loading,
    refreshClients,
    refreshExamsByClient,
    refreshOrdersByClient,
    
    // Client operations
    createClient: clientsDb.createClient,
    updateClient: clientsDb.updateClient,
    deleteClient: clientsDb.deleteClient,
    getClientById: clientsDb.getClientById,
    
    // Exam operations
    getExamsByClientId: examsDb.getExamsByClientId,
    getExamById: examsDb.getExamById,
    createExam: examsDb.createExam,
    updateExam: examsDb.updateExam,
    
    // Order operations
    getOrdersByClientId: ordersDb.getOrdersByClientId,
    getOrderById: ordersDb.getOrderById,
    createOrder: ordersDb.createOrder,
    updateOrder: ordersDb.updateOrder,
    deleteOrder: ordersDb.deleteOrder,
  }
} 