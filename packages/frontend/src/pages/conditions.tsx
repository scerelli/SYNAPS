import { useState } from "react";
import { HeartPulse, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { DatePicker } from "@/components/date-picker";
import { LOG_ITEM_CLS } from "@/components/log-row";
import { TwoColLayout } from "@/components/two-col-layout";
import { trpc } from "@/api/trpc";
import type { RouterOutputs } from "@/api/trpc";

type Condition = RouterOutputs["condition"]["list"][number];

function toDateString(d: string | Date | null | undefined) {
  return d ? format(new Date(d), "yyyy-MM-dd") : "";
}

function ConditionForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [diagnosedAt, setDiagnosedAt] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);
  const [notes, setNotes] = useState("");

  const create = trpc.condition.create.useMutation({
    onSuccess: () => { setName(""); setDiagnosedAt(""); setIsCurrent(true); setNotes(""); onSuccess(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Name is required"); return; }
    setNameError("");
    create.mutate({ name: name.trim(), diagnosedAt: diagnosedAt ? new Date(diagnosedAt) : undefined, isCurrent, notes: notes.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cond-name" className="text-xs">Condition name *</Label>
        <Input
          id="cond-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          placeholder="e.g. Type 2 Diabetes"
          className={nameError ? "border-destructive" : ""}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Diagnosed date</Label>
        <DatePicker value={diagnosedAt} onChange={setDiagnosedAt} maxDate={new Date()} className="w-full" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cond-notes" className="text-xs">Notes</Label>
        <Textarea
          id="cond-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          rows={3}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox id="cond-current" checked={isCurrent} onCheckedChange={(v) => setIsCurrent(v === true)} />
          <Label htmlFor="cond-current" className="text-sm cursor-pointer">Currently active</Label>
        </div>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function ConditionRow({ condition, onUpdate, onDelete }: {
  condition: Condition; onUpdate: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(condition.name);
  const [diagnosedAt, setDiagnosedAt] = useState(toDateString(condition.diagnosedAt));
  const [resolvedAt, setResolvedAt] = useState(toDateString(condition.resolvedAt));
  const [isCurrent, setIsCurrent] = useState(condition.isCurrent);
  const [notes, setNotes] = useState(condition.notes ?? "");

  const update = trpc.condition.update.useMutation({ onSuccess: () => { setEditing(false); onUpdate(); } });
  const del = trpc.condition.delete.useMutation({ onSuccess: onDelete });

  if (editing) {
    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Diagnosed</Label>
            <DatePicker value={diagnosedAt} onChange={setDiagnosedAt} maxDate={new Date()} className="w-full" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Resolved</Label>
            <DatePicker value={resolvedAt} onChange={setResolvedAt} className="w-full" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id={`cur-${condition.id}`} checked={isCurrent} onCheckedChange={(v) => setIsCurrent(v === true)} />
            <Label htmlFor={`cur-${condition.id}`} className="text-sm cursor-pointer">Currently active</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => update.mutate({ id: condition.id, name: name.trim(), diagnosedAt: diagnosedAt ? new Date(diagnosedAt) : null, resolvedAt: resolvedAt ? new Date(resolvedAt) : null, isCurrent, notes: notes.trim() || null })} disabled={update.isPending}>Save</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-4 ${LOG_ITEM_CLS}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{condition.name}</span>
          <Badge variant={condition.isCurrent ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-4">
            {condition.isCurrent ? "Current" : "Resolved"}
          </Badge>
        </div>
        {condition.diagnosedAt && (
          <p className="text-xs text-muted-foreground">
            Diagnosed {format(new Date(condition.diagnosedAt), "d MMM yyyy")}
            {condition.resolvedAt && ` · Resolved ${format(new Date(condition.resolvedAt), "d MMM yyyy")}`}
          </p>
        )}
        {condition.notes && <p className="text-xs text-muted-foreground">{condition.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate({ id: condition.id })} disabled={del.isPending} aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ConditionsPage() {
  const { data, refetch } = trpc.condition.list.useQuery();
  const current = data?.filter((c) => c.isCurrent) ?? [];
  const resolved = data?.filter((c) => !c.isCurrent) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Conditions" />
      <TwoColLayout
        form={
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Add condition</CardTitle>
            </CardHeader>
            <CardContent>
              <ConditionForm onSuccess={() => refetch()} />
            </CardContent>
          </Card>
        }
        list={
          data?.length === 0
            ? <EmptyState icon={HeartPulse} text="No conditions recorded" sub="Add a past or current health condition on the left" />
            : (
              <div className="space-y-5">
                {current.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">Active</p>
                    <div className="space-y-0.5">
                      {current.map((c) => <ConditionRow key={c.id} condition={c} onUpdate={() => refetch()} onDelete={() => refetch()} />)}
                    </div>
                  </div>
                )}
                {resolved.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">Resolved</p>
                    <div className="space-y-0.5">
                      {resolved.map((c) => <ConditionRow key={c.id} condition={c} onUpdate={() => refetch()} onDelete={() => refetch()} />)}
                    </div>
                  </div>
                )}
              </div>
            )
        }
      />
    </div>
  );
}
