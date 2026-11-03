import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { createAgentClient } from '@/services/agent-client';
import type { ThreadMessage, ThreadSummary } from '@agents24/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function PatientThreadArchive() {
  const workspace = usePrysmAgent(); const { t } = useTranslation();
  const [patient, setPatient] = React.useState(''); const [threads, setThreads] = React.useState<ThreadSummary[]>([]); const [messages, setMessages] = React.useState<readonly ThreadMessage[]>([]); const [error, setError] = React.useState(false);
  const client = React.useMemo(() => workspace?.scope && Number(patient) > 0 ? createAgentClient({...workspace.scope, patientId:Number(patient)}) : null, [workspace?.scope, patient]);
  const load = async () => {if (!client) return; try {setThreads((await client.threads.list({limit:100})).items); setMessages([]); setError(false);} catch {setError(true);}};
  return <details className="mb-3 rounded-md border p-3"><summary className="cursor-pointer text-sm">{t('agent.patientArchive')}</summary>
    <div className="mt-3 space-y-2"><Label htmlFor="archived-agent-client">{t('agent.archiveClient')}</Label><Input id="archived-agent-client" dir="ltr" inputMode="numeric" value={patient} onChange={event => {setPatient(event.target.value); setThreads([]); setMessages([]);}} /><Button variant="outline" size="sm" onClick={() => void load()}>{t('agent.archiveLoad')}</Button>
      {error && <p role="alert">{t('agent.operationFailed')}</p>}
      {threads.map(thread => <Button key={thread.id} variant="ghost" size="sm" onClick={async () => {try {const result = await client!.threads.messages.list({threadId:thread.id, limit:100}); setMessages(result.items); setError(false);} catch {setError(true);}}}>{thread.title || t('agent.newChat')}</Button>)}
      {messages.map(message => <p key={message.id} className="whitespace-pre-wrap break-words text-sm">{message.text}</p>)}
    </div>
  </details>;
}
