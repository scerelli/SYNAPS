import type { ReactNode } from "react";

export function TwoColLayout({
  form,
  list,
}: {
  form: ReactNode;
  list: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 items-start">
      <div className="md:sticky md:top-20">{form}</div>
      <div>{list}</div>
    </div>
  );
}
