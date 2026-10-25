import React from 'react';
import { Link } from '@tanstack/react-router';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { downloadAgentReport } from '@/services/agent-client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function AgentLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const workspace = usePrysmAgent();
  const { t } = useTranslation();
  if (href && (/^\/api\/v1\/agent\/jobs\/[a-f0-9-]{36}\/(download|original)$/.test(href) || /^\/api\/v1\/agent\/reports\/[a-f0-9-]{36}\/export\?format=(xlsx|csv)$/.test(href))) {
    return <button className="text-primary underline underline-offset-4" onClick={() => {
      if (workspace?.scope) void downloadAgentReport(workspace.scope, href).catch(() => toast.error(t('agent.downloadUnavailable')));
    }}>{children}</button>;
  }
  if (href && (/^\/clients\/\d+(?:\/(exams|orders|referrals)\/\d+)?(?:\?tab=(details|exams|orders|referrals|medical|appointments|files))?$/.test(href) || /^\/(inventory|families)$/.test(href))) {
    return <Link to={href as never} className="text-primary underline underline-offset-4">{children}</Link>;
  }
  return <span>{children}</span>;
}
