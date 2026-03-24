import { Link } from "react-router";
import {
  Activity,
  Bell,
  Droplets,
  FileText,
  Loader2,
  MapPin,
  Moon,
  Network,
  Scale,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/api/trpc";

type Trend = "increasing" | "decreasing" | "stable";

function TrendIcon({ trend, inverse = false }: { trend: Trend; inverse?: boolean }) {
  if (trend === "stable") return null;
  const up = trend === "increasing";
  const positive = inverse ? !up : up;
  const cls = positive ? "text-emerald-500" : "text-amber-500";
  return up
    ? <TrendingUp className={`h-3 w-3 ${cls}`} />
    : <TrendingDown className={`h-3 w-3 ${cls}`} />;
}

function aqiLabel(aqi: number) {
  if (aqi <= 50) return { text: "Good", cls: "text-emerald-500" };
  if (aqi <= 100) return { text: "Moderate", cls: "text-amber-500" };
  if (aqi <= 150) return { text: "Sensitive", cls: "text-orange-500" };
  return { text: "Unhealthy", cls: "text-rose-500" };
}

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  trend,
  inverseTrend = false,
  href,
  muted = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  trend?: Trend;
  inverseTrend?: boolean;
  href?: string;
  muted?: boolean;
}) {
  const inner = (
    <div className="flex flex-col h-full p-4 gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-end gap-1">
          <span className={`text-2xl font-semibold leading-none ${muted ? "text-muted-foreground" : ""}`}>
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>}
          {trend && <div className="mb-0.5"><TrendIcon trend={trend} inverse={inverseTrend} /></div>}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );

  const cls = "border rounded-xl bg-card h-full" + (href ? " hover:bg-muted/40 transition-colors cursor-pointer" : "");
  return href ? <Link to={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function EnvTile() {
  const { data, isLoading, error } = trpc.environment.current.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) return <MetricTile icon={Wind} label="Environment" value="—" href="/environment" />;

  if (error?.data?.code === "BAD_REQUEST" || !data) {
    return (
      <Link to="/profile" className="border rounded-xl bg-card h-full hover:bg-muted/40 transition-colors">
        <div className="flex flex-col h-full p-4 gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wind className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium">Environment</span>
          </div>
          <div className="flex-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Set location in profile
          </div>
        </div>
      </Link>
    );
  }

  const aqi = aqiLabel(data.aqi);

  return (
    <Link to="/environment" className="border rounded-xl bg-card h-full hover:bg-muted/40 transition-colors">
      <div className="flex flex-col h-full p-4 gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Wind className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium">Environment</span>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          <div className="flex items-center gap-1 text-sm">
            <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span className="font-semibold">{data.temperature}°</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1">
              <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-muted-foreground">UV</span>
              <span className="font-medium">{data.uvIndex}</span>
            </span>
            <span className={`flex items-center gap-1 ${aqi.cls}`}>
              <Droplets className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium">{aqi.text}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RemindersPanel() {
  const utils = trpc.useUtils();
  const { data: reminders, isLoading } = trpc.reminder.list.useQuery();
  const dismiss = trpc.reminder.dismiss.useMutation({
    onSuccess: () => utils.reminder.list.invalidate(),
  });
  const generate = trpc.reminder.generate.useMutation({
    onSuccess: () => utils.reminder.list.invalidate(),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Reminders
            {reminders && reminders.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({reminders.length})</span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {generate.isPending ? "Generating…" : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && !reminders?.length && (
          <p className="text-xs text-muted-foreground">
            No active reminders.{" "}
            <button
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              Generate AI suggestions
            </button>
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {reminders?.map((reminder) => (
            <div key={reminder.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/15 hover:bg-muted/30 transition-colors group">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-snug">{reminder.title}</p>
                {reminder.description && (
                  <p className="text-xs text-muted-foreground leading-snug">{reminder.description}</p>
                )}
                {reminder.dueDate && (
                  <p className="text-xs text-primary/70 font-medium">
                    Due {new Date(reminder.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <button
                className="mt-0.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => dismiss.mutate({ id: reminder.id })}
                disabled={dismiss.isPending}
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function relativeDate(d: string | Date) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff}d ago`;
}

export function DashboardPage() {
  const reports = trpc.report.list.useQuery({ limit: 5 });
  const profile = trpc.profile.get.useQuery();
  const graphStats = trpc.graph.stats.useQuery();
  const conditions = trpc.condition.list.useQuery();
  const metrics = trpc.metrics.snapshot.useQuery();

  const activeConditions = conditions.data?.filter((c) => c.isCurrent).length ?? 0;
  const lastReport = reports.data?.items[0];
  const snap = metrics.data;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight">
            {profile.data ? `Hello, ${profile.data.user.name}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
      </div>

      {/* Metrics grid — equal height via CSS grid rows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 auto-rows-fr">
        {/* Last report */}
        <MetricTile
          icon={FileText}
          label="Last Report"
          value={lastReport ? relativeDate(lastReport.reportDate) : "—"}
          sub={lastReport?.title}
          href={lastReport ? `/reports/${lastReport.id}` : "/reports"}
          muted={!lastReport}
        />

        {/* Sleep */}
        {snap?.sleep?.hours ? (
          <MetricTile
            icon={Moon}
            label="Sleep"
            value={fmt(snap.sleep.hours.ema)}
            unit="h avg"
            sub={snap.sleep.quality ? `quality ${fmt(snap.sleep.quality.ema, 0)}/5` : undefined}
            trend={snap.sleep.hours.trend}
            href="/sleep"
          />
        ) : (
          <MetricTile icon={Moon} label="Sleep" value="—" sub="not logged yet" href="/sleep" muted />
        )}

        {/* Wellbeing */}
        {snap?.wellbeing?.composite ? (
          <MetricTile
            icon={Zap}
            label="Wellbeing"
            value={fmt(snap.wellbeing.composite.ema)}
            unit="/ 5"
            sub={
              snap.wellbeing.energy && snap.wellbeing.mood
                ? `⚡${fmt(snap.wellbeing.energy.ema, 0)} 😊${fmt(snap.wellbeing.mood.ema, 0)}`
                : undefined
            }
            trend={snap.wellbeing.composite.trend}
            href="/diary"
          />
        ) : (
          <MetricTile icon={Zap} label="Wellbeing" value="—" sub="log daily diary" href="/diary" muted />
        )}

        {/* Activity */}
        {snap?.activity?.weeklyMinutes ? (
          <MetricTile
            icon={Activity}
            label="Activity"
            value={fmt(snap.activity.weeklyMinutes.ema, 0)}
            unit="min/wk"
            sub={snap.activity.intensity ? `intensity ${fmt(snap.activity.intensity.ema, 0)}/5` : undefined}
            trend={snap.activity.weeklyMinutes.trend}
            href="/activity"
          />
        ) : (
          <MetricTile icon={Activity} label="Activity" value="—" sub="not logged yet" href="/activity" muted />
        )}

        {/* Diet */}
        {snap?.diet?.dailyCalories ? (
          <MetricTile
            icon={Utensils}
            label="Diet"
            value={fmt(snap.diet.dailyCalories.ema, 0)}
            unit="kcal/d"
            sub={
              snap.diet.proteinRatio
                ? `protein ${fmt(snap.diet.proteinRatio.ema * 100, 0)}%`
                : undefined
            }
            trend={snap.diet.dailyCalories.trend}
            href="/diet"
          />
        ) : (
          <MetricTile icon={Utensils} label="Diet" value="—" sub="log meals to track" href="/diet" muted />
        )}

        {/* Conditions */}
        <MetricTile
          icon={Network}
          label="Conditions"
          value={String(activeConditions)}
          sub={activeConditions === 0 ? "none tracked" : "active"}
          href="/conditions"
          muted={activeConditions === 0}
        />

        {/* Environment */}
        <EnvTile />

        {/* Body */}
        {(() => {
          const bodyMetrics = snap?.body ?? {};
          const weightMetric = bodyMetrics["weight"];
          const hasBMI = profile.data?.heightCm && weightMetric;
          const bmi = hasBMI ? weightMetric.ema / Math.pow(profile.data!.heightCm! / 100, 2) : null;
          return (
            <MetricTile
              icon={Scale}
              label="Body"
              value={weightMetric ? fmt(weightMetric.ema) : "—"}
              unit={weightMetric ? "kg" : undefined}
              sub={bmi ? `BMI ${fmt(bmi)}` : undefined}
              trend={weightMetric?.trend}
              href="/track?tab=body"
              muted={!weightMetric}
            />
          );
        })()}

        {/* Allostatic load — only if available */}
        {snap?.allosticLoad !== null && snap?.allosticLoad !== undefined ? (
          <MetricTile
            icon={Activity}
            label="Allostatic Load"
            value={fmt((snap.allosticLoad ?? 0) * 100, 0)}
            unit="%"
            sub="biomarker risk score"
            inverseTrend
          />
        ) : null}
      </div>

      <RemindersPanel />

      {/* Recent Reports */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Reports
            </CardTitle>
            <div className="flex items-center gap-2">
              <Link to="/insights?tab=graph">
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                  <Network className="h-3 w-3 mr-1" />
                  {graphStats.data?.nodeCount ?? "—"} nodes
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">View all</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {reports.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!reports.isLoading && !reports.data?.items.length && (
            <p className="text-sm text-muted-foreground">
              No reports yet.{" "}
              <Link to="/reports/new" className="underline underline-offset-2">
                Upload your first report
              </Link>
            </p>
          )}
          <div className="space-y-1.5 mt-1">
            {reports.data?.items.map((report) => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/15 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {report.tags.slice(0, 3).map((rt) => (
                      <Badge
                        key={rt.tag.id}
                        variant="secondary"
                        className="text-xs px-1.5 py-0 h-4"
                        style={rt.tag.color ? { backgroundColor: `${rt.tag.color}22`, color: rt.tag.color } : undefined}
                      >
                        {rt.tag.name}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">{relativeDate(report.reportDate)}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{report._count.entries} entries</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
