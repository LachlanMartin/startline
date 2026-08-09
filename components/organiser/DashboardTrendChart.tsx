"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FormSelect from "@/components/ui/FormSelect";
import { formatAudFromCents } from "@/lib/organiser-dashboard";

export type TrendDay = {
  date: string;
  registrations: number;
  revenueCents: number;
};

type Metric = "registrations" | "revenue";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export default function DashboardTrendChart({
  days,
  events,
  eventId,
  onEventChange,
  rangeDays,
  onRangeDaysChange,
}: {
  days: TrendDay[];
  events: { id: string; title: string }[];
  eventId: string;
  onEventChange: (eventId: string) => void;
  rangeDays: number;
  onRangeDaysChange: (days: number) => void;
}) {
  const [metric, setMetric] = useState<Metric>("registrations");

  const series = useMemo(
    () => (days.length > 0 ? days : emptyTrendDays(rangeDays)),
    [days, rangeDays],
  );

  const chartData = useMemo(
    () =>
      series.map((d) => ({
        date: d.date,
        label: formatAxisDate(d.date),
        value: metric === "registrations" ? d.registrations : d.revenueCents / 100,
      })),
    [series, metric],
  );

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData],
  );

  const eventOptions = [
    { value: "", label: "All events" },
    ...events.map((e) => ({ value: e.id, label: e.title })),
  ];

  const metricOptions = [
    { value: "registrations", label: "Registrations" },
    { value: "revenue", label: "Revenue (est.)" },
  ];

  const rangeLabel = `${formatAxisDate(series[0].date)} — ${formatAxisDate(series[series.length - 1].date)}`;
  const rangeEyebrow =
    RANGE_OPTIONS.find((o) => o.value === String(rangeDays))?.label ?? `Last ${rangeDays} days`;

  return (
    <section className="bg-dark border border-dark-lighter rounded-xl p-4 sm:p-6 mb-6 sm:mb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
            Trend · {rangeEyebrow}
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-headline text-2xl sm:text-3xl font-black italic tracking-tighter text-light leading-none">
              {metric === "registrations"
                ? total.toLocaleString()
                : formatAudFromCents(Math.round(total * 100))}
            </span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-light">
              {rangeLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
          <FormSelect
            aria-label="Time range"
            value={String(rangeDays)}
            onChange={(v) => onRangeDaysChange(Number(v))}
            options={RANGE_OPTIONS}
            triggerClassName="min-w-[150px]"
          />
          <FormSelect
            aria-label="Event"
            value={eventId}
            onChange={onEventChange}
            options={eventOptions}
            triggerClassName="min-w-[160px]"
          />
          <FormSelect
            aria-label="Metric"
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
            options={metricOptions}
            triggerClassName="min-w-[160px]"
          />
        </div>
      </div>

      <div className="h-[220px] sm:h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B3E153" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#B3E153" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(53,53,53,0.8)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#F5F7FA", fontSize: 11 }}
              axisLine={{ stroke: "#353535" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#F5F7FA", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={[0, (max: number) => (max > 0 ? max : 1)]}
              tickFormatter={(v: number) =>
                metric === "revenue"
                  ? `$${Math.round(v).toLocaleString()}`
                  : String(Math.round(v))
              }
            />
            <Tooltip
              contentStyle={{
                background: "#1F1F1F",
                border: "1px solid #353535",
                borderRadius: 10,
                color: "#F5F7FA",
                fontSize: 12,
              }}
              labelStyle={{ color: "#F5F7FA", fontWeight: 700 }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value ?? 0);
                return [
                  metric === "revenue"
                    ? formatAudFromCents(Math.round(n * 100))
                    : n.toLocaleString(),
                  metric === "revenue" ? "Revenue (est.)" : "Registrations",
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#B3E153"
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#B3E153", stroke: "#141414" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function emptyTrendDays(count: number): TrendDay[] {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (count - 1));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${day}`, registrations: 0, revenueCents: 0 };
  });
}

function formatAxisDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}
