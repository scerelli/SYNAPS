import { useState } from "react";
import { Link } from "react-router";
import { CalendarIcon, ChevronDown, FileText, Plus, Search, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LOG_ITEM_CLS } from "@/components/log-row";
import { trpc } from "@/api/trpc";
import type { RouterOutputs } from "@/api/trpc";

type Tag = RouterOutputs["tag"]["list"][number];

function TagSelector({
  tags,
  selected,
  onToggle,
}: {
  tags: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = tags.filter((t) => !selected.includes(t.id));

  if (available.length === 0 && selected.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          Tags
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">All tags selected</p>
        ) : (
          <div className="space-y-0.5">
            {available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                onClick={() => { onToggle(tag.id); setOpen(false); }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm">{tag.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DateRangeSelector({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: Date | undefined;
  to: Date | undefined;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasRange = from || to;

  const label = hasRange
    ? [from && format(from, "d MMM yyyy"), to && format(to, "d MMM yyyy")]
        .filter(Boolean)
        .join(" → ")
    : "Date range";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 text-xs ${hasRange ? "border-primary/60 text-foreground" : ""}`}
        >
          <CalendarIcon className="h-3 w-3 opacity-60" />
          {label}
          {hasRange && (
            <span
              className="ml-0.5 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onFromChange(undefined); onToChange(undefined); }}
              aria-label="Clear dates"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">From</p>
            <Calendar
              mode="single"
              selected={from}
              onSelect={onFromChange}
              disabled={to ? (d) => d > to : undefined}
            />
          </div>
          <Separator orientation="vertical" />
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">To</p>
            <Calendar
              mode="single"
              selected={to}
              onSelect={onToChange}
              disabled={from ? (d) => d < from : undefined}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReportsPage() {
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const tags = trpc.tag.list.useQuery();
  const reports = trpc.report.list.useQuery({
    limit: 30,
    search: search || undefined,
    tagIds: tagIds.length ? tagIds : undefined,
    dateFrom,
    dateTo,
  });

  const tagMap = new Map(tags.data?.map((t) => [t.id, t]) ?? []);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  const hasFilters = search || tagIds.length > 0 || dateFrom || dateTo;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Reports"
        action={
          <Link to="/reports/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New
            </Button>
          </Link>
        }
      />

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeSelector
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />
          <TagSelector
            tags={tags.data ?? []}
            selected={tagIds}
            onToggle={toggleTag}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setTagIds([]); setDateFrom(undefined); setDateTo(undefined); }}
            >
              Clear all
            </Button>
          )}
        </div>

        {tagIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagIds.map((id) => {
              const tag = tagMap.get(id);
              if (!tag) return null;
              return (
                <button key={id} type="button" onClick={() => toggleTag(id)}>
                  <Badge
                    className="gap-1 h-5 text-xs cursor-pointer"
                    style={{ backgroundColor: `${tag.color}25`, color: tag.color, borderColor: `${tag.color}50` }}
                  >
                    {tag.name}
                    <X className="h-2.5 w-2.5" />
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {reports.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!reports.isLoading && reports.data?.items.length === 0 && (
        <EmptyState
          icon={FileText}
          text={hasFilters ? "No reports match" : "No reports yet"}
          sub={!hasFilters ? "Upload your first report to get started" : "Try adjusting your filters"}
        />
      )}

      <div className="space-y-1.5">
        {reports.data?.items.map((report) => (
          <Link
            key={report.id}
            to={`/reports/${report.id}`}
            className={`flex items-start gap-4 py-3 px-3 rounded-lg ${LOG_ITEM_CLS}`}
          >
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-medium text-sm leading-snug">{report.title}</p>
              {report.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {report.tags.map(({ tag }) => (
                    <Badge
                      key={tag.id}
                      className="text-xs px-1.5 py-0 h-4"
                      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-sm text-muted-foreground">{format(new Date(report.reportDate), "d MMM yyyy")}</p>
              <p className="text-xs text-muted-foreground">{report._count.entries} entries</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
