import { useState, useEffect } from 'react'
import { lookupTables } from '@/lib/db/lookup-db'

interface LookupItem {
  id?: number
  name: string
  created_at?: string
}

interface UseLookupDataResult {
  data: LookupItem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createItem: (name: string) => Promise<LookupItem | null>
}

export function useLookupData(tableName: string): UseLookupDataResult {
  const [data, setData] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const table = lookupTables[tableName as keyof typeof lookupTables]

  const loadData = async () => {
    if (!table) {
      setError('טבלה לא נמצאה')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const items = await table.getAll()
      setData(items || [])
    } catch (err) {
      console.error(`Error loading ${tableName} data:`, err)
      setError('שגיאה בטעינת הנתונים')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const createItem = async (name: string): Promise<LookupItem | null> => {
    if (!table) return null

    try {
      const newItem = await table.create({ name: name.trim() })
      if (newItem) {
        setData(prev => [...prev, newItem])
        return newItem
      }
      return null
    } catch (err) {
      console.error(`Error creating ${tableName} item:`, err)
      return null
    }
  }

  useEffect(() => {
    loadData()
  }, [tableName])

  return {
    data,
    loading,
    error,
    refresh: loadData,
    createItem
  }
}

export function useLookupOptions(tableName: string) {
  const { data, loading, error, refresh, createItem } = useLookupData(tableName)
  
  const options = data.map(item => ({
    value: item.name,
    label: item.name,
    id: item.id
  }))

  return {
    options,
    loading,
    error,
    refresh,
    createItem
  }
} 