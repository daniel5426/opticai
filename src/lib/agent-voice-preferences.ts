export const defaultVoiceShortcut = 'Shift+Space';
export function voicePreferenceKey(userId?: number) { return `prysm-agent-voice:${userId || 0}`; }
export function readVoiceShortcut(userId?: number) {
  try { return localStorage.getItem(voicePreferenceKey(userId)) ?? defaultVoiceShortcut; } catch { return defaultVoiceShortcut; }
}
export function shortcutFromEvent(event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>) {
  return [event.ctrlKey && 'Control', event.altKey && 'Alt', event.metaKey && 'Meta', event.shiftKey && 'Shift', event.code].filter(Boolean).join('+');
}
export function validVoiceShortcut(value: string) {
  if (value === '') return true;
  return /^(?:(?:Control|Alt|Meta|Shift)\+)+(?:Space|Key[A-Z]|Digit[0-9])$/.test(value) && !['Control+KeyS', 'Meta+KeyS', 'Control+KeyB', 'Meta+KeyB', 'Meta+Space', 'Control+Space'].includes(value);
}
