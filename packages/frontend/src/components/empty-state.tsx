import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  text,
  sub,
}: {
  icon: LucideIcon;
  text: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-30" />
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  );
}
