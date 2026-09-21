'use client';

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { Download, Maximize2, RotateCcw, X } from 'lucide-react';

// ApexCharts (line, donut, radial gauges)
import ApexCharts from 'apexcharts';
import type { ApexOptions, ApexFormatterOpts } from 'apexcharts';

// ECharts (bar, funnel, hbar list, forecast, combo, heatmap, radar) — treeshaken entry points
import * as echarts from 'echarts/core';
import {
  BarChart as EBarChart,
  LineChart as ELineChart,
  FunnelChart as EFunnelChart,
  HeatmapChart as EHeatmapChart,
  RadarChart as ERadarChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
  RadarComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type {
  BarSeriesOption,
  LineSeriesOption,
  FunnelSeriesOption,
  HeatmapSeriesOption,
  RadarSeriesOption,
} from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  VisualMapComponentOption,
  RadarComponentOption,
  DataZoomComponentOption,
} from 'echarts/components';

echarts.use([
  EBarChart,
  ELineChart,
  EFunnelChart,
  EHeatmapChart,
  ERadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
  RadarComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | FunnelSeriesOption
  | HeatmapSeriesOption
  | RadarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | VisualMapComponentOption
  | RadarComponentOption
  | DataZoomComponentOption
>;

export interface ChartDatum {
  label: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6'];

/** Compact axis labels: 12345 → 12.3k, 1234567 → 1.2M */
const compactNum = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

/**
 * Resolve a Tailwind `bg-<color>-<shade>` class (or raw hex) to a usable
 * color string. Tailwind v4 exposes its palette as `--color-*` CSS variables
 * (oklch), which canvas-based charts accept natively.
 */
const resolveColor = (color?: string, fallback = '#6366f1'): string => {
  if (!color) return fallback;
  if (color.startsWith('#')) return color;
  const m = color.match(/^bg-([a-z]+)-(\d+)$/);
  if (!m) return fallback;
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${m[1]}-${m[2]}`)
    .trim();
  return v || fallback;
};

const truncate = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ---------------------------------------------------------------------------
// Interaction helpers (toolbar, expand overlay, exports, count-up)
// ---------------------------------------------------------------------------

/** Save a data-URL or raw binary string as a file download. */
const downloadDataUrl = (filename: string, dataUrl: string) => {
  if (typeof document === 'undefined' || !dataUrl) return;
  const a = document.createElement('a');
  a.download = filename;
  if (dataUrl.startsWith('data:')) {
    a.href = dataUrl;
    a.click();
    return;
  }
  const blob = new Blob([dataUrl], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
};

const expandedChartHeight = () =>
  (typeof window !== 'undefined' ? window.innerHeight : 720) - 150;

/** Height used for fullscreen (expanded) chart overlays. */
const bigHeight = () => Math.max(340, Math.min(560, expandedChartHeight()));

/** Small hover-revealed toolbar attached to the corner of interactive charts. */
function ChartToolbar({
  onDownload,
  onExpand,
  onResetZoom,
}: {
  onDownload?: () => void;
  onExpand?: () => void;
  onResetZoom?: () => void;
}) {
  const btn =
    'flex h-6 w-6 items-center justify-center rounded-md bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200';
  return (
    <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/chart:opacity-100">
      {onResetZoom && (
        <button onClick={onResetZoom} title="Reset zoom" className={btn}>
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {onDownload && (
        <button onClick={onDownload} title="Download PNG" className={btn}>
          <Download className="h-3 w-3" />
        </button>
      )}
      {onExpand && (
        <button onClick={onExpand} title="Expand to fullscreen" className={btn}>
          <Maximize2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Fullscreen overlay that re-renders the chart at a larger size. */
function ExpandOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-gray-100 dark:bg-gray-950"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — expanded`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Close expanded chart"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Animate a number toward `target` (eased count-up) whenever it changes. */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Tiny inline SVG trend line with gradient fill (used inside KPI cards). */
export function Sparkline({
  data,
  color = '#6366f1',
  width = 68,
  height = 26,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const id = `spark-${useId().replace(/:/g, '')}`;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const y = (v: number) => height - 2 - ((v - min) / range) * (height - 6);
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const gid = `g-${id}`;
  return (
    <svg width={width} height={height} className="flex-shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={y(data[data.length - 1])} r="2" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Tracks the `dark` class on <html> so charts re-theme with the app.
 *
 * Performance note: ONE module-level MutationObserver serves the whole app.
 * Every chart used to create its own observer (a dashboard with 10+ chart
 * widgets meant 10+ observers watching <html>); now they all subscribe to a
 * shared signal and only re-render when the theme actually flips.
 */
const darkListeners = new Set<() => void>();
let darkObserver: MutationObserver | null = null;
const cachedDarkInit =
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
let cachedDark = cachedDarkInit;

function ensureDarkObserver() {
  if (darkObserver || typeof document === 'undefined') return;
  const update = () => {
    cachedDark = document.documentElement.classList.contains('dark');
    darkListeners.forEach((l) => l());
  };
  update();
  darkObserver = new MutationObserver(update);
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function useIsDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof document === 'undefined') return () => {};
      ensureDarkObserver();
      darkListeners.add(onStoreChange);
      return () => darkListeners.delete(onStoreChange);
    },
    () => cachedDark
  );
}

/**
 * Thin React wrapper over ApexCharts.
 * - Mount effect creates the chart once the container appears.
 * - Update effect calls updateOptions for subsequent data/theme changes (no flicker).
 * Returns a ref-setter plus an API for PNG export / options updates.
 */
function useApexChart(options: ApexOptions) {
  const chartRef = useRef<ApexCharts | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  // Latest options for the one-time mount effect (kept in sync via effect).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!el) return;
    const chart = new ApexCharts(el, optionsRef.current);
    chart.render();
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [el]);

  useEffect(() => {
    chartRef.current?.updateOptions(options);
  }, [options]);

  const api = useMemo(
    () => ({
      downloadPng: async (name: string) => {
        const chart = chartRef.current;
        if (!chart) return;
        try {
          const uri = await chart.dataURI();
          if (uri && 'imgURI' in uri && uri.imgURI) downloadDataUrl(`${name}.png`, uri.imgURI);
        } catch {
          // export unavailable — ignore
        }
      },
      updateOptions: (o: ApexOptions) => chartRef.current?.updateOptions(o),
      get: () => chartRef.current,
    }),
    []
  );

  return { setEl, api };
}

/**
 * Thin React wrapper over ECharts.
 * - Mount effect inits the instance once the container appears.
 * - Update effect pushes new options for data/theme changes.
 * - ResizeObserver keeps the canvas in sync with its container.
 * Returns a ref-setter plus an API for PNG export / zoom reset / dispatch.
 */
function useEChart(option: ECOption, background: 'light' | 'dark' = 'light') {
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const bgRef = useRef(background);
  useEffect(() => {
    bgRef.current = background;
  }, [background]);

  useEffect(() => {
    if (!el) return;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [el]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  const api = useMemo(
    () => ({
      downloadPng: (name: string) => {
        const chart = chartRef.current;
        if (!chart) return;
        try {
          const dataUrl = chart.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: bgRef.current === 'dark' ? '#111827' : '#ffffff',
          });
          downloadDataUrl(`${name}.png`, dataUrl);
        } catch {
          // export unavailable — ignore
        }
      },
      resetZoom: () => {
        chartRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
      },
      dispatch: (action: { type: string; [key: string]: unknown }) =>
        chartRef.current?.dispatchAction(action),
      get: () => chartRef.current,
    }),
    []
  );

  return { setEl, api };
}

/**
 * Loose typing for ECharts tooltip callback payloads so we can format values
 * without reaching for `any`.
 */
type ECTooltipBase = {
  name?: string;
  seriesName?: string;
  dataIndex?: number;
  value?: unknown;
  data?: unknown;
  marker?: string;
};

const asTooltip = (params: unknown): ECTooltipBase =>
  (params as ECTooltipBase) ?? {};

// ---------------------------------------------------------------------------
// Line chart (ApexCharts — gradient area)
// ---------------------------------------------------------------------------
export function LineChart({
  data,
  format,
  color = '#6366f1',
  height = 190,
  showArea = true,
  toolbar = false,
  zoom = false,
  title = 'Chart',
}: {
  data: ChartDatum[];
  format?: (n: number) => string;
  color?: string;
  height?: number;
  showArea?: boolean;
  /** Show hover toolbar with PNG download + fullscreen expand. */
  toolbar?: boolean;
  /** Enable drag-to-zoom (Apex built-in, double-click to reset). */
  zoom?: boolean;
  title?: string;
}) {
  const dark = useIsDark();
  const [expanded, setExpanded] = useState(false);
  const options = useMemo<ApexOptions>(() => {
    const labelColor = dark ? '#9ca3af' : '#6b7280';
    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    return {
      chart: {
        type: 'line',
        height,
        toolbar: { show: false },
        parentHeightOffset: 0,
        animations: { enabled: true, easing: 'easeinout', speed: 400, dynamicAnimation: { enabled: true, speed: 400 } },
        fontFamily: 'inherit',
        foreColor: labelColor,
        zoom: zoom
          ? {
              enabled: true,
              type: 'x',
              autoScaleYaxis: true,
              zoomedArea: {
                fill: { color: '#90CAF9', opacity: 0.08 },
                stroke: { color: '#0D47A1', opacity: 0.4, width: 1 },
              },
            }
          : { enabled: false },
      },
      series: [{ name: 'Value', data: data.map((d) => d.value) }],
      colors: [color],
      stroke: { curve: 'smooth', width: 2.5 },
      fill: showArea
        ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0, stops: [0, 90, 100] } }
        : { type: 'solid', opacity: 1 },
      markers: { size: 3, strokeWidth: 1, hover: { size: 5 } },
      dataLabels: { enabled: false },
      grid: { borderColor: gridColor, strokeDashArray: 3 },
      xaxis: {
        categories: data.map((d) => d.label),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { rotate: 0, style: { fontSize: '10px', colors: labelColor } },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: { formatter: (v: number) => compactNum(v), style: { fontSize: '10px', colors: [labelColor] } },
      },
      tooltip: {
        theme: dark ? 'dark' : 'light',
        y: { formatter: (v: number) => (format ? format(v) : String(v)) },
      },
    };
  }, [data, format, color, height, showArea, zoom, dark]);

  const { setEl, api } = useApexChart(options);

  if (data.length === 0) {
    return <EmptyChart height={height} message="No data in this period yet." />;
  }

  return (
    <div className="group/chart relative">
      <div ref={setEl} className="w-full" style={{ height }} />
      {toolbar && (
        <ChartToolbar
          onDownload={() => api.downloadPng(title)}
          onExpand={() => setExpanded(true)}
        />
      )}
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <LineChart
            data={data}
            format={format}
            color={color}
            height={bigHeight()}
            showArea={showArea}
            zoom={zoom}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vertical bar chart (ECharts)
// ---------------------------------------------------------------------------
export function BarChart({
  data,
  format,
  color = 'bg-primary',
  height = 190,
  toolbar = false,
  zoom = false,
  title = 'Chart',
}: {
  data: ChartDatum[];
  format?: (n: number) => string;
  color?: string; // tailwind bg class
  height?: number;
  /** Show hover toolbar with PNG download + fullscreen expand. */
  toolbar?: boolean;
  /** Enable brush/wheel zoom with a reset button in the toolbar. */
  zoom?: boolean;
  title?: string;
}) {
  const dark = useIsDark();
  const [expanded, setExpanded] = useState(false);
  const barColor = resolveColor(color);
  const option = useMemo<ECOption>(() => {
    const labelColor = dark ? '#9ca3af' : '#6b7280';
    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const zoomCfg = zoom
      ? [
          { type: 'inside' as const, start: 0, end: 100 },
          {
            type: 'slider' as const,
            start: 0,
            end: 100,
            height: 14,
            bottom: 0,
            borderColor: 'transparent',
            backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            fillerColor: dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
            handleStyle: { color: '#6366f1' },
            textStyle: { color: labelColor, fontSize: 10 },
            showDetail: false,
          },
        ]
      : undefined;
    return {
      grid: { left: 4, right: 8, top: 10, bottom: zoom ? 30 : 22, containLabel: true },
      dataZoom: zoomCfg,
      xAxis: {
        type: 'category',
        data: data.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 10, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        axisLabel: { color: labelColor, fontSize: 10, formatter: compactNum },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor: dark ? '#374151' : '#e5e7eb',
        textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const first = asTooltip(list[0]);
          const value = typeof first.value === 'number' ? first.value : 0;
          return `${first.name}<br/>${first.marker ?? ''}${format ? format(value) : value.toLocaleString()}`;
        },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.value),
          barMaxWidth: 26,
          itemStyle: { color: barColor, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { color: barColor, opacity: 0.85 } },
        },
      ],
    };
  }, [data, format, barColor, dark, zoom]);

  const { setEl, api } = useEChart(option, dark ? 'dark' : 'light');

  if (data.length === 0) {
    return <EmptyChart height={height} message="No data in this period yet." />;
  }

  return (
    <div className="group/chart relative">
      <div ref={setEl} className="w-full" style={{ height }} />
      {toolbar && (
        <ChartToolbar
          onResetZoom={zoom ? () => api.resetZoom() : undefined}
          onDownload={() => api.downloadPng(title)}
          onExpand={() => setExpanded(true)}
        />
      )}
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <BarChart
            data={data}
            format={format}
            color={color}
            height={bigHeight()}
            zoom={zoom}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart (ApexCharts — legends + center total)
// ---------------------------------------------------------------------------
export function DonutChart({
  data,
  format,
  size = 150,
  thickness: _thickness = 22, // eslint-disable-line @typescript-eslint/no-unused-vars -- kept for API compat; Apex sizes the ring by percent
  centerLabel = 'Total',
  toolbar = false,
  title = 'Donut Chart',
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  format?: (n: number) => string;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  /** Show hover toolbar with PNG download + fullscreen expand. */
  toolbar?: boolean;
  title?: string;
}) {
  const dark = useIsDark();
  const [expanded, setExpanded] = useState(false);
  const total = data.reduce((s, d) => s + d.value, 0);
  const options = useMemo<ApexOptions>(() => {
    const labelColor = dark ? '#cbd5e1' : '#475569';
    const valColor = dark ? '#f9fafb' : '#111827';
    const colors = data.map((d, i) => d.color || PALETTE[i % PALETTE.length]);
    return {
      chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit', foreColor: labelColor },
      series: data.map((d) => d.value),
      labels: data.map((d) => d.label.replace('_', ' ')),
      colors,
      stroke: { width: 2, colors: dark ? ['#1f2937'] : ['#ffffff'] },
      plotOptions: {
        pie: {
          donut: {
            size: '74%',
            labels: {
              show: true,
              name: { show: false },
              value: {
                show: true,
                fontSize: '18px',
                fontWeight: '700',
                color: valColor,
                formatter: (v: string) => (format ? format(Number(v)) : v),
              },
              total: {
                show: true,
                label: centerLabel,
                fontSize: '11px',
                color: labelColor,
                formatter: () => (format ? format(total) : total.toLocaleString()),
              },
            },
          },
        },
      },
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '11px',
        itemMargin: { horizontal: 6, vertical: 4 },
        labels: { colors: labelColor, useSeriesColors: false },
        formatter: (name: string, opts?: ApexFormatterOpts) => {
          const vals = opts?.w?.globals?.series ?? [];
          const idx = data.findIndex((d) => d.label.replace('_', ' ') === name);
          const raw = idx >= 0 ? vals[idx] : data[0]?.value;
          const v = typeof raw === 'number' ? raw : Number(raw ?? 0);
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return `${name} · ${format ? format(v) : v.toLocaleString()} (${pct}%)`;
        },
      },
      tooltip: {
        theme: dark ? 'dark' : 'light',
        y: { formatter: (v: number) => `${format ? format(v) : v.toLocaleString()} (${total > 0 ? Math.round((v / total) * 100) : 0}%)` },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: string) => `${Math.round(Number(val))}%`,
        dropShadow: { enabled: false },
      },
    };
  }, [data, format, total, centerLabel, dark]);

  // Mount the chart hooks unconditionally (empty data renders an EmptyChart).
  const { setEl, api } = useApexChart(options);

  if (data.length === 0) {
    return <EmptyChart height={150} message="No data in this period yet." />;
  }

  return (
    <div className="group/chart relative">
      <div ref={setEl} className="w-full" style={{ height: Math.max(220, size + 80) }} />
      {toolbar && (
        <ChartToolbar onDownload={() => api.downloadPng(title)} onExpand={() => setExpanded(true)} />
      )}
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <DonutChart
            data={data}
            format={format}
            size={Math.min(320, bigHeight() - 140)}
            centerLabel={centerLabel}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion funnel (ECharts — descending funnel)
// ---------------------------------------------------------------------------
export function FunnelChart({
  stages,
  format,
  onStageClick,
  toolbar = false,
  title = 'Conversion Funnel',
  height = 260,
}: {
  stages: Array<{ label: string; value: number }>;
  format?: (n: number) => string;
  /** Called with the stage index when the user clicks a funnel band. */
  onStageClick?: (index: number) => void;
  /** Show hover toolbar with PNG download + fullscreen expand. */
  toolbar?: boolean;
  title?: string;
  height?: number;
}) {
  const dark = useIsDark();
  const [expanded, setExpanded] = useState(false);
  const option = useMemo<ECOption>(() => {
    const labelColor = dark ? '#9ca3af' : '#6b7280';
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor: dark ? '#374151' : '#e5e7eb',
        textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = asTooltip(params);
          const value = typeof p.value === 'number' ? p.value : 0;
          const data = p.data as { name?: string; value?: number } | undefined;
          const idx = p.dataIndex ?? -1;
          const prev = idx > 0 ? stages[idx - 1].value : 0;
          const conv = idx > 0 && prev > 0 ? Math.round((value / prev) * 100) : null;
          const base = `${data?.name ?? p.name ?? ''}<br/>${p.marker ?? ''}${format ? format(value) : value.toLocaleString()}`;
          return conv !== null ? `${base}<br/><span style="opacity:0.7">↘ ${conv}% from previous stage</span>` : base;
        },
      },
      legend: { show: false },
      series: [
        {
          type: 'funnel',
          left: '0%',
          width: '100%',
          top: 8,
          bottom: 8,
          sort: 'descending',
          gap: 4,
          minSize: 10,
          label: {
            show: true,
            position: 'inside',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            formatter: (params: unknown) => {
              const p = asTooltip(params);
              const value = typeof p.value === 'number' ? p.value : 0;
              return `${p.name ?? ''}  ${format ? format(value) : value.toLocaleString()}`;
            },
          },
          labelLine: { show: false },
          itemStyle: { borderWidth: 0 },
          emphasis: { label: { fontSize: 12 } },
          color: [
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }] },
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#a855f7' }] },
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#a855f7' }, { offset: 1, color: '#d946ef' }] },
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#d946ef' }, { offset: 1, color: '#ec4899' }] },
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ec4899' }, { offset: 1, color: '#f43f5e' }] },
            { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#fb7185' }] },
          ],
          data: stages.map((s) => ({ name: s.label, value: s.value })),
        },
      ],
      color: [labelColor],
    };
  }, [stages, format, dark]);

  const { setEl, api } = useEChart(option, dark ? 'dark' : 'light');

  // Forward ECharts click events so the page can show a stage-detail modal.
  useEffect(() => {
    const inst = api.get();
    if (!inst || !onStageClick) return;
    const handler = (params: unknown) => {
      const p = asTooltip(params);
      const idx = p.dataIndex;
      if (typeof idx === 'number') onStageClick(idx);
    };
    inst.on('click', handler);
    return () => {
      inst.off('click', handler);
    };
  }, [api, onStageClick]);

  return (
    <div className="group/chart relative">
      <div ref={setEl} className="w-full" style={{ height }} />
      {toolbar && (
        <ChartToolbar onDownload={() => api.downloadPng(title)} onExpand={() => setExpanded(true)} />
      )}
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <FunnelChart
            stages={stages}
            format={format}
            onStageClick={onStageClick}
            title={title}
            height={bigHeight()}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue forecast (ECharts — actual solid, forecast dashed, confidence band)
// ---------------------------------------------------------------------------
export function ForecastChart({
  points,
  format,
  height = 220,
  color = '#6366f1',
  bandColor = '#6366f1',
}: {
  points: Array<{
    index: number; // negative = historical, non-negative = forecast
    label: string;
    actual?: number;
    forecast?: number;
    low?: number;
    high?: number;
  }>;
  format?: (n: number) => string;
  color?: string;
  bandColor?: string;
  height?: number;
}) {
  const dark = useIsDark();
  const option = useMemo<ECOption>(() => {
    const labelColor = dark ? '#9ca3af' : '#6b7280';
    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const firstFuture = points.find((p) => p.index >= 0)?.label;
    const labels = points.map((p) => p.label);

    return {
      grid: { left: 4, right: 12, top: 16, bottom: 24, containLabel: true },
      legend: {
        show: true,
        bottom: 0,
        itemWidth: 14,
        itemHeight: 2,
        textStyle: { color: labelColor, fontSize: 11 },
        data: ['Actual', 'Forecast'],
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 10, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        axisLabel: { color: labelColor, fontSize: 10, formatter: compactNum },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor: dark ? '#374151' : '#e5e7eb',
        textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const rows = list
            .filter((p) => p?.value !== undefined && p?.value !== null && p.seriesName !== 'Band')
            .map((p) => {
              const v = typeof p.value === 'number' ? p.value : 0;
              return `${p.marker ?? ''}${p.seriesName ?? ''}: <b>${format ? format(v) : v.toLocaleString()}</b>`;
            });
          const first = asTooltip(list[0]);
          return `<b>${first.name ?? ''}</b><br/>${rows.join('<br/>')}`;
        },
      },
      series: [
        // Confidence band via stacked translucent series (high − low on top of low)
        {
          name: 'Band low',
          type: 'line',
          stack: 'band',
          data: points.map((p) => (p.low !== undefined ? p.low : null)),
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          symbol: 'none',
          silent: true,
          tooltip: { show: false },
        },
        {
          name: 'Band',
          type: 'line',
          stack: 'band',
          data: points.map((p) =>
            p.high !== undefined && p.low !== undefined ? p.high - p.low : null
          ),
          lineStyle: { opacity: 0 },
          areaStyle: { color: bandColor, opacity: 0.16 },
          symbol: 'none',
          silent: true,
          tooltip: { show: false },
        },
        {
          name: 'Actual',
          type: 'line',
          data: points.map((p) => p.actual ?? null),
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color, width: 2.5 },
          itemStyle: { color, borderColor: dark ? '#1f2937' : '#ffffff', borderWidth: 1.5 },
          ...(firstFuture
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  label: {
                    show: true,
                    formatter: 'now',
                    position: 'insideEndTop' as const,
                    fontSize: 9,
                    color: labelColor,
                  },
                  lineStyle: { type: 'dashed' as const, width: 1, color: labelColor, opacity: 0.6 },
                  data: [{ xAxis: firstFuture }],
                },
              }
            : {}),
        },
        {
          name: 'Forecast',
          type: 'line',
          data: points.map((p) => (p.index >= 0 ? p.forecast : null)),
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color, width: 2, type: 'dashed' },
          itemStyle: { color: '#ffffff', borderColor: color, borderWidth: 2 },
        },
      ],
    };
  }, [points, format, color, bandColor, dark]);

  const { setEl } = useEChart(option, dark ? 'dark' : 'light');

  if (points.length === 0) {
    return <EmptyChart height={height} message="Not enough history to forecast yet." />;
  }

  return <div ref={setEl} className="w-full" style={{ height }} />;
}

// ---------------------------------------------------------------------------
// Horizontal bar list (ECharts — bars + rank/value labels, optional thumbs)
// ---------------------------------------------------------------------------
export function HBarList({
  rows,
  format,
  color = 'bg-emerald-500',
  empty = 'No data in this period yet.',
}: {
  rows: Array<{ label: string; value: number; sub?: string | number; image?: string; href?: string }>;
  format?: (n: number) => string;
  color?: string;
  empty?: string;
}) {
  const dark = useIsDark();
  const barColor = resolveColor(color);
  const option = useMemo<ECOption>(() => {
    const labelColor = dark ? '#cbd5e1' : '#374151';
    const axisColor = dark ? '#9ca3af' : '#6b7280';
    const rich: Record<string, { backgroundColor: { image: string }; height: number; width: number; borderRadius: number; align: 'center' }> = {};
    const axisData = rows.map((r, i) => {
      if (r.image) {
        rich[`img${i}`] = { backgroundColor: { image: r.image }, height: 20, width: 20, borderRadius: 4, align: 'center' };
        return `{img${i}| } ${r.label}`;
      }
      return r.label;
    });

    return {
      grid: { left: 4, right: 48, top: 4, bottom: 0, containLabel: true },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: axisData,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: labelColor,
          fontSize: 12,
          width: 150,
          overflow: 'truncate',
          formatter: (value: string) => {
            const plain = value.replace(/\{img\d+\|[^}]*\}/g, '').trim();
            return value.includes('{img') ? value : truncate(plain, 24);
          },
          rich,
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor: dark ? '#374151' : '#e5e7eb',
        textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = asTooltip(params);
          const plainLabel = String(p.name ?? '').replace(/\{img\d+\|[^}]*\}/g, '').trim();
          const value = typeof p.value === 'number' ? p.value : 0;
          const sub = rows[p.dataIndex ?? -1]?.sub;
          const subTxt = sub !== undefined ? ` · ${sub}` : '';
          return `${plainLabel}<br/>${p.marker ?? ''}<b>${format ? format(value) : value.toLocaleString()}</b>${subTxt}`;
        },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => r.value),
          barWidth: 8,
          itemStyle: { color: barColor, borderRadius: [0, 4, 4, 0], opacity: 0.9 },
          emphasis: { itemStyle: { color: barColor, opacity: 1 } },
          showBackground: true,
          backgroundStyle: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: axisColor,
            fontSize: 11,
            fontWeight: 600,
            formatter: (params: unknown) => {
              const p = asTooltip(params);
              const value = typeof p.value === 'number' ? p.value : 0;
              return format ? format(value) : value.toLocaleString();
            },
          },
        },
      ],
    };
  }, [rows, format, barColor, dark]);

  const { setEl } = useEChart(option, dark ? 'dark' : 'light');

  if (rows.length === 0) {
    return <EmptyChart height={120} message={empty} />;
  }

  return <div ref={setEl} className="w-full" style={{ height: Math.max(120, rows.length * 34 + 8) }} />;
}

export function EmptyChart({ height = 150, message = 'No data yet.' }: { height?: number; message?: string }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-700"
      style={{ height }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-metric combo chart (ECharts — bar/line toggle, brush zoom, prev period)
// ---------------------------------------------------------------------------
export type ComboMetric = 'revenue' | 'orders' | 'units' | 'aov';

export const COMBO_METRICS: Array<{ key: ComboMetric; label: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'orders', label: 'Orders' },
  { key: 'units', label: 'Units' },
  { key: 'aov', label: 'AOV' },
];

const comboColor: Record<ComboMetric, string> = {
  revenue: '#6366f1',
  orders: '#ec4899',
  units: '#0ea5e9',
  aov: '#10b981',
};

export function ComboChart({
  labels,
  series,
  prev,
  format,
  formatters,
  height = 240,
  title = 'Performance Explorer',
}: {
  /** X-axis labels (e.g. dates), aligned index-wise with every series. */
  labels: string[];
  series: Record<ComboMetric, number[]>;
  /** Optional previous-period overlay line (dashed). */
  prev?: number[] | null;
  format?: (n: number) => string;
  /** Per-metric formatters — use when each metric needs different units. */
  formatters?: Partial<Record<ComboMetric, (n: number) => string>>;
  height?: number;
  title?: string;
}) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<ComboMetric>('revenue');
  const [mode, setMode] = useState<'bar' | 'line'>('bar');
  const [showPrev, setShowPrev] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const values = useMemo(() => (series[metric] || []).slice(0, labels.length), [series, metric, labels.length]);
  const fmt = useMemo(
    () => formatters?.[metric] ?? format ?? ((n: number) => n.toLocaleString()),
    [formatters, metric, format]
  );

  const option = useMemo<ECOption>(() => {
    const labelColor = dark ? '#9ca3af' : '#6b7280';
    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const mainColor = comboColor[metric];
    const metricLabel = COMBO_METRICS.find((m) => m.key === metric)?.label ?? metric;
    const main: BarSeriesOption | LineSeriesOption = mode === 'bar'
      ? {
          name: metricLabel,
          type: 'bar',
          data: values,
          barMaxWidth: 18,
          itemStyle: { color: mainColor, borderRadius: [4, 4, 0, 0] },
          emphasis: { focus: 'series', itemStyle: { color: mainColor, opacity: 0.85 } },
        }
      : {
          name: metricLabel,
          type: 'line',
          data: values,
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: mainColor, width: 2.5 },
          itemStyle: { color: mainColor, borderColor: dark ? '#1f2937' : '#ffffff', borderWidth: 1.5 },
          areaStyle: { color: mainColor, opacity: 0.12 },
          emphasis: { focus: 'series' },
        };
    const prevSeries: LineSeriesOption | null = showPrev && prev
      ? {
          name: 'Previous period',
          type: 'line',
          data: prev,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#94a3b8', width: 1.5, type: 'dashed' },
          itemStyle: { color: '#94a3b8' },
          z: 3,
        }
      : null;
    const seriesArr = prevSeries ? [main, prevSeries] : [main];
    return {
      grid: { left: 4, right: 12, top: showPrev ? 34 : 10, bottom: 30, containLabel: true },
      legend: showPrev
        ? {
            show: true,
            top: 0,
            itemWidth: 14,
            itemHeight: 2,
            textStyle: { color: labelColor, fontSize: 11 },
            data: [metricLabel, 'Previous period'],
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor: dark ? '#374151' : '#e5e7eb',
        textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const first = asTooltip(list[0]);
          const rows = list
            .filter((p: ECTooltipBase) => p?.value !== undefined && p?.value !== null)
            .map((p: ECTooltipBase) => {
              const v = typeof p.value === 'number' ? p.value : 0;
              return `${p.marker ?? ''}${p.seriesName ?? ''}: <b>${fmt(v)}</b>`;
            });
          return `<b>${first.name ?? ''}</b><br/>${rows.join('<br/>')}`;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 10, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        axisLabel: { color: labelColor, fontSize: 10, formatter: compactNum },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 14,
          bottom: 0,
          borderColor: 'transparent',
          backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          fillerColor: dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
          handleStyle: { color: '#6366f1' },
          textStyle: { color: labelColor, fontSize: 10 },
          showDetail: false,
        },
      ],
      series: seriesArr,
    };
  }, [labels, values, prev, showPrev, mode, metric, dark, fmt]);

  const { setEl, api } = useEChart(option, dark ? 'dark' : 'light');

  if (labels.length === 0) {
    return <EmptyChart height={height} message="No data in this period yet." />;
  }

  const pillBase =
    'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors';
  const pillActive = 'bg-gray-900 text-white dark:bg-white dark:text-gray-900';
  const pillIdle =
    'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600';

  return (
    <div className="group/chart relative">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {COMBO_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(pillBase, metric === m.key ? pillActive : pillIdle)}
          >
            {m.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <button
          onClick={() => setMode((v) => (v === 'bar' ? 'line' : 'bar'))}
          className={cn(pillBase, pillIdle)}
          title="Toggle bar / line"
        >
          {mode === 'bar' ? 'Line' : 'Bars'}
        </button>
        {prev && (
          <button
            onClick={() => setShowPrev((v) => !v)}
            className={cn(pillBase, showPrev ? pillActive : pillIdle)}
            title="Overlay previous period for comparison"
          >
            {showPrev ? 'Hide prev' : 'vs prev period'}
          </button>
        )}
      </div>
      <div ref={setEl} className="w-full" style={{ height }} />
      <ChartToolbar
        onResetZoom={() => api.resetZoom()}
        onDownload={() => api.downloadPng(title)}
        onExpand={() => setExpanded(true)}
      />
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <ComboChart
            labels={labels}
            series={series}
            prev={prev}
            format={format}
            formatters={formatters}
            height={bigHeight()}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category balance radar (ECharts — revenue or units by category)
// ---------------------------------------------------------------------------
export function RadarChart({
  data,
  format,
  formatters,
  height = 255,
  title = 'Category Balance',
}: {
  data: Array<{ name: string; revenue: number; units: number }>;
  format?: (n: number) => string;
  formatters?: Partial<Record<'revenue' | 'units', (n: number) => string>>;
  height?: number;
  title?: string;
}) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<'revenue' | 'units'>('revenue');
  const [expanded, setExpanded] = useState(false);
  const labelColor = dark ? '#cbd5e1' : '#475569';
  const gridColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const color = metric === 'revenue' ? '#6366f1' : '#0ea5e9';
  const fmt = useMemo(
    () => formatters?.[metric] ?? format ?? ((n: number) => n.toLocaleString()),
    [formatters, metric, format]
  );

  const rows = useMemo(() => (data || []).slice(0, 6), [data]);
  const maxVal = useMemo(
    () => Math.max(1, ...rows.map((r) => r[metric])),
    [rows, metric]
  );

  const option = useMemo<ECOption>(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1f2937' : '#ffffff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = asTooltip(params);
        const value = typeof p.value === 'number' ? p.value : 0;
        const data = p.data as { name?: string; value?: number[] } | undefined;
        const raw = Array.isArray(data?.value) ? data.value[0] : value;
        return `${data?.name ?? p.name ?? ''}<br/>${p.marker ?? ''}<b>${fmt(Number(raw) || 0)}</b>`;
      },
    },
    radar: {
      indicator: rows.map((r) => ({ name: r.name, max: maxVal })),
      radius: '62%',
      center: ['50%', '54%'],
      axisName: { color: labelColor, fontSize: 10 },
      splitArea: { areaStyle: { color: ['transparent'] } },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.22 },
        data: [
          {
            value: rows.map((r) => r[metric]),
            name: metric === 'revenue' ? 'Revenue' : 'Units',
          },
        ],
      },
    ],
  }), [rows, metric, maxVal, color, labelColor, gridColor, dark, fmt]);

  const { setEl, api } = useEChart(option, dark ? 'dark' : 'light');

  if (rows.length === 0) {
    return <EmptyChart height={height} message="No category data in this period yet." />;
  }

  return (
    <div className="group/chart relative">
      <div className="mb-1 flex items-center gap-1.5">
        {(['revenue', 'units'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
              metric === m
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            {m === 'revenue' ? 'Revenue' : 'Units'}
          </button>
        ))}
      </div>
      <div ref={setEl} className="w-full" style={{ height }} />
      <ChartToolbar
        onDownload={() => api.downloadPng(title)}
        onExpand={() => setExpanded(true)}
      />
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <RadarChart
            data={data}
            format={format}
            formatters={formatters}
            height={bigHeight()}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly activity heatmap (ECharts — weekday × hour, orders or revenue)
// ---------------------------------------------------------------------------
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HeatmapChart({
  cells,
  format,
  formatters,
  height = 265,
  title = 'Activity Heatmap',
}: {
  /** weekday: 1=Sun … 7=Sat (MongoDB $dayOfWeek), hour: 0–23. */
  cells: Array<{ weekday: number; hour: number; orders: number; revenue: number }>;
  format?: (n: number) => string;
  formatters?: Partial<Record<'orders' | 'revenue', (n: number) => string>>;
  height?: number;
  title?: string;
}) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const [expanded, setExpanded] = useState(false);
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const fmt = useMemo(
    () => formatters?.[metric] ?? format ?? ((n: number) => n.toLocaleString()),
    [formatters, metric, format]
  );

  const grid = useMemo(() => {
    const m: Record<string, number> = {};
    (cells || []).forEach((c) => {
      const idx = (c.weekday + 5) % 7; // Sun=1→6, Mon=2→0 … Sat=7→5
      m[`${idx}:${c.hour}`] = c[metric] || 0;
    });
    return m;
  }, [cells, metric]);

  const values = useMemo(() => {
    const arr: number[] = [];
    for (let d = 0; d < 7; d += 1) {
      for (let h = 0; h < 24; h += 1) arr.push(grid[`${d}:${h}`] ?? 0);
    }
    return arr;
  }, [grid]);

  const maxVal = Math.max(1, ...values);

  const option = useMemo<ECOption>(() => ({
    tooltip: {
      position: 'top',
      backgroundColor: dark ? '#1f2937' : '#ffffff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#f3f4f6' : '#111827', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = asTooltip(params);
        const raw = p.value;
        if (!Array.isArray(raw) || raw.length < 3) return '';
        const [hour, dayIdx, val] = raw as [number, number, number];
        const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
        return `<b>${WEEKDAY_ORDER[dayIdx]} ${String(hour).padStart(2, '0')}:00</b><br/>${fmt(val)}<br/><span style="opacity:0.7">${pct}% of peak</span>`;
      },
    },
    grid: { left: 34, right: 14, top: 8, bottom: 26 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: labelColor, fontSize: 9, interval: 2 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: WEEKDAY_ORDER,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: labelColor, fontSize: 10 },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'center',
      itemWidth: 10,
      itemHeight: 90,
      textStyle: { color: labelColor, fontSize: 10 },
      inRange: {
        color: dark
          ? ['#0f172a', '#312e81', '#6366f1', '#a5b4fc']
          : ['#f1f5f9', '#c7d2fe', '#818cf8', '#4f46e5'],
      },
    },
    series: [
      {
        name: metric === 'revenue' ? 'Revenue' : 'Orders',
        type: 'heatmap',
        data: values.map((v, i) => [i % 24, Math.floor(i / 24), v]),
        label: { show: false },
        itemStyle: {
          borderColor: dark ? '#111827' : '#ffffff',
          borderWidth: 2,
          borderRadius: 3,
        },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.35)' } },
      },
    ],
  }), [values, maxVal, metric, dark, fmt, labelColor]);

  const { setEl, api } = useEChart(option, dark ? 'dark' : 'light');

  if ((cells || []).length === 0) {
    return <EmptyChart height={height} message="No order data yet — the weekly heatmap fills in as orders come." />;
  }

  return (
    <div className="group/chart relative">
      <div className="mb-1 flex items-center gap-1.5">
        {(['orders', 'revenue'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
              metric === m
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            {m === 'orders' ? 'Orders' : 'Revenue'}
          </button>
        ))}
        <span className="ml-auto pr-7 text-[10px] text-gray-400">
          {metric === 'orders' ? 'Order volume' : 'Revenue'} · weekday × hour
        </span>
      </div>
      <div ref={setEl} className="w-full" style={{ height }} />
      <ChartToolbar
        onDownload={() => api.downloadPng(title)}
        onExpand={() => setExpanded(true)}
      />
      {expanded && (
        <ExpandOverlay title={title} onClose={() => setExpanded(false)}>
          <HeatmapChart
            cells={cells}
            format={format}
            formatters={formatters}
            height={bigHeight()}
            title={title}
          />
        </ExpandOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health gauges (Apex radial bars — conversion, retention, fulfillment, stock)
// ---------------------------------------------------------------------------
export function GaugeRow({
  gauges,
  height = 200,
  title = 'Health Gauges',
}: {
  /** value is a 0–100 health score; label should carry the raw metric context. */
  gauges: Array<{ label: string; value: number }>;
  height?: number;
  title?: string;
}) {
  const dark = useIsDark();
  const colors = useMemo(
    () =>
      gauges.map((g) => {
        const v = Math.max(0, Math.min(100, g.value));
        return v >= 75 ? '#10b981' : v >= 45 ? '#f59e0b' : '#ef4444';
      }),
    [gauges]
  );
  const options = useMemo<ApexOptions>(() => {
    const labelColor = dark ? '#cbd5e1' : '#475569';
    return {
      chart: {
        type: 'radialBar',
        fontFamily: 'inherit',
        foreColor: labelColor,
        toolbar: { show: false },
        animations: { enabled: true, speed: 500 },
      },
      series: gauges.map((g) => Math.max(0, Math.min(100, Math.round(g.value * 10) / 10))),
      colors,
      labels: gauges.map((g) => g.label),
      plotOptions: {
        radialBar: {
          track: { background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
          dataLabels: {
            show: true,
            name: {
              fontSize: '11px',
              color: labelColor,
              offsetY: 16,
            },
            value: {
              fontSize: '17px',
              fontWeight: 700,
              color: dark ? '#f9fafb' : '#111827',
              offsetY: -14,
              formatter: (v: number) => `${Math.round(v)}%`,
            },
            total: { show: false },
          },
        },
      },
      tooltip: {
        theme: dark ? 'dark' : 'light',
        y: { formatter: (v: number) => `${Math.round(v)}%` },
      },
      stroke: { lineCap: 'round' },
    };
  }, [gauges, colors, dark]);

  const { setEl, api } = useApexChart(options);

  if (gauges.length === 0) {
    return <EmptyChart height={height} message="No health data yet." />;
  }

  return (
    <div className="group/chart relative">
      <div ref={setEl} className="w-full" style={{ height }} />
      <ChartToolbar onDownload={() => api.downloadPng(title)} />
    </div>
  );
}