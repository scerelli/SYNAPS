import { useState } from "react";
import { format } from "date-fns";
import { TrendingUp, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { trpc } from "@/api/trpc";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  normal: "#22c55e",
  "in-range": "#22c55e",
  high: "#f59e0b",
  low: "#f59e0b",
  critical: "#ef4444",
};

function dotColor(status: string | null | undefined): string {
  if (!status) return "#6366f1";
  return STATUS_COLORS[status] ?? "#6366f1";
}

type ChartPoint = {
  date: string;
  value: number;
  unit: string;
  referenceMin: number | null | undefined;
  referenceMax: number | null | undefined;
  status: string | null | undefined;
  label: string;
};

type CustomDotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
};

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={dotColor(payload.status)}
      stroke="#0f172a"
      strokeWidth={1.5}
    />
  );
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
};

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]) return null;
  const point = payload[0].payload;
  const inRange =
    (point.referenceMin === null ||
      point.referenceMin === undefined ||
      point.value >= point.referenceMin) &&
    (point.referenceMax === null ||
      point.referenceMax === undefined ||
      point.value <= point.referenceMax);

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-400 text-xs mb-1">{point.label}</p>
      <p className="font-semibold text-white">
        {point.value} {point.unit}
      </p>
      {point.referenceMin !== null &&
        point.referenceMin !== undefined &&
        point.referenceMax !== null &&
        point.referenceMax !== undefined && (
          <p
            className={cn(
              "text-xs mt-0.5",
              inRange ? "text-green-400" : "text-amber-400"
            )}
          >
            {inRange ? "In range" : "Out of range"} ({point.referenceMin}–
            {point.referenceMax} {point.unit})
          </p>
        )}
    </div>
  );
}

function BiomarkerChart({
  name,
}: {
  name: string;
}) {
  const { data, isLoading } = trpc.biomarker.timeSeries.useQuery({ name });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <TrendingUp className="h-10 w-10 opacity-30" />
        <p className="text-sm">No data found for this biomarker</p>
      </div>
    );
  }

  const firstPointWithRange = data.points.find(
    (p) => p.referenceMin !== null && p.referenceMax !== null
  );
  const refMin = firstPointWithRange?.referenceMin ?? null;
  const refMax = firstPointWithRange?.referenceMax ?? null;

  const chartData: ChartPoint[] = data.points.map((p) => ({
    ...p,
    label: format(new Date(p.date), "d MMM yy"),
  }));

  const unit = data.points[0]?.unit ?? "";
  const lastPoint = data.points[data.points.length - 1];
  const lastValue = lastPoint?.value ?? null;
  const count = data.points.length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-900/50 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#475569"
              opacity={0.3}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
                dx: -4,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            {refMin !== null && refMax !== null && (
              <ReferenceArea
                y1={refMin}
                y2={refMax}
                fill="oklch(0.723 0.191 149.579)"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}
            {data.ema !== null && (
              <ReferenceLine
                y={data.ema}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `EMA ${data.ema.toFixed(1)}`,
                  fill: "#64748b",
                  fontSize: 10,
                  position: "right",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: "#6366f1" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          label="Last value"
          value={lastValue !== null ? `${lastValue} ${unit}` : "—"}
        />
        <StatCard
          label="Average (EMA)"
          value={
            data.ema !== null ? `${data.ema.toFixed(1)} ${unit}` : "—"
          }
        />
        <StatCard
          label="Trend"
          value={
            data.trend === "increasing"
              ? "↑ Increasing"
              : data.trend === "decreasing"
                ? "↓ Decreasing"
                : data.trend === "stable"
                  ? "→ Stable"
                  : "—"
          }
          valueClassName={
            data.trend === "increasing"
              ? "text-amber-400"
              : data.trend === "decreasing"
                ? "text-blue-400"
                : data.trend === "stable"
                  ? "text-green-400"
                  : ""
          }
        />
        <StatCard
          label="Z-score"
          value={
            data.zScore !== null ? `${data.zScore.toFixed(1)}σ` : "—"
          }
          title="How far from your personal average"
        />
        <StatCard label="Measurements" value={String(count)} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
  title,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-muted/30 px-3 py-2"
      title={title}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

export function TrendsTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const names = trpc.biomarker.biomarkerNames.useQuery();

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-72 justify-between"
            >
              {selected
                ? (names.data?.find((n) => n.name === selected)?.name ??
                  selected)
                : "Select biomarker…"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search biomarker…" />
              <CommandList>
                <CommandEmpty>No biomarker found.</CommandEmpty>
                <CommandGroup>
                  {names.data?.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={(val) => {
                        setSelected(val === selected ? null : val);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected === item.name
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.count} measurements
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {names.isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {!selected ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <TrendingUp className="h-12 w-12 opacity-30" />
          <p className="text-sm">Select a biomarker to view its trend</p>
        </div>
      ) : (
        <BiomarkerChart name={selected} />
      )}
    </div>
  );
}
