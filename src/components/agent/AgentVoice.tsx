import React from 'react';
import { Bot, Mic, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { readVoiceShortcut, shortcutFromEvent } from '@/lib/agent-voice-preferences';
import { capturePageContext, type AgentPageContext, withSubmissionContext } from '@/lib/agent-page-context';
import { agentJson } from '@/services/agent-client';
import { useAgentSubmission } from '@/services/agent-submission';

type Pending = { text: string; context: AgentPageContext; owner: string; threadId: string | null };
export function AgentEntryButtons() {
  const agent = usePrysmAgent(); const { t } = useTranslation();
  if (!agent?.available) return null;
  return <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.openAnywhere')} onClick={() => agent.chatOpen ? agent.closePatientChat() : agent.openChat()}><Bot className="size-4" /></Button>
    <Button variant="ghost" size="icon" className="size-7" aria-label={t('agent.voice.hold')} onPointerDown={event => {event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); window.dispatchEvent(new Event('agent-voice-start'));}}
      onPointerUp={() => window.dispatchEvent(new Event('agent-voice-stop'))} onPointerCancel={() => window.dispatchEvent(new Event('agent-voice-cancel'))}
      onClick={event => {if (event.detail === 0) window.dispatchEvent(new Event('agent-voice-toggle'));}}><Mic className="size-4" /></Button>
  </div>;
}
export function AgentVoiceCapture() {
  const workspace = usePrysmAgent(); const { currentUser } = useUser(); const { direction } = useAppLocale(); const { t } = useTranslation(); const submit = useAgentSubmission();
  const [state, setState] = React.useState<'idle'|'recording'|'processing'|'queued'|'failed'>('idle');
  const [pending, setPending] = React.useState<Pending | null>(null); const [shortcut, setShortcut] = React.useState(() => readVoiceShortcut(currentUser?.id));
  const retryRecording = React.useRef<(() => void) | null>(null);
  const [level, setLevel] = React.useState(0); const active = React.useRef(false); const generation = React.useRef(0);
  const recorder = React.useRef<MediaRecorder | null>(null); const stream = React.useRef<MediaStream | null>(null); const frame = React.useRef(0); const audio = React.useRef<AudioContext | null>(null); const limit = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const owner = `${workspace?.scope?.userId}:${workspace?.scope?.clinicId}`;
  const latest = React.useRef({workspace, submit, owner}); latest.current = {workspace, submit, owner};
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; cancelAnimationFrame(frame.current); void audio.current?.close().catch(() => undefined); audio.current = null; if (limit.current) clearTimeout(limit.current); };
  const cancel = React.useCallback(() => {generation.current++; active.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); release(); retryRecording.current = null; setPending(null); setState('idle');}, []);
  React.useEffect(() => { cancel(); setShortcut(readVoiceShortcut(currentUser?.id)); return cancel; }, [owner, currentUser?.id, cancel]);
  React.useEffect(() => {const update = () => setShortcut(readVoiceShortcut(currentUser?.id)); window.addEventListener('agent-voice-preference', update); return () => window.removeEventListener('agent-voice-preference', update);}, [currentUser?.id]);
  const stop = React.useCallback(() => { active.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); }, []);
  const start = React.useCallback(async () => {
    const session = latest.current.workspace;
    if (active.current || !session?.available || !session.scope || !session.runtime || state !== 'idle') return;
    active.current = true; const token = ++generation.current;
    const context = capturePageContext(); const capturedOwner = latest.current.owner; const threadId = session.runtime.controller.activeThreadId;
    const chunks: BlobPart[] = []; let heard = false;
    try {
      const input = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!active.current || token !== generation.current) {input.getTracks().forEach(track => track.stop()); return;}
      stream.current = input;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(input, mimeType ? {mimeType} : undefined); recorder.current = recording;
      const sound = new AudioContext(); audio.current = sound; const analyser = sound.createAnalyser(); analyser.fftSize = 256; sound.createMediaStreamSource(input).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const draw = () => {analyser.getByteTimeDomainData(samples); const volume = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length); if (volume > .012) heard = true; setLevel(Math.min(1, volume * 8)); frame.current = requestAnimationFrame(draw);}; draw();
      recording.ondataavailable = event => {if (event.data.size) chunks.push(event.data);};
      const processRecording = async () => {
        release(); if (token !== generation.current) return;
        if (!heard) {setState('idle'); return;}
        setState('processing'); session.openChat();
        try {
          const blob = new Blob(chunks, {type: recording.mimeType.split(';')[0]});
          const form = new FormData(); form.append('file', blob, `voice.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
          const job = await agentJson<{job_id: string}>(session.scope!, '/transcriptions', {method:'POST', body:form});
          let text = '';
          for (let attempt = 0; attempt < 180; attempt++) {
            if (token !== generation.current) return;
            const result = await agentJson<{status: string; text?: string}>(session.scope!, `/transcriptions/${job.job_id}`);
            if (result.status === 'failed' || result.status === 'cancelled') throw new Error('agent.voice.failed');
            if (result.status === 'completed') {text = result.text || ''; break;}
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          if (token !== generation.current) return;
          if (!text.trim()) throw new Error('agent.voice.failed');
          setPending({text, context, owner:capturedOwner, threadId}); setState('queued');
        } catch {if (token === generation.current) setState('failed');}
      };
      retryRecording.current = () => {void processRecording();};
      recording.onstop = () => {void processRecording();};
      recording.start(); setState('recording'); limit.current = setTimeout(stop, 120000);
    } catch {release(); active.current = false; if (token === generation.current) setState('failed');}
  }, [state, stop]);
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (state !== 'idle') {event.preventDefault(); cancel();} return; }
      if (!shortcut || event.repeat || event.isComposing || shortcutFromEvent(event) !== shortcut) return;
      event.preventDefault(); void start();
    };
    const up = (event: KeyboardEvent) => {if (active.current && (shortcut.split('+').includes(event.code) || ['Shift','Control','Alt','Meta'].includes(event.key))) {event.preventDefault(); stop();}};
    const blur = () => {if (active.current) cancel();};
    const begin = () => {void start();}; const toggle = () => active.current ? stop() : void start();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    window.addEventListener('agent-voice-start', begin); window.addEventListener('agent-voice-stop', stop); window.addEventListener('agent-voice-cancel', cancel); window.addEventListener('agent-voice-toggle', toggle);
    return () => {window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('agent-voice-start', begin); window.removeEventListener('agent-voice-stop', stop); window.removeEventListener('agent-voice-cancel', cancel); window.removeEventListener('agent-voice-toggle', toggle);};
  }, [shortcut, state, start, stop, cancel]);
  const sending = React.useRef(false);
  React.useEffect(() => {
    if (!pending || state !== 'queued' || sending.current || !workspace?.runtime || !workspace.available || workspace.runtime.controller.activeRunId || workspace.runtime.isSubmitting) return;
    if (pending.owner !== owner || pending.threadId !== workspace.runtime.controller.activeThreadId) {setState('failed'); return;}
    sending.current = true;
    void withSubmissionContext(pending.context, () => submit({text:pending.text})).then(() => {setPending(null); setState('idle');}, () => setState('failed')).finally(() => {sending.current = false;});
  }, [pending, state, workspace?.runtime, workspace?.runtime?.controller.activeRunId, workspace?.runtime?.controller.activeThreadId, workspace?.runtime?.isSubmitting, workspace?.available, owner, submit]);
  if (state === 'idle') return null;
  return <div dir={direction} className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg" role="status" aria-live="polite">
    {state === 'recording' && <div className="flex h-8 items-center gap-0.5" aria-hidden="true">{Array.from({length:16}, (_, i) => <span key={i} className="w-1 rounded-full bg-primary" style={{height: `${4 + level * (10 + (i % 5) * 5)}px`}} />)}</div>}
    <span className="max-w-sm truncate text-sm">{state === 'queued' ? pending?.text : t(`agent.voice.${state}`)}</span>
    {state === 'recording' && <Button size="icon" variant="ghost" aria-label={t('agent.voice.stop')} onClick={stop}><Square className="size-4" /></Button>}
    {state === 'failed' && (pending || retryRecording.current) && <Button variant="outline" size="sm" onClick={() => pending ? setState('queued') : retryRecording.current?.()}>{t('agent.voice.retry')}</Button>}
    <Button size="icon" variant="ghost" aria-label={t('agent.voice.cancel')} onClick={cancel}><X className="size-4" /></Button>
  </div>;
}
