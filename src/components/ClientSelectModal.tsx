import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getPaginatedClients } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { CustomModal } from "@/components/ui/custom-modal"
import { useUser } from "@/contexts/UserContext"
import { Skeleton } from "@/components/ui/skeleton"

interface ClientSelectModalProps {
  triggerText?: string
  onClientSelect: (clientId: number) => void
  triggerVariant?: "secondary" | "link" | "default" | "destructive" | "outline" | "ghost" | null | undefined
  isOpen?: boolean
  onClose?: () => void
}

export function ClientSelectModal({ triggerText, onClientSelect, triggerVariant = "default", isOpen, onClose }: ClientSelectModalProps) {
  const { currentClinic } = useUser()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [internalOpen, setInternalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const pageSize = 25

  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const isControlled = isOpen !== undefined
  const modalOpen = isControlled ? !!isOpen : internalOpen

  const fetchPage = async (nextOffset: number, isLoadMore: boolean = false) => {
    if (!currentClinic) return
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      const { items, total } = await getPaginatedClients(currentClinic.id, {
        limit: pageSize,
        offset: nextOffset,
        order: 'id_desc',
        search: debouncedSearch || undefined,
      })
      setClients(prev => (nextOffset === 0 ? items : [...prev, ...items]))
      setTotal(total)
      setOffset(nextOffset + items.length)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  // Initial load and when modal opens or clinic changes
  useEffect(() => {
    if (modalOpen && currentClinic) {
      setClients([])
      setTotal(0)
      setOffset(0)
      fetchPage(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, currentClinic, debouncedSearch])

  // Cleanup when component unmounts or modal closes
  useEffect(() => {
    if (!modalOpen) {
      setSearchQuery("")
      setLoading(false)
    }
  }, [modalOpen])

  // Infinite scroll handler
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onScroll = () => {
      if (loadingMore || loading) return
      if (clients.length >= total) return
      const threshold = 64
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
        fetchPage(offset, true)
      }
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [clients.length, total, offset, loading, loadingMore])

  const handleClientSelect = (clientId: number) => {
    setSearchQuery("")
    onClientSelect(clientId)
    // Close the modal after selection
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleModalClose = () => {
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
    setSearchQuery("")
  }

  const handleTriggerClick = () => {
    if (!isControlled) {
      setInternalOpen(true)
    }
  }

  return (
    <>
      {triggerText && (
        <Button onClick={handleTriggerClick} variant={triggerVariant}>{triggerText}</Button>
      )}
      
      <CustomModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        title="בחר לקוח"
      >
        <div className="space-y-4 w-md">
          <Input
            placeholder="חיפוש לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir="rtl"
            autoFocus={false}
          />
          <div ref={listRef} className="h-[300px] overflow-y-auto" style={{scrollbarWidth: 'none'}}>
            {loading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="p-3 border rounded-md mb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-gray-500">לא נמצאו לקוחות</div>
              </div>
            ) : (
              clients.map((client) => (
                <div
                  key={`client-${client.id}`}
                  className="p-3 border rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 mb-2"
                  onClick={() => handleClientSelect(client.id!)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleClientSelect(client.id!)
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="font-medium">
                    {client.first_name} {client.last_name}
                  </div>
                  {client.phone_mobile && (
                    <div className="text-sm text-gray-500">{client.phone_mobile}</div>
                  )}
                </div>
              ))
            )}
            {loadingMore && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skeleton-more-${i}`} className="p-3 border rounded-md mb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CustomModal>
    </>
  )
} 