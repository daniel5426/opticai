import type { Clinic } from "@/lib/db/schema-interface"

type ClinicId = number | string | null | undefined

type ClinicNames = {
  clinicId: ClinicId
  clinicName?: string | null
  legacyName?: string | null
  clinics: readonly { id: number | string; name: string }[]
  currentClinic: Pick<Clinic, "id" | "name" | "clinic_name"> | null
}

export function resolveRecordClinicName({ clinicId, clinicName, legacyName, clinics, currentClinic }: ClinicNames): string | undefined {
  if (clinicName?.trim()) return clinicName.trim()
  if (clinicId == null) return legacyName?.trim() || undefined
  const matches = (id: ClinicId) => id != null && Number(id) === Number(clinicId)
  const name = clinics.find(clinic => matches(clinic.id))?.name?.trim()
  if (name) return name
  if (currentClinic && matches(currentClinic.id)) return currentClinic.name?.trim() || currentClinic.clinic_name?.trim() || undefined
  return undefined
}
