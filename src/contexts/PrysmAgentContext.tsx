import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Agents24Provider } from '@agents24/react';
import { useAgentChatRuntime, type AgentChatRuntime } from '@agents24/chat-react/runtime';
import { useLocation, useParams } from '@tanstack/react-router';
import { createAgentClient, type AgentScope } from '@/services/agent-client';
import { useUser } from '@/contexts/UserContext';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { capturePageContext, setAgentPageContext } from '@/lib/agent-page-context';

type Workspace = { campaignPrompt: { key: number; text: string } | null; openCampaignDraft: (text: string) => void; consumeCampaignPrompt: (key: number) => void;  client: ReturnType<typeof createAgentClient> | null; available: boolean; pending: boolean; runtime: AgentChatRuntime | null; scope: AgentScope | null; chatOpen: boolean; chatVisible: boolean; expandChat: () => void;
  fullPageHost: HTMLDivElement | null; setFullPageHost: (host: HTMLDivElement | null) => void;
  jobActivityKey: number; resetJobActivity: () => void;
  openPatientChat: (patientId: number) => void; closePatientChat: () => void; openClinicChat: () => void; openChat: () => void; captureContext: typeof capturePageContext };
// Router-held components can survive a Vite update; keep their context shared.
const hot = (import.meta as ImportMeta & { hot?: { data?: Record<string, unknown> } }).hot;
const Context = (hot?.data?.prysmAgentContext as React.Context<Workspace | null> | undefined)
  ?? createContext<Workspace | null>(null);
if (hot?.data) hot.data.prysmAgentContext = Context;
export const usePrysmAgent = () => useContext(Context);

type SessionProps = { client: ReturnType<typeof createAgentClient>; scopeKey: string;
  publish: (key: string, runtime: AgentChatRuntime) => void };
function Controller({ client, scopeKey, publish }: SessionProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const runtime = useAgentChatRuntime({ client, activeThreadId: threadId, agent: { name: 'Prysm' },
    onActiveThreadIdChange: ({ threadId }) => setThreadId(threadId) });
  useEffect(() => { publish(scopeKey, runtime); }, [runtime, scopeKey, publish]);
  return null;
}
const Session = React.memo(function Session(props: SessionProps) {
  return <Agents24Provider client={props.client} createAbortController={() => new AbortController()}
    onHitlTiming={({ stage, durationMs }) => { if (import.meta.env.DEV) performance.measure(`agent.hitl.${stage}`, { start: performance.now() - durationMs, duration: durationMs }); }}>
    <Controller {...props} />
  </Agents24Provider>;
});

export function PrysmAgentProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, currentClinic } = useUser();
  const { resetPanelMode } = useClientSidebar();
  const { pathname } = useLocation();
  const params = useParams({ strict: false }) as { clientId?: string };
  const [chatOpen, setChatOpen] = useState(false);
  const [campaignPrompt, setCampaignPrompt] = useState<{key:number;text:string} | null>(null);
  const [fullPageHost, setFullPageHost] = useState<HTMLDivElement | null>(null);
  const [jobActivityKey, setJobActivityKey] = useState(0);
  const resetJobActivity = useCallback(() => setJobActivityKey(value => value + 1), []);
  // Page context is a per-message hint; it never partitions the conversation.
  setAgentPageContext({ path: pathname, recordIds: params });
  const [published, setPublished] = useState<{ key: string; runtime: AgentChatRuntime } | null>(null);
  const publish = useCallback((key: string, runtime: AgentChatRuntime) => setPublished({ key, runtime }), []);
  useEffect(() => { setChatOpen(false); setCampaignPrompt(null); }, [currentClinic?.id, currentUser?.id]);
  const effectivePatient = null;
  const scope = useMemo(() => currentClinic?.id && currentUser?.id ? {
    clinicId: currentClinic.id, patientId: effectivePatient, userId: currentUser.id,
  } : null, [currentClinic?.id, currentUser?.id, effectivePatient]);
  const client = useMemo(() => scope ? createAgentClient(scope) : null, [scope]);
  const scopeKey = scope ? `${scope.userId}:${scope.clinicId}:${scope.patientId || 0}` : '';
  const runtime = published?.key === scopeKey ? published.runtime : null;
  const available = !!scope && !['denied', 'expired'].includes(runtime?.state || '');
  const pending = !!scope && (!runtime || runtime.isBootstrapping);
  const pageEntry = useRef<string | null>(null);
  const preservePageChat = useRef(false);
  useEffect(() => {
    if (pathname !== '/ai-assistant') { pageEntry.current = null; return; }
    if (!runtime || runtime.isBootstrapping || pageEntry.current === scopeKey) return;
    pageEntry.current = scopeKey;
    if (preservePageChat.current) preservePageChat.current = false;
    else { runtime.newThread(); resetJobActivity(); }
  }, [pathname, scopeKey, runtime, resetJobActivity]);
  const value: Workspace = { campaignPrompt,
    openCampaignDraft: text => { if (runtime?.controller.activeRunId) return; setCampaignPrompt({key:Date.now(),text}); resetPanelMode(); setChatOpen(true); },
    consumeCampaignPrompt: key => setCampaignPrompt(value => value?.key === key ? null : value), client, available, pending, scope, runtime, chatOpen: available && chatOpen, chatVisible: available && (chatOpen || pathname === '/ai-assistant'),
    expandChat: () => { preservePageChat.current = true; setChatOpen(false); }, fullPageHost, setFullPageHost, jobActivityKey, resetJobActivity,
    captureContext: capturePageContext, openChat: () => setChatOpen(true),
    openPatientChat: _id => { resetPanelMode(); setChatOpen(true); }, closePatientChat: () => setChatOpen(false),
    openClinicChat: () => { setChatOpen(true); } };
  // Only the SDK session is remounted on a scope change. Clinic editors remain mounted.
  return <Context.Provider value={value}>
    {client && <Session key={scopeKey} client={client} scopeKey={scopeKey} publish={publish} />}
    {children}
  </Context.Provider>;
}
