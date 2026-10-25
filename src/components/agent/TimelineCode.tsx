import React from 'react';
import { Check, Copy } from 'lucide-react';
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockDownloadButton, CodeBlockHeader, CodeBlockLine, CodeBlockTitle, CodeBlockWrapButton, useHighlightedCode } from '@agents24/chat-react/ui';
import { useTimelineLabels } from './timeline-labels';

export function TimelineCode({ children, className, node, ...props }: React.ComponentProps<'code'> & { node?: { position?: { start?: { line?: number }; end?: { line?: number } } }; 'data-block'?: unknown }) {
  const language = className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  const block = props['data-block'] !== undefined || language || (node?.position?.start?.line !== node?.position?.end?.line);
  return block ? <TimelineCodeBlock code={typeof children === 'string' ? children.replace(/\n$/, '') : ''} language={language} /> : <code {...props} className={className}>{children}</code>;
}
function TimelineCodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useTimelineLabels();
  const [wrap, setWrap] = React.useState(false);
  const [copied, setCopied] = React.useState<'copied' | 'copyFailed' | null>(null);
  const lines = useHighlightedCode(code, language || 'text');
  React.useEffect(() => { if (copied) { const timeout = setTimeout(() => setCopied(null), 2000); return () => clearTimeout(timeout); } }, [copied]);
  return <CodeBlock>
    <CodeBlockHeader><CodeBlockTitle>{language || t('agent.timeline.code.content')}</CodeBlockTitle><CodeBlockActions>
      <CodeBlockWrapButton wrap={wrap} onWrapChange={setWrap} aria-label={t(`agent.timeline.code.${wrap ? 'unwrap' : 'wrap'}`)} title={t(`agent.timeline.code.${wrap ? 'unwrap' : 'wrap'}`)} />
      <CodeBlockDownloadButton value={code} filename="prysm-code.txt" aria-label={t('agent.timeline.code.download')} title={t('agent.timeline.code.download')} />
      <button type="button" className="a24-code-block__action" aria-label={t(`agent.timeline.code.${copied === 'copied' ? 'copied' : 'copy'}`)} title={t('agent.timeline.code.copy')}
        onClick={() => { void Promise.resolve().then(() => navigator.clipboard.writeText(code)).then(() => setCopied('copied'), () => setCopied('copyFailed')); }}>
        {copied === 'copied' ? <Check aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? t(`agent.timeline.code.${copied}`) : ''}</span>
    </CodeBlockActions></CodeBlockHeader>
    <CodeBlockContent dir="ltr" aria-label={t('agent.timeline.code.content')} wrap={wrap} lineNumbers>{lines.map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)}</CodeBlockContent>
  </CodeBlock>;
}
