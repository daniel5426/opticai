import { useCallback } from "react"
import { useUser } from "@/contexts/UserContext"
import { useCompanyClinicFilter } from "@/hooks/client/useCompanyClinicFilter"
import { resolveRecordClinicName } from "@/lib/record-clinic"
import { useTranslation } from "react-i18next"

export function useRecordClinicName() {
  const { clinics } = useCompanyClinicFilter(true)
  const { currentClinic } = useUser()
  const { t } = useTranslation()
  return useCallback((clinicId?: number | string | null, clinicName?: string | null, legacyName?: string | null) => {
    const name = resolveRecordClinicName({ clinicId, clinicName, legacyName, clinics, currentClinic })
    return name || (clinicId != null ? t("companyClients.clinicNumber", { id: clinicId }) : undefined)
  }, [clinics, currentClinic, t])
}

export function RecordClinicLabel({ clinicId }: { clinicId?: number | null }) {
  const resolveName = useRecordClinicName()
  const { t } = useTranslation()
  const name = resolveName(clinicId)
  if (!name) return null
  return <span className="block text-xs font-normal text-muted-foreground">{t("companyClients.clinic")}: {name}</span>
}
