import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { TableFilterSelect, TableFiltersContext, type TableFiltersBarSelect } from "@/components/table-filters-bar"
import type { useCompanyClinicFilter } from "@/hooks/client/useCompanyClinicFilter"

type Props = { filter: ReturnType<typeof useCompanyClinicFilter>; allClients?: boolean }

export function useCompanyClinicSelect({ filter, allClients = false }: Props): TableFiltersBarSelect {
  const { t } = useTranslation()
  return {
    key: "clinic",
    value: filter.value,
    onChange: filter.setValue,
    placeholder: t("companyClients.clinicFilter"),
    options: [
      { value: "current", label: t("companyClients.currentClinic") },
      { value: "all", label: t(allClients ? "companyClients.allClients" : "companyClients.allClinics") },
      ...filter.clinics.map(clinic => ({ value: String(clinic.id), label: clinic.name })),
    ],
    widthClassName: "w-[180px]",
  }
}

export function CompanyClinicFilter(props: Props) {
  return <TableFilterSelect filter={useCompanyClinicSelect(props)} />
}

export function CompanyClinicToolbarProvider({ children, ...props }: Props & { children: ReactNode }) {
  const select = useCompanyClinicSelect(props)
  return <TableFiltersContext.Provider value={[select]}>{children}</TableFiltersContext.Provider>
}
