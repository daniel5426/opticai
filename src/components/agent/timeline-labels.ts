import { useTranslation } from 'react-i18next';

export function useTimelineLabels() {
  const { t } = useTranslation();
  return {
    t,
    submissionLabels: {
      submitting: t('agent.submission.submitting'), checking: t('agent.submission.checking'),
      uncertain: t('agent.submission.uncertain'), retry: t('agent.submission.retry'),
      accepted: t('agent.submission.accepted'), approved: t('agent.submission.approved'), rejected: t('agent.submission.rejected'),
    },
  };
}
