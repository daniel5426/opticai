import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultVoiceShortcut, readVoiceShortcut, shortcutFromEvent, validVoiceShortcut, voicePreferenceKey } from '@/lib/agent-voice-preferences';
export function AgentVoicePreferences() {
  const { currentUser } = useUser(); const { t } = useTranslation();
  const [value, setValue] = React.useState(() => readVoiceShortcut(currentUser?.id));
  const [error, setError] = React.useState(false);
  React.useEffect(() => setValue(readVoiceShortcut(currentUser?.id)), [currentUser?.id]);
  const save = (next: string) => {
    if (!validVoiceShortcut(next)) { setError(true); return; }
    try { localStorage.setItem(voicePreferenceKey(currentUser?.id), next); setValue(next); setError(false); window.dispatchEvent(new Event('agent-voice-preference')); } catch { setError(true); }
  };
  return <Card><CardHeader><CardTitle>{t('agent.voice.settings')}</CardTitle></CardHeader><CardContent className="space-y-3">
    <Label htmlFor="agent-voice-shortcut">{t('agent.voice.shortcut')}</Label>
    <Input id="agent-voice-shortcut" dir="ltr" readOnly value={value || t('agent.voice.disabled')} onKeyDown={event => {
      event.stopPropagation(); if (event.key === 'Tab') return;
      event.preventDefault(); if (['Shift', 'Control', 'Meta', 'Alt'].includes(event.key)) return;
      save(shortcutFromEvent(event.nativeEvent));
    }} />
    <p className="text-sm text-muted-foreground">{t('agent.voice.shortcutHint')}</p>
    {error && <p role="alert">{t('agent.voice.invalidShortcut')}</p>}
    <div className="flex gap-2"><Button variant="outline" onClick={() => save(defaultVoiceShortcut)}>{t('agent.voice.reset')}</Button><Button variant="ghost" onClick={() => save('')}>{t('agent.voice.disable')}</Button></div>
  </CardContent></Card>;
}
