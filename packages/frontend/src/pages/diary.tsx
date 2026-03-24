import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, NotebookPen, Trash2, CalendarIcon } from "lucide-react";
import { format, parseISO, subDays, addDays, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/empty-state";
import { LogRow, LogSection } from "@/components/log-row";
import { TwoColLayout } from "@/components/two-col-layout";
import { trpc } from "@/api/trpc";
import type { RouterOutputs } from "@/api/trpc";

type DiaryEntry = RouterOutputs["diary"]["list"][number];

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function ScaleInput({ id, label, value, onChange, min, max, placeHolder = "-" }: {
  id: string; label: string; value: string; placeHolder: string;
  onChange: (v: string) => void; min: number; max: number;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs flex items-center gap-1">
        {label}<span className="text-muted-foreground"> {min} – {max}</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeHolder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EntryRow({ entry, onDelete }: { entry: DiaryEntry; onDelete: () => void }) {
  const metrics = [
    entry.energyLevel != null && `⚡ ${entry.energyLevel}/5`,
    entry.moodLevel != null && `😊 ${entry.moodLevel}/5`,
    entry.painLevel != null && `🩹 ${entry.painLevel}/10${entry.painArea ? ` (${entry.painArea})` : ""}`,
  ].filter(Boolean);

  return (
    <LogRow className="items-start">
      <div className="flex-1 min-w-0 space-y-0.5">
        {metrics.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap text-sm">
            {metrics.map((m, i) => <span key={i}>{m}</span>)}
          </div>
        )}
        {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={onDelete} aria-label="Delete">
        <Trash2 className="h-3 w-3" />
      </Button>
    </LogRow>
  );
}

export function DiaryTab() {
  const [date, setDate] = useState(todayString);
  const [energy, setEnergy] = useState("");
  const [mood, setMood] = useState("");
  const [pain, setPain] = useState("");
  const [painArea, setPainArea] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const { data } = trpc.diary.list.useQuery();
  const upsert = trpc.diary.upsert.useMutation({ onSuccess: () => utils.diary.list.invalidate() });
  const del = trpc.diary.delete.useMutation({ onSuccess: () => utils.diary.list.invalidate() });

  const existingEntry = data?.find((d) => format(new Date(d.date), "yyyy-MM-dd") === date);

  useEffect(() => {
    if (existingEntry) {
      setEnergy(existingEntry.energyLevel != null ? String(existingEntry.energyLevel) : "");
      setMood(existingEntry.moodLevel != null ? String(existingEntry.moodLevel) : "");
      setPain(existingEntry.painLevel != null ? String(existingEntry.painLevel) : "");
      setPainArea(existingEntry.painArea ?? "");
      setNote(existingEntry.note ?? "");
    } else {
      setEnergy(""); setMood(""); setPain(""); setPainArea(""); setNote("");
    }
  }, [date, existingEntry?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!energy && !mood && !pain && !note.trim()) return;
    upsert.mutate({
      date,
      energyLevel: energy ? parseInt(energy) : undefined,
      moodLevel: mood ? parseInt(mood) : undefined,
      painLevel: pain ? parseInt(pain) : undefined,
      painArea: painArea.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  const [calOpen, setCalOpen] = useState(false);
  const dateLabel = isToday(parseISO(date)) ? "Today" : format(parseISO(date), "EEEE, d MMM");

  const grouped = new Map<string, DiaryEntry[]>();
  for (const entry of data ?? []) {
    const key = format(new Date(entry.date), "EEEE, d MMM yyyy");
    const arr = grouped.get(key);
    if (arr) arr.push(entry);
    else grouped.set(key, [entry]);
  }

  return (
    <TwoColLayout
        form={
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDate(format(subDays(parseISO(date), 1), "yyyy-MM-dd"))} aria-label="Previous day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="flex-1 h-7 gap-1.5 text-sm font-medium px-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {dateLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={parseISO(date)}
                      onSelect={(d) => { if (d) { setDate(format(d, "yyyy-MM-dd")); setCalOpen(false); } }}
                      disabled={(d) => d > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={date >= todayString()} onClick={() => setDate(format(addDays(parseISO(date), 1), "yyyy-MM-dd"))} aria-label="Next day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {existingEntry && <p className="text-xs text-muted-foreground text-center">Saving will update the existing entry</p>}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-3">
                  <ScaleInput placeHolder="Select energy" id="diary-energy" label="Energy" value={energy} onChange={setEnergy} min={1} max={5} />
                  <ScaleInput placeHolder="Select mood" id="diary-mood" label="Mood" value={mood} onChange={setMood} min={1} max={5} />
                  <ScaleInput placeHolder="Select pain" id="diary-pain" label="Pain" value={pain} onChange={setPain} min={0} max={10} />
                </div>
                {pain && parseInt(pain) > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="diary-pain-area" className="text-xs">Pain area</Label>
                    <Input id="diary-pain-area" value={painArea} onChange={(e) => setPainArea(e.target.value)} placeholder="e.g. head, lower back" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="diary-note" className="text-xs">Notes</Label>
                  <Textarea id="diary-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How are you feeling?" rows={3} className="resize-none" />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={(!energy && !mood && !pain && !note.trim()) || upsert.isPending}>
                  {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {existingEntry ? "Update" : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>
        }
        list={
          data?.length === 0
            ? <EmptyState icon={NotebookPen} text="No diary entries yet" sub="Start tracking your daily wellbeing on the left" />
            : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([label, entries]) => (
                  <LogSection key={label} date={label}>
                    {entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onDelete={() => del.mutate({ id: entry.id })} />
                    ))}
                  </LogSection>
                ))}
              </div>
            )
        }
    />
  );
}
