import React from 'react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '@/components/site-header';
import { AgentChatPanel } from '@/components/agent/AgentChatPanel';
import { AgentChatActions } from '@/components/agent/AgentChatActions';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { Navigate } from '@tanstack/react-router';

export function AIAssistantPage() {
  const { t } = useTranslation();
  const agent = usePrysmAgent();
  if (!agent?.available) return agent?.pending ? null : <Navigate to="/dashboard" replace />;
  return <div className="flex h-full min-h-0 flex-col">
    <SiteHeader title={t('smartAssistant')} actions={<AgentChatActions />} />
    <AgentChatPanel />
  </div>;
}
