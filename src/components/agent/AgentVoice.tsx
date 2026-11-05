import React from 'react';
import { ArrowUp, Bot, Loader2, Mic, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LiveWaveform } from '@/components/ui/live-waveform';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { readVoiceShortcut, shortcutFromEvent } from '@/lib/agent-voice-preferences';
import { capturePageContext, type AgentPageContext, withSubmissionContext } from '@/lib/agent-page-context';
import { useAgentSubmission } from '@/services/agent-submission';

type Pending = { newChat: boolean; file: File; context: AgentPageContext; owner: string; threadId: string | null };
export function AgentEntryButtons() {
  const agent = usePrysmAgent(); const { t } = useTranslation();
  if (!agent?.available) return null;
  const connecting = agent.pending || !agent.runtime || agent.runtime.isBootstrapping || agent.runtime.controller.isLoadingHistory;
  return <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.openAnywhere')} onClick={() => agent.chatOpen ? agent.closePatientChat() : agent.openChat()}><Bot className="size-4" /></Button>
    <Button variant="ghost" size="icon" className="size-7" disabled={connecting} title={t(connecting ? 'agent.starting' : 'agent.voice.start')} aria-label={t('agent.voice.start')} onClick={() => window.dispatchEvent(new Event('agent-voice-toggle'))}><Mic className="size-4" /></Button>
  </div>;
}
export function AgentVoiceCapture() {
  const workspace = usePrysmAgent(); const { currentUser } = useUser(); const { direction } = useAppLocale(); const { t } = useTranslation(); const submit = useAgentSubmission();
  const [state, setState] = React.useState<'idle'|'starting'|'recording'|'ready'|'queued'|'selecting'|'failed'>('idle');
  const [pending, setPending] = React.useState<Pending | null>(null); const [shortcut, setShortcut] = React.useState(() => readVoiceShortcut(currentUser?.id));
  const sending = React.useRef(false);
  const active = React.useRef(false); const generation = React.useRef(0);
  const sendRequested = React.useRef(false); const sendNewChat = React.useRef(false); const holdShortcut = React.useRef(false);
  const recorder = React.useRef<MediaRecorder | null>(null); const stream = React.useRef<MediaStream | null>(null); const frame = React.useRef(0); const audio = React.useRef<AudioContext | null>(null); const limit = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const owner = `${workspace?.scope?.userId}:${workspace?.scope?.clinicId}`;
  const latest = React.useRef({workspace, submit, owner}); latest.current = {workspace, submit, owner};
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; cancelAnimationFrame(frame.current); void audio.current?.close().catch(() => undefined); audio.current = null; if (limit.current) clearTimeout(limit.current); };
  const cancel = React.useCallback(() => {generation.current++; active.current = false; sending.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); release(); setPending(null); setState('idle');}, []);
  React.useEffect(() => { cancel(); setShortcut(readVoiceShortcut(currentUser?.id)); return cancel; }, [owner, currentUser?.id, cancel]);
  React.useEffect(() => {const update = () => setShortcut(readVoiceShortcut(currentUser?.id)); window.addEventListener('agent-voice-preference', update); return () => window.removeEventListener('agent-voice-preference', update);}, [currentUser?.id]);
  const stop = React.useCallback(() => { active.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); else setState('idle'); }, []);
  const send = React.useCallback(() => {
    sendRequested.current = true; sendNewChat.current = !latest.current.workspace?.chatVisible;
    latest.current.workspace?.openChat();
    if (active.current) stop();
    else if (pending) { setPending({...pending, newChat:sendNewChat.current}); setState('queued'); }
  }, [pending, stop]);
  const start = React.useCallback(async (hold = false) => {
    const session = latest.current.workspace;
    if (active.current || !session?.available || session.pending || !session.scope || !session.runtime || session.runtime.isBootstrapping || session.runtime.controller.isLoadingHistory || state !== 'idle') return;
    active.current = true; sendRequested.current = false; holdShortcut.current = hold;
    setState('starting'); const token = ++generation.current;
    const context = capturePageContext(); const capturedOwner = latest.current.owner; const threadId = session.runtime.controller.activeThreadId;
    const chunks: BlobPart[] = []; let heard = false;
    try {
      const input = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!active.current || token !== generation.current) {input.getTracks().forEach(track => track.stop()); return;}
      stream.current = input;
      const mimeType = ['audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(input, mimeType ? {mimeType} : undefined); recorder.current = recording;
      const sound = new AudioContext(); audio.current = sound; const analyser = sound.createAnalyser(); analyser.fftSize = 256; sound.createMediaStreamSource(input).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const draw = () => {analyser.getByteTimeDomainData(samples); const volume = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length); if (volume > .012) heard = true; frame.current = requestAnimationFrame(draw);}; draw();
      recording.ondataavailable = event => {if (event.data.size) chunks.push(event.data);};
      recording.onstop = () => {
        if (token !== generation.current) return; release();
        if (!heard) {setState('idle'); return;}
        const type = recording.mimeType.split(';')[0];
        const file = new File(chunks, `voice.${type.includes('mp4') ? 'm4a' : 'webm'}`, {type});
        setPending({newChat:sendNewChat.current, file, context, owner:capturedOwner, threadId}); setState(sendRequested.current ? 'queued' : 'ready');
      };
      recording.start(); setState('recording'); limit.current = setTimeout(stop, 120000);
    } catch {if (token !== generation.current) return; release(); active.current = false; setState('failed');}
  }, [state, stop]);
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (state !== 'idle') {event.preventDefault(); cancel();} return; }
      if (event.key === 'Enter' && !event.isComposing && !event.repeat && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && (state === 'recording' || state === 'ready')) {
        event.preventDefault(); event.stopPropagation(); send(); return;
      }
      if (!shortcut || event.repeat || event.isComposing || shortcutFromEvent(event) !== shortcut) return;
      event.preventDefault(); void start(true);
    };
    const up = (event: KeyboardEvent) => {if (active.current && holdShortcut.current && (shortcut.split('+').includes(event.code) || ['Shift','Control','Alt','Meta'].includes(event.key))) {event.preventDefault(); send();}};
    const blur = () => {if (active.current && holdShortcut.current) cancel();};
    const begin = () => {void start();}; const toggle = () => active.current ? stop() : void start();
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    window.addEventListener('agent-voice-start', begin); window.addEventListener('agent-voice-stop', stop); window.addEventListener('agent-voice-cancel', cancel); window.addEventListener('agent-voice-toggle', toggle);
    return () => {window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('agent-voice-start', begin); window.removeEventListener('agent-voice-stop', stop); window.removeEventListener('agent-voice-cancel', cancel); window.removeEventListener('agent-voice-toggle', toggle);};
  }, [shortcut, state, start, stop, send, cancel]);
  React.useEffect(() => {
    if (!pending || !workspace?.runtime || !workspace.available) return;
    if (pending.owner !== owner) {setState('failed'); return;}
    if (state === 'selecting') {
      if (workspace.runtime.controller.activeThreadId !== null || workspace.runtime.controller.isLoadingHistory) return;
      sending.current = false; setState('queued'); return;
    }
    if (state !== 'queued' || sending.current) return;
    if (pending.newChat) {
      sending.current = true;
      workspace.runtime.newThread(); workspace.resetJobActivity();
      setPending({...pending, newChat:false, threadId:null}); setState('selecting'); return;
    }
    if (workspace.runtime.controller.activeRunId || workspace.runtime.isSubmitting) return;
    if (pending.threadId !== workspace.runtime.controller.activeThreadId) {setState('failed'); return;}
    sending.current = true;
    void withSubmissionContext(pending.context, () => submit({text:'', files:[{name:pending.file.name, mediaType:pending.file.type, data:pending.file}]})).then(() => {setPending(null); setState('idle');}, () => setState('failed')).finally(() => {sending.current = false;});
  }, [pending, state, workspace?.runtime, workspace?.runtime?.controller.activeRunId, workspace?.runtime?.controller.activeThreadId, workspace?.runtime?.isSubmitting, workspace?.available, owner, submit]);
  if (state === 'idle') return null;
  return <div dir={direction} style={{flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'}} className="agent-voice-capture fixed bottom-6 left-1/2 z-50 flex w-[min(28rem,90vw)] -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-3 shadow-floating" role="region" aria-label={t('agent.voice.message')}>
    {['recording', 'ready'].includes(state) && <button type="button" className="a24-composer__submit rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={t('agent.voice.send')} title={t('agent.voice.send')} onClick={send}><ArrowUp className="size-4" strokeWidth={2.5} /></button>}
    {state === 'recording' && <div className="min-w-0 flex-1 text-primary" aria-hidden="true"><LiveWaveform active mediaStream={stream.current} height={40} barWidth={3} barGap={2} barRadius={2} fadeWidth={16} sensitivity={1.6} mode="static" /></div>}
    {['starting', 'queued', 'selecting'].includes(state) && <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    <span role="status" aria-live="polite" className={state === 'recording' ? 'sr-only' : 'min-w-0 flex-1 truncate text-sm'}>{state === 'recording' && holdShortcut.current ? t('agent.voice.holdRecording') : t(`agent.voice.${state === 'selecting' ? 'queued' : state}`)}</span>
    {state === 'failed' && pending && <Button variant="outline" size="sm" onClick={() => setState('queued')}>{t('agent.voice.retry')}</Button>}
    <Button size="icon" variant="ghost" className="rounded-full" aria-label={t('agent.voice.cancel')} onClick={cancel}><X className="size-4" /></Button>
  </div>;
}
