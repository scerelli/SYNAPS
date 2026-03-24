import { useState } from "react";
import { Scale, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { DatePicker } from "@/components/date-picker";
import { LogRow, LogSection } from "@/components/log-row";
import { TwoColLayout } from "@/components/two-col-layout";
import { trpc, type RouterOutputs } from "@/api/trpc";

type WeightLog = RouterOutputs["weight"]["list"][number];

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function groupByMonth(logs: WeightLog[]) {
  const map = new Map<string, WeightLog[]>();
  for (const log of logs) {
    const key = format(new Date(log.date), "MMMM yyyy");
    const arr = map.get(key);
    if (arr) arr.push(log);
    else map.set(key, [log]);
  }
  return map;
}

function computeBmi(weightKg: number, heightCm: number | null | undefined): string | null {
  if (!heightCm) return null;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  return bmi.toFixed(1);
}

function weightTrend(logs: WeightLog[]): string | null {
  if (logs.length < 3) return null;
  const latest = logs[0];
  const oldest = logs[logs.length - 1];
  if (!latest || !oldest) return null;
  const diff = latest.weightKg - oldest.weightKg;
  const days = Math.round(
    (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)} kg in ${days} days`;
}

export function WeightTab() {
  const [date, setDate] = useState(todayString);
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [notes, setNotes] = useState("");
  const [weightError, setWeightError] = useState("");

  const { data: profile } = trpc.profile.get.useQuery();
  const { data, refetch } = trpc.weight.list.useQuery({ limit: 90 });
  const create = trpc.weight.create.useMutation({
    onSuccess: () => {
      refetch();
      setWeightKg("");
      setBodyFatPct("");
      setWaistCm("");
      setNotes("");
      setWeightError("");
    },
  });
  const del = trpc.weight.delete.useMutation({ onSuccess: () => refetch() });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseFloat(weightKg);
    if (isNaN(kg) || kg <= 0 || kg > 500) {
      setWeightError("Enter a valid weight between 0 and 500 kg");
      return;
    }
    setWeightError("");
    create.mutate({
      date,
      weightKg: kg,
      bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : undefined,
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      notes: notes.trim() || undefined,
    });
  }

  const heightCm = profile?.heightCm;
  const trend = data ? weightTrend(data) : null;
  const grouped = data ? groupByMonth(data) : new Map<string, WeightLog[]>();

  return (
    <TwoColLayout
      form={
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Log weight</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label className="text-xs">Date</Label>
                <DatePicker value={date} onChange={setDate} maxDate={new Date()} className="w-full" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="weight-kg">Weight (kg)</Label>
                <Input
                  id="weight-kg"
                  type="number"
                  min={0}
                  max={500}
                  step={0.1}
                  value={weightKg}
                  onChange={(e) => { setWeightKg(e.target.value); setWeightError(""); }}
                  placeholder="70.0"
                  className={weightError ? "border-destructive" : ""}
                />
                {weightError && <p className="text-xs text-destructive">{weightError}</p>}
              </div>
              <div>
                <Label className="text-xs" htmlFor="body-fat">Body fat (%)</Label>
                <Input
                  id="body-fat"
                  type="number"
                  min={1}
                  max={70}
                  step={0.1}
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                  placeholder="-"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="waist-cm">Waist (cm)</Label>
                <Input
                  id="waist-cm"
                  type="number"
                  min={0}
                  max={300}
                  step={0.5}
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                  placeholder="-"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="weight-notes">Notes</Label>
                <Textarea
                  id="weight-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save"}
              </Button>
            </form>
          </CardContent>
        </Card>
      }
      list={
        data?.length === 0
          ? <EmptyState icon={Scale} text="No weight logs yet" sub="Log your first measurement above" />
          : (
            <div className="space-y-5">
              {trend && (
                <p className="text-xs text-muted-foreground px-1">Trend: {trend}</p>
              )}
              {Array.from(grouped.entries()).map(([label, logs]) => (
                <LogSection key={label} date={label}>
                  {logs.map((log) => {
                    const bmi = computeBmi(log.weightKg, heightCm);
                    return (
                      <LogRow key={log.id}>
                        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium">{log.weightKg} kg</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(log.date), "d MMM")}</span>
                          {bmi && (
                            <span className="text-xs text-muted-foreground">BMI {bmi}</span>
                          )}
                          {log.bodyFatPct != null && (
                            <span className="text-xs text-muted-foreground">{log.bodyFatPct}% fat</span>
                          )}
                          {log.waistCm != null && (
                            <span className="text-xs text-muted-foreground">{log.waistCm} cm waist</span>
                          )}
                          {log.notes && (
                            <span className="text-xs text-muted-foreground">{log.notes}</span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={() => del.mutate({ id: log.id })}
                          disabled={del.isPending}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </LogRow>
                    );
                  })}
                </LogSection>
              ))}
            </div>
          )
      }
    />
  );
}
