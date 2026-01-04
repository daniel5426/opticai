import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  refresh: () => void
  createItem: (name: string) => Promise<LookupItem | null>
  isCreating: boolean
}

export function useLookupData(tableName: string): UseLookupDataResult {
  const queryClient = useQueryClient()
  const table = lookupTables[tableName as keyof typeof lookupTables]

  const {
    data = [],
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['lookup', tableName],
    queryFn: async () => {
      if (!table) throw new Error('טבלה לא נמצאה')
      return (await table.getAll()) || []
    },
    enabled: !!table
  })

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      if (!table) throw new Error('טבלה לא נמצאה')
      const newItem = await table.create({ name: name.trim() })
      if (!newItem) throw new Error('שגיאה ביצירת פריט')
      return newItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookup', tableName] })
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