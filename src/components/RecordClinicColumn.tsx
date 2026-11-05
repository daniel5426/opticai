import { useTranslation } from 'react-i18next';
import { TableCell, TableHead } from '@/components/ui/table';
import { FilterableHeaderLabel } from '@/components/column-filter';
import { useRecordClinicName } from '@/components/RecordClinicLabel';

export function ClinicTableHead() {
  const { t } = useTranslation();
  return <TableHead className="text-start"><FilterableHeaderLabel filterKey="clinic">{t('companyClients.clinic')}</FilterableHeaderLabel></TableHead>;
}
export function ClinicTableCell({ clinicId }: { clinicId?: number | null }) {
  const resolveName = useRecordClinicName();
  return <TableCell className="text-start" data-no-localize>{resolveName(clinicId) || ''}</TableCell>;
}
