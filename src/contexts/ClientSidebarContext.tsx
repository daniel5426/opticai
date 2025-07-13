import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { Client } from '@/lib/db/schema'
import { useParams } from "@tanstack/react-router"
import { getClientById } from "@/lib/db/clients-db"

interface ClientSidebarContextType {
  isOpen: boolean
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  currentClient: Client | null
  setCurrentClient: (client: Client | null) => void
  updateCurrentClient: (client: Client) => void
  isClientSpacePage: boolean
  setIsClientSpacePage: (isClientSpace: boolean) => void
  activeTab: string | null
  setActiveTab: (tab: string | null) => void
}

const ClientSidebarContext = createContext<ClientSidebarContextType | undefined>(undefined)

interface ClientSidebarProviderProps {
  children: ReactNode
}

export function ClientSidebarProvider({ children }: ClientSidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentClient, setCurrentClient] = useState<Client | null>(null)
  const [isClientSpacePage, setIsClientSpacePage] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    const savedState = localStorage.getItem('client-sidebar-last-state')
    const initialState = savedState === 'true'
    setIsOpen(initialState)
    setHasInitialized(true)
  }, [])

  const params = useParams({ strict: false }) as { clientId?: string }
  const clientIdNum = params.clientId ? Number(params.clientId) : undefined

  useEffect(() => {
    if (clientIdNum) {
      setIsClientSpacePage(true)
      if (!currentClient || currentClient.id !== clientIdNum) {
        setCurrentClient(null)
        getClientById(clientIdNum).then(client => {
          if (client && client.id === clientIdNum) {
            setCurrentClient(client)
          }
        }).catch(err => {
          console.error('Failed to fetch client:', err)
          setCurrentClient(null)
        })
      }
    } else {
      setIsClientSpacePage(false)
      setCurrentClient(null)
    }
  }, [clientIdNum, currentClient?.id])

  const toggleSidebar = useCallback(() => {
    if (!isClientSpacePage || !currentClient) return
    
    setIsOpen(prev => {
      const newState = !prev
      localStorage.setItem('client-sidebar-last-state', newState.toString())
      return newState
    })
  }, [isClientSpacePage, currentClient])

  const openSidebar = useCallback(() => {
    if (!isClientSpacePage || !currentClient) return
    
    setIsOpen(true)
    localStorage.setItem('client-sidebar-last-state', 'true')
  }, [isClientSpacePage, currentClient])

  const closeSidebar = useCallback(() => {
    setIsOpen(false)
    if (isClientSpacePage) {
      localStorage.setItem('client-sidebar-last-state', 'false')
    }
  }, [isClientSpacePage])

  const handleSetCurrentClient = useCallback((client: Client | null) => {
    setCurrentClient(client)
    if (client) {
      setIsClientSpacePage(true)
    }
  }, [])

  const handleSetIsClientSpacePage = useCallback((isClientSpace: boolean) => {
    setIsClientSpacePage(isClientSpace)
  }, [])

  const updateCurrentClient = useCallback((client: Client) => {
    setCurrentClient(client)
  }, [])

  const value = {
    isOpen,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    currentClient,
    setCurrentClient: handleSetCurrentClient,
    updateCurrentClient,
    isClientSpacePage,
    setIsClientSpacePage: handleSetIsClientSpacePage,
    activeTab,
    setActiveTab
  }

  return (
    <ClientSidebarContext.Provider value={value}>
      {children}
    </ClientSidebarContext.Provider>
  )
}

export function useClientSidebar() {
  const context = useContext(ClientSidebarContext)
  if (context === undefined) {
    throw new Error('useClientSidebar must be used within a ClientSidebarProvider')
  }
  return context
} 