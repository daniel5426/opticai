import { createContext, useContext, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useUser } from "@/contexts/UserContext"
import { apiClient } from "@/lib/api-client"

export const ClientHistoryClinicContext = createContext<number | undefined>(undefined)
export const useClientHistoryClinic = () => useContext(ClientHistoryClinicContext)

export function useCompanyClinicFilter(defaultAll = false) {
  const { currentClinic, currentUser } = useUser()
  const companyId = currentUser?.company_id ?? currentClinic?.company_id
  const [selection, setSelection] = useState<{ companyId?: number; currentClinicId?: number; value: string }>()
  const defaultValue = defaultAll ? "all" : "current"
  const value = selection?.companyId === companyId && selection?.currentClinicId === currentClinic?.id
    ? selection.value : defaultValue
  const clinicId = value === "all" ? undefined : value === "current" ? currentClinic?.id : Number(value)
  const clinics = useQuery({
    queryKey: ["company-record-clinics", companyId],
    enabled: Boolean(companyId),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await apiClient.getRecordClinics()
      // Older running APIs do not yet expose the names-only directory route.
      if (response.error && [404, 405, 422].includes(response.status ?? 0)) {
        const legacy = await apiClient.getClinicsByCompany(companyId!)
        if (legacy.error) throw new Error(legacy.error)
        return (legacy.data ?? []).filter(clinic => clinic.id != null).map(clinic => ({ id: clinic.id!, name: clinic.name }))
      }
      if (response.error) throw new Error(response.error)
      return response.data ?? []
    },
  })
  return { value, defaultValue, clinicId, companyId, clinics: clinics.data ?? [],
    setValue: (value: string) => setSelection({ companyId, currentClinicId: currentClinic?.id, value }) }
}
