import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { WorkspaceSidePanel } from '@/components/ui/workspace-side-panel';
import { AgentChatPanel } from './AgentChatPanel';
import { AgentVoiceCapture } from './AgentVoice';
export function GlobalAgentPanel() {
  const agent = usePrysmAgent(); const { pathname } = useLocation(); const { t } = useTranslation();
  const sidebarHost = React.useRef<HTMLDivElement>(null);
  // A stable portal container preserves composer files/drafts while its DOM host moves.
  const [surface] = React.useState(() => {const node = document.createElement('div'); node.className = 'flex h-full min-h-0 flex-1 flex-col'; return node;});
  React.useLayoutEffect(() => {
    const host = pathname === '/ai-assistant' ? agent?.fullPageHost : sidebarHost.current;
    host?.appendChild(surface);
    return () => {surface.remove();};
  }, [pathname, agent?.available, agent?.fullPageHost, surface]);
  return <>
    <AgentVoiceCapture />
    <WorkspaceSidePanel open={Boolean(agent?.chatOpen && pathname !== '/ai-assistant')} onClose={() => agent?.closePatientChat()} storageKey="prysm-agent-panel-width" resizeLabel={t('agent.resizePanel')}>
      <div ref={sidebarHost} className="flex h-full min-h-0 flex-col" />
    </WorkspaceSidePanel>
    {agent?.available && createPortal(<AgentChatPanel compact={pathname !== '/ai-assistant'} />, surface)}
  </>;
}
