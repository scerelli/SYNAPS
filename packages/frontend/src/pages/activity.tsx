import { useState } from "react";
import { Activity, Bike, Dumbbell, Footprints, Loader2, PersonStanding, Trash2, Waves } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { DatePicker } from "@/components/date-picker";
import { LogRow, LogSection } from "@/components/log-row";
import { TwoColLayout } from "@/components/two-col-layout";
import { trpc } from "@/api/trpc";
import { ACTIVITY_TYPES } from "@synaps/shared";
import type { RouterOutputs } from "@/api/trpc";

type ActivityLog = RouterOutputs["activity"]["list"][number];
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: "Running", walk: "Walking", gym: "Gym", swim: "Swimming",
  cycling: "Cycling", yoga: "Yoga", sport: "Sport", other: "Other",
};

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  run: <Footprints className="h-3.5 w-3.5" />,
  walk: <PersonStanding className="h-3.5 w-3.5" />,
  gym: <Dumbbell className="h-3.5 w-3.5" />,
  swim: <Waves className="h-3.5 w-3.5" />,
  cycling: <Bike className="h-3.5 w-3.5" />,
  yoga: <PersonStanding className="h-3.5 w-3.5" />,
  sport: <Dumbbell className="h-3.5 w-3.5" />,
  other: <Activity className="h-3.5 w-3.5" />,
};

const INTENSITY_LABELS = ["", "Very light", "Light", "Moderate", "Hard", "Max effort"];

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function groupByDate(logs: ActivityLog[]) {
  const map = new Map<string, ActivityLog[]>();
  for (const log of logs) {
    const key = format(new Date(log.date), "EEEE, d MMM yyyy");
    const arr = map.get(key);
    if (arr) arr.push(log);
    else map.set(key, [log]);
  }
  return map;
}

export function ActivityTab() {
  const [date, setDate] = useState(todayString);
  const [activityType, setActivityType] = useState<ActivityType>("run");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<string>("3");
  const [durationError, setDurationError] = useState("");

  const utils = trpc.useUtils();
  const { data } = trpc.activity.list.useQuery();
  const create = trpc.activity.create.useMutation({
    onSuccess: () => { utils.activity.list.invalidate(); setDuration(""); setDurationError(""); },
  });
  const del = trpc.activity.delete.useMutation({
    onSuccess: () => utils.activity.list.invalidate(),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mins = parseInt(duration);
    if (!mins || mins < 1) { setDurationError("Enter a duration in minutes"); return; }
    setDurationError("");
    create.mutate({ date, activityType, durationMinutes: mins, intensityLevel: intensity ? parseInt(intensity) : undefined });
  }

  const grouped = data ? groupByDate(data) : new Map<string, ActivityLog[]>();

  return (
    <TwoColLayout
        form={
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Log activity</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <DatePicker value={date} onChange={setDate} maxDate={new Date()} className="w-full" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Activity</Label>
                  <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="act-duration">Duration (min)</Label>
                  <Input
                    id="act-duration"
                    type="number"
                    min={1}
                    max={1440}
                    value={duration}
                    onChange={(e) => { setDuration(e.target.value); setDurationError(""); }}
                    placeholder="30"
                    className={durationError ? "border-destructive" : ""}
                  />
                  {durationError && <p className="text-xs text-destructive">{durationError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Intensity</Label>
                  <Select value={intensity} onValueChange={setIntensity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} - {INTENSITY_LABELS[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={!duration || create.isPending}>
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
        }
        list={
          data?.length === 0
            ? <EmptyState icon={Activity} text="No activity logged yet" sub="Log your first session on the left" />
            : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([label, logs]) => {
                  const totalMins = logs.reduce((s, l) => s + l.durationMinutes, 0);
                  return (
                    <LogSection key={label} date={label} sub={`${totalMins} min`}>
                      {logs.map((log) => (
                        <LogRow key={log.id}>
                          <span className="text-muted-foreground shrink-0">
                            {ACTIVITY_ICONS[log.activityType as ActivityType] ?? <Activity className="h-3.5 w-3.5" />}
                          </span>
                          <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-medium">{ACTIVITY_LABELS[log.activityType as ActivityType] ?? log.activityType}</span>
                            <span className="text-sm text-muted-foreground">{log.durationMinutes} min</span>
                            {log.intensityLevel && <span className="text-xs text-muted-foreground">{INTENSITY_LABELS[log.intensityLevel]}</span>}
                            {log.notes && <span className="text-xs text-muted-foreground">{log.notes}</span>}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => del.mutate({ id: log.id })} disabled={del.isPending} aria-label="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </LogRow>
                      ))}
                    </LogSection>
                  );
                })}
              </div>
            )
        }
    />
  );
}
