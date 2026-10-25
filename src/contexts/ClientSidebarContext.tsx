import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { Client } from '@/lib/db/schema-interface'
import { useParams } from "@tanstack/react-router"
import { getClientById } from "@/lib/db/clients-db"

interface ClientSidebarContextType {
  isOpen: boolean
  panelMode: "info" | "billing"
  panelHost: HTMLDivElement | null
  setPanelHost: (host: HTMLDivElement | null) => void
  openBillingPanel: () => void
  resetPanelMode: () => void
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
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const savedState = localStorage.getItem('client-sidebar-last-state')
      return savedState === 'true'
    } catch {
      return false
    }
  })
  const [panelMode, setPanelMode] = useState<"info" | "billing">("info")
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null)
  const resetPanelMode = useCallback(() => setPanelMode("info"), [])
  const openBillingPanel = useCallback(() => { setPanelMode("billing"); setIsOpen(true) }, [])
  const [currentClient, setCurrentClient] = useState<Client | null>(null)
  const params = useParams({ strict: false }) as { clientId?: string }
  const clientIdNum = params.clientId ? Number(params.clientId) : undefined
  const [isClientSpacePage, setIsClientSpacePage] = useState<boolean>(Boolean(clientIdNum))
  const [hasInitialized, setHasInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    setHasInitialized(true)
  }, [])

  // params already read above for initial state

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
    
    setPanelMode("info")
    setIsOpen(prev => {
      const newState = panelMode === "billing" ? true : !prev
      localStorage.setItem('client-sidebar-last-state', newState.toString())
      return newState
    })
  }, [isClientSpacePage, currentClient, panelMode])

  const openSidebar = useCallback(() => {
    if (!isClientSpacePage || !currentClient) return
    
    setPanelMode("info")
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

  const handleSetActiveTab = useCallback((tab: string | null) => {
    setActiveTab(tab)
  }, [])

  const value = useMemo(() => ({
    isOpen,
    panelMode, panelHost, setPanelHost, openBillingPanel, resetPanelMode,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    currentClient,
    setCurrentClient: handleSetCurrentClient,
    updateCurrentClient,
    isClientSpacePage,
    setIsClientSpacePage: handleSetIsClientSpacePage,
    activeTab,
    setActiveTab: handleSetActiveTab
  }), [
    isOpen,
    panelMode, panelHost, setPanelHost, openBillingPanel, resetPanelMode,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    currentClient,
    handleSetCurrentClient,
    updateCurrentClient,
    isClientSpacePage,
    handleSetIsClientSpacePage,
    activeTab,
    handleSetActiveTab
  ])

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