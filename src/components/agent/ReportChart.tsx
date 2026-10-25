import React from 'react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/localization/use-app-locale';

export type ReportChartData = { kind: 'bar' | 'line' | 'area' | 'pie' | 'donut'; title?: string; x: string;
  series: string[]; rows: Record<string, unknown>[]; currency?: string | null; truncated?: boolean; unavailable?: boolean };
const color = (index: number) => `hsl(var(--chart-${index % 5 + 1}))`;

export function ReportChart({ chart, label }: { chart: ReportChartData; label: (column: string) => string }) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const circular = chart.kind === 'pie' || chart.kind === 'donut';
  const slices = chart.rows.map(row => ({ name: String(row[chart.x] ?? '—'), value: row[chart.series[0]] }));
  const validSlices = slices.every(row => typeof row.value === 'number' && Number.isFinite(row.value) && row.value >= 0);
  const total = slices.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0);
  const tooltip = { contentStyle: { direction, background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 12 },
    formatter: (value: unknown) => typeof value === 'number' ? number(value) : String(value ?? '—') };
  const title = chart.title || chart.series.map(label).join(' · ');
  return <figure className="min-w-0 rounded-xl bg-card p-3 shadow-sm" aria-label={title} data-report-chart={chart.kind}>
    <figcaption className="mb-3 flex flex-wrap gap-2 text-xs font-medium"><span>{title}</span>{chart.currency && <bdi className="text-muted-foreground">{chart.currency}</bdi>}</figcaption>
    {chart.unavailable || circular && (!validSlices || total <= 0 || chart.series.length !== 1) ? <p role="status" className="py-8 text-center text-xs text-muted-foreground">{t(chart.unavailable ? 'agent.data.chartUnavailable' : 'agent.data.distributionUnavailable')}</p> : <div className="h-64" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">{circular ? <PieChart accessibilityLayer>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={chart.kind === 'donut' ? '58%' : 0} outerRadius="80%" stroke="hsl(var(--card))" paddingAngle={2} isAnimationActive={false}>
          {slices.map((_, index) => <Cell key={index} fill={color(index)} />)}
        </Pie>
        {chart.kind === 'donut' && <text x="50%" y="44%" textAnchor="middle" fill="hsl(var(--foreground))" pointerEvents="none">
          <tspan x="50%" className="text-lg font-medium">{number(total)}</tspan><tspan x="50%" dy="20" className="text-xs">{t(chart.truncated ? 'agent.data.displayedTotal' : 'agent.column.total')}</tspan>
        </text>}
        <Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart> : <ComposedChart data={chart.rows} accessibilityLayer>
        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={row => row[chart.x]} reversed={direction === 'rtl'} tick={{ fontSize: 11 }} />
        <YAxis orientation={direction === 'rtl' ? 'right' : 'left'} tick={{ fontSize: 11 }} tickFormatter={number} />
        <Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
        {chart.series.map((key, index) => chart.kind === 'line'
          ? <Line key={key} dataKey={row => row[key]} name={label(key)} stroke={color(index)} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          : chart.kind === 'area' ? <Area key={key} dataKey={row => row[key]} name={label(key)} stroke={color(index)} fill={color(index)} fillOpacity={0.15} isAnimationActive={false} />
            : <Bar key={key} dataKey={row => row[key]} name={label(key)} fill={color(index)} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
      </ComposedChart>}</ResponsiveContainer>
    </div>}
    {chart.truncated && <p className="mt-2 text-xs text-muted-foreground">{t('agent.data.chartLimited')}</p>}
    <table className="sr-only"><caption>{title}</caption><thead><tr><th>{label(chart.x)}</th>{chart.series.map(key => <th key={key}>{label(key)}</th>)}</tr></thead>
      <tbody>{chart.rows.map((row, index) => <tr key={index}><th>{String(row[chart.x] ?? '—')}</th>{chart.series.map(key => <td key={key}>{typeof row[key] === 'number' ? number(row[key] as number) : String(row[key] ?? '—')}</td>)}</tr>)}</tbody>
    </table>
  </figure>;
}
