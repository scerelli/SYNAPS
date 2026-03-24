import { useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, Utensils } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { LOG_ITEM_CLS, LogSection } from "@/components/log-row";
import { TwoColLayout } from "@/components/two-col-layout";
import { trpc } from "@/api/trpc";
import { MEAL_TYPES } from "@synaps/shared";
import type { RouterOutputs } from "@/api/trpc";

type DietLog = RouterOutputs["diet"]["list"][number];
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack",
};

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 19) return "snack";
  return "dinner";
}

function groupByDate(logs: DietLog[]) {
  const map = new Map<string, DietLog[]>();
  for (const log of logs) {
    const key = format(new Date(log.date), "EEEE, d MMM yyyy");
    const arr = map.get(key);
    if (arr) arr.push(log);
    else map.set(key, [log]);
  }
  return map;
}

export function DietTab() {
  const [mealType, setMealType] = useState<MealType>(guessMealType);
  const [description, setDescription] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();
  const { data } = trpc.diet.list.useQuery({});
  const create = trpc.diet.create.useMutation({
    onSuccess: () => { utils.diet.list.invalidate(); setDescription(""); textareaRef.current?.focus(); },
  });
  const del = trpc.diet.delete.useMutation({
    onSuccess: () => utils.diet.list.invalidate(),
  });

  function submit() {
    const text = description.trim();
    if (!text || create.isPending) return;
    create.mutate({ date: todayString(), mealType, description: text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const grouped = data ? groupByDate(data) : new Map<string, DietLog[]>();

  return (
    <TwoColLayout
        form={
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Log meal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{MEAL_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What did you eat? e.g. pasta al pomodoro, insalata mista"
                rows={4}
                autoFocus
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Calories estimated by AI · Enter to add
              </p>
              <Button size="sm" className="w-full" onClick={submit} disabled={!description.trim() || create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add meal
              </Button>
            </CardContent>
          </Card>
        }
        list={
          data?.length === 0
            ? <EmptyState icon={Utensils} text="No meals logged yet" sub="Type what you ate on the left and press Enter" />
            : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([label, logs]) => {
                  const totalCal = logs.reduce((s, l) => s + (l.calories ?? 0), 0);
                  return (
                    <LogSection key={label} date={label} sub={totalCal ? `${totalCal} kcal` : undefined}>
                      <div className="space-y-0.5">
                        {logs.map((log) => (
                          <div key={log.id} className={`flex items-start gap-3 ${LOG_ITEM_CLS}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground w-16 shrink-0">{log.mealType}</span>
                                <span className="text-sm">{log.description}</span>
                              </div>
                              {log.calories ? (
                                <div className="flex items-center gap-3 mt-0.5 ml-[4.5rem] text-xs text-muted-foreground">
                                  <span>{log.caloriesAi && "~"}{log.calories} kcal</span>
                                  {log.proteinG ? <span>P {log.proteinG}g</span> : null}
                                  {log.carbsG ? <span>C {log.carbsG}g</span> : null}
                                  {log.fatG ? <span>F {log.fatG}g</span> : null}
                                </div>
                              ) : null}
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => del.mutate({ id: log.id })} disabled={del.isPending} aria-label="Delete">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </LogSection>
                  );
                })}
              </div>
            )
        }
    />
  );
}
