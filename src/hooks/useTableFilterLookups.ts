import { useQuery } from '@tanstack/react-query';
import { useCompanyClinicFilter } from '@/hooks/client/useCompanyClinicFilter';
import { useUser } from '@/contexts/UserContext';
import { getAllUsers } from '@/lib/db/users-db';
import { lookupTables } from '@/lib/db/lookup-db';
import type { ColumnFilterDefinition } from '@/lib/column-filters';
import { useTranslation } from 'react-i18next';

export function useTableFilterLookups(definitions: readonly ColumnFilterDefinition<any>[]) {
  const { t } = useTranslation();
  const { currentClinic } = useUser();
  const { clinics, companyId } = useCompanyClinicFilter(true);
  const users = useQuery({
    queryKey: ['column-filter-users', companyId],
    enabled: Boolean(companyId) && definitions.some(definition => definition.key === 'examiner'),
    staleTime: 60_000,
    queryFn: () => getAllUsers(undefined, true),
  });
  const referralTypes = useQuery({
    queryKey: ['lookup', currentClinic?.id, 'referralType'],
    enabled: Boolean(currentClinic?.id) && definitions.some(definition => definition.key === 'type' && definition.kind === 'text'),
    queryFn: () => lookupTables.referralType.getAll(currentClinic!.id!),
  });
  return definitions.map(definition => {
    if (definition.key === 'clinic') return { ...definition, label: t('companyClients.clinic'), kind: 'options' as const, options: [
      ...clinics.map(clinic => ({ value: String(clinic.id), label: clinic.name })),
      { value: '__none__', label: t('columnFilters.noClinic') },
    ] };
    if (definition.key === 'examiner') return { ...definition, kind: 'options' as const, options: (users.data ?? []).map(user => ({value: String(user.id), label: user.full_name || user.username || String(user.id)})) };
    if (definition.key === 'type' && definition.kind === 'text') return { ...definition, kind: 'options' as const, options: (referralTypes.data ?? []).map(item => ({value: item.name, label: item.name})) };
    return definition;
  });
}
