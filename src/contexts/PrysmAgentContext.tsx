import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Agents24Provider } from '@agents24/react';
import { useAgentChatRuntime, type AgentChatRuntime } from '@agents24/chat-react/runtime';
import { useLocation, useParams } from '@tanstack/react-router';
import { createAgentClient, type AgentScope } from '@/services/agent-client';
import { useUser } from '@/contexts/UserContext';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { useAgentStartupRecovery } from '@/services/use-agent-startup-recovery';
import { useQuery } from '@tanstack/react-query';
import { agentJson } from '@/services/agent-client';

type Workspace = { available: boolean; pending: boolean; runtime: AgentChatRuntime | null; scope: AgentScope | null; chatOpen: boolean;
  jobActivityKey: number; resetJobActivity: () => void;
  openPatientChat: (patientId: number) => void; closePatientChat: () => void; openClinicChat: () => void };
const Context = createContext<Workspace | null>(null);
export const usePrysmAgent = () => useContext(Context);

type SessionProps = { client: ReturnType<typeof createAgentClient>; scopeKey: string;
  publish: (key: string, runtime: AgentChatRuntime) => void };
function Controller({ client, scopeKey, publish }: SessionProps) {
  const storageKey = `prysm-agent-thread:${scopeKey}`;
  const [threadId, setThreadId] = useState<string | null>(() => localStorage.getItem(storageKey));
  const runtime = useAgentChatRuntime({ client, activeThreadId: threadId, agent: { name: 'Prysm' },
    onActiveThreadIdChange: ({ threadId }) => { setThreadId(threadId);
      if (threadId) localStorage.setItem(storageKey, threadId); else localStorage.removeItem(storageKey); } });
  const retryBootstrap = useAgentStartupRecovery(runtime);
  useEffect(() => { publish(scopeKey, { ...runtime, retryBootstrap }); }, [runtime, retryBootstrap, scopeKey, publish]);
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
  const { isClientSpacePage, resetPanelMode } = useClientSidebar();
  const { pathname } = useLocation();
  const params = useParams({ strict: false }) as { clientId?: string };
  const [chatOpen, setChatOpen] = useState(false);
  const [jobActivityKey, setJobActivityKey] = useState(0);
  const resetJobActivity = useCallback(() => setJobActivityKey(value => value + 1), []);
  const [patientState, setPatientState] = useState<{ owner: string; id: number | null } | null>(null);
  const owner = currentUser?.id && currentClinic?.id ? `${currentUser.id}:${currentClinic.id}` : '';
  const rememberPatient = useCallback((id: number | null) => {
    setPatientState({ owner, id });
    if (owner) localStorage.setItem(`prysm-agent-scope:${owner}`, String(id || 0));
  }, [owner]);
  const stored = Number(owner && localStorage.getItem(`prysm-agent-scope:${owner}`));
  const patientId = patientState?.owner === owner ? patientState.id
    : pathname === '/ai-assistant' && Number.isSafeInteger(stored) && stored > 0 ? stored : null;
  const [published, setPublished] = useState<{ key: string; runtime: AgentChatRuntime } | null>(null);
  const publish = useCallback((key: string, runtime: AgentChatRuntime) => setPublished({ key, runtime }), []);
  useEffect(() => {
    if (!isClientSpacePage) { setChatOpen(false); if (pathname !== '/ai-assistant') rememberPatient(null); }
  }, [isClientSpacePage, pathname, rememberPatient]);
  useEffect(() => { setChatOpen(false); }, [currentClinic?.id, currentUser?.id]);
  useEffect(() => {
    if (chatOpen && isClientSpacePage && params.clientId && patientId !== Number(params.clientId)) rememberPatient(Number(params.clientId));
  }, [chatOpen, isClientSpacePage, params.clientId, patientId, rememberPatient]);
  const effectivePatient = pathname === '/ai-assistant' ? null : chatOpen && isClientSpacePage && params.clientId ? Number(params.clientId) : patientId;
  const scope = useMemo(() => currentClinic?.id && currentUser?.id ? {
    clinicId: currentClinic.id, patientId: effectivePatient, userId: currentUser.id,
  } : null, [currentClinic?.id, currentUser?.id, effectivePatient]);
  const client = useMemo(() => scope ? createAgentClient(scope) : null, [scope]);
  const scopeKey = scope ? `${scope.userId}:${scope.clinicId}:${scope.patientId || 0}` : '';
  const availability = useQuery({ queryKey: ['agent-availability', scope?.userId, scope?.clinicId],
    queryFn: () => agentJson<{ available: boolean }>({ ...scope!, patientId: null }, '/availability', { signal: AbortSignal.timeout(3000) }),
    enabled: !!scope, retry: false, staleTime: 0, gcTime: 0, refetchInterval: 30_000 });
  const runtime = published?.key === scopeKey ? published.runtime : null;
  const connected = !!scope && availability.data?.available === true && !availability.isError;
  const available = connected && !!runtime?.bootstrap && !runtime.fatalError;
  const pending = !!scope && (availability.isPending || connected && (!runtime || runtime.isBootstrapping));
  useEffect(() => { if (!connected) { setChatOpen(false); setPublished(null); } }, [connected]);
  const value: Workspace = { available, pending, scope, runtime: connected ? runtime : null, chatOpen: available && chatOpen, jobActivityKey, resetJobActivity,
    openPatientChat: id => { resetPanelMode(); rememberPatient(id); setChatOpen(true); }, closePatientChat: () => setChatOpen(false),
    openClinicChat: () => { rememberPatient(null); setChatOpen(false); } };
  // Only the SDK session is remounted on a scope change. Clinic editors remain mounted.
  return <Context.Provider value={value}>
    {client && connected && <Session key={scopeKey} client={client} scopeKey={scopeKey} publish={publish} />}
    {children}
  </Context.Provider>;
}
