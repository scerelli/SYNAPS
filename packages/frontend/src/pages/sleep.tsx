import { useState } from "react";
import { Moon, Trash2 } from "lucide-react";
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
import type { RouterOutputs } from "@/api/trpc";
import { Textarea } from "@/components/ui/textarea";

type SleepLog = RouterOutputs["sleep"]["list"][number];

const QUALITY_LABELS: Record<number, string> = {
  1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent",
};

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function groupByDate(logs: SleepLog[]) {
  const map = new Map<string, SleepLog[]>();
  for (const log of logs) {
    const key = format(new Date(log.date), "EEEE, d MMM yyyy");
    const arr = map.get(key);
    if (arr) arr.push(log);
    else map.set(key, [log]);
  }
  return map;
}

export function SleepTab() {
  const [date, setDate] = useState(todayString);
  const [hours, setHours] = useState("");
  const [quality, setQuality] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [hoursError, setHoursError] = useState("");

  const { data, refetch } = trpc.sleep.list.useQuery();
  const upsert = trpc.sleep.upsert.useMutation({
    onSuccess: () => { refetch(); setHours(""); setQuality(""); setNotes(""); },
  });
  const del = trpc.sleep.delete.useMutation({ onSuccess: () => refetch() });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) { setHoursError("Enter a value between 0 and 24"); return; }
    setHoursError("");
    upsert.mutate({ date, hoursSlept: h, quality: quality ? parseInt(quality) : undefined, notes: notes.trim() || undefined });
  }

  const grouped = data ? groupByDate(data) : new Map<string, SleepLog[]>();

  return (
    <TwoColLayout
        form={
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Log sleep</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <DatePicker value={date} onChange={setDate} maxDate={new Date()} className="w-full" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="sleep-hours">Hours slept</Label>
                  <Input
                    id="sleep-hours"
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={hours}
                    onChange={(e) => { setHours(e.target.value); setHoursError(""); }}
                    placeholder="7.5"
                    className={hoursError ? "border-destructive" : ""}
                  />
                  {hoursError && <p className="text-xs text-destructive">{hoursError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quality</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((q) => (
                        <SelectItem key={q} value={String(q)}>{q} - {QUALITY_LABELS[q]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="sleep-notes">Notes</Label>
                  <Textarea
                    id="sleep-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving…" : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>
        }
        list={
          data?.length === 0
            ? <EmptyState icon={Moon} text="No sleep logs yet" sub="Log your first night above" />
            : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([label, logs]) => (
                  <LogSection key={label} date={label}>
                    {logs.map((log) => (
                      <LogRow key={log.id}>
                        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium">{log.hoursSlept}h</span>
                          {log.quality && (
                            <span className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map((d) => (
                                <span key={d} className={`h-1.5 w-1.5 rounded-full ${d <= log.quality! ? "bg-amber-400" : "bg-muted"}`} />
                              ))}
                              <span className="text-xs text-muted-foreground ml-1">{QUALITY_LABELS[log.quality]}</span>
                            </span>
                          )}
                          {log.notes && <span className="text-xs text-muted-foreground">{log.notes}</span>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => del.mutate({ id: log.id })} disabled={del.isPending} aria-label="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </LogRow>
                    ))}
                  </LogSection>
                ))}
              </div>
            )
        }
    />
  );
}
