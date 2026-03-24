import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const LOG_ITEM_CLS = "px-3 py-2.5 rounded-lg bg-muted/15 hover:bg-muted/40 transition-colors group";

export function LogRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        cn("flex items-center gap-3", LOG_ITEM_CLS),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LogSection({
  date,
  sub,
  children,
}: {
  date: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {date}
        </span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
