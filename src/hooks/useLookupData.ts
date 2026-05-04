import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lookupTables } from '@/lib/db/lookup-db'
import { useUser } from '@/contexts/UserContext'

interface LookupItem {
  id?: number
  clinic_id?: number
  name: string
  created_at?: string
}

interface UseLookupDataResult {
  data: LookupItem[]
  loading: boolean
  error: string | null
  refresh: () => void
  createItem: (name: string) => Promise<LookupItem | null>
  isCreating: boolean
}

export function useLookupData(tableName: string): UseLookupDataResult {
  const queryClient = useQueryClient()
  const { currentClinic } = useUser()
  const clinicId = currentClinic?.id
  const table = lookupTables[tableName as keyof typeof lookupTables]

  const {
    data = [],
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['lookup', clinicId, tableName],
    queryFn: async () => {
      if (!table) throw new Error('טבלה לא נמצאה')
      if (!clinicId) return []
      return (await table.getAll(clinicId)) || []
    },
    enabled: !!table && !!clinicId
  })

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      if (!table) throw new Error('טבלה לא נמצאה')
      if (!clinicId) throw new Error('מרפאה לא נבחרה')
      const newItem = await table.create({ clinic_id: clinicId, name: name.trim() })
      if (!newItem) throw new Error('שגיאה ביצירת פריט')
      return newItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookup', clinicId, tableName] })
    }
  })

  return {
    data,
    loading: isLoading,
    error: isError ? 'שגיאה בטעינת הנתונים' : null,
    refresh: () => refetch(),
    createItem: (name: string) => mutation.mutateAsync(name),
    isCreating: mutation.isPending
  }
}

export function useLookupOptions(tableName: string) {
  const { data, loading, error, refresh, createItem, isCreating } = useLookupData(tableName)
  
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
    createItem,
    isCreating
  }
}
