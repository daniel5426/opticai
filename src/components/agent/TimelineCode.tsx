import React from 'react';
import { Check, Copy } from 'lucide-react';
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockDownloadButton, CodeBlockHeader, CodeBlockLine, CodeBlockTitle, CodeBlockWrapButton, useHighlightedCode } from '@agents24/chat-react/ui';
import { useTimelineLabels } from './timeline-labels';
import { reportLayout, searchLayout } from './report-message-results';

export const ChatReportResults = React.createContext<ReadonlyArray<Record<string, unknown>>>([]);
export const ChatSearchReceipts = React.createContext<ReadonlyArray<Record<string, unknown>>>([]);
const ChatReportVisuals = React.lazy(() => import('./AgentDataResults').then(module => ({ default: module.ChatReportVisuals })));
const ChatSearchResults = React.lazy(() => import('./AgentDataResults').then(module => ({ default: module.ChatSearchResults })));

function metadata(code: string): unknown {
  if (code.length > 8192) return null;
  try { return JSON.parse(code); } catch { return null; }
}

function TimelineReportVisuals({ code }: { code: string }) {
  const reports = React.useContext(ChatReportResults);
  const request = reportLayout.safeParse(metadata(code));
  if (!request.success) return null;
  const result = reports.find(report => report.job_id === request.data.job_id && report.type !== 'legacy_report');
  return result ? <React.Suspense fallback={null}><ChatReportVisuals output={result} views={request.data.views} /></React.Suspense> : null;
}

function TimelineSearchResults({ code }: { code: string }) {
  const receipts = React.useContext(ChatSearchReceipts);
  const request = searchLayout.safeParse(metadata(code));
  if (!request.success) return null;
  const result = receipts.find(receipt => receipt.result_ref === request.data.result_ref);
  return result ? <React.Suspense fallback={null}><ChatSearchResults output={result} layout={request.data} /></React.Suspense> : null;
}

export function TimelineCode({ children, className, node, ...props }: React.ComponentProps<'code'> & { node?: { position?: { start?: { line?: number }; end?: { line?: number } } }; 'data-block'?: unknown }) {
  const language = className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  if (language === 'prysm-report') return <TimelineReportVisuals code={typeof children === 'string' ? children : ''} />;
  if (language === 'prysm-results') return <TimelineSearchResults code={typeof children === 'string' ? children : ''} />;
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
