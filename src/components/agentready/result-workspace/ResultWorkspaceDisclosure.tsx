import type { ReactNode } from 'react';

interface ResultWorkspaceDisclosureProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function ResultWorkspaceDisclosure({
  title,
  children,
  defaultOpen = false,
}: ResultWorkspaceDisclosureProps) {
  return (
    <details open={defaultOpen || undefined} className="mb-8 rounded-2xl border border-border/60 bg-secondary/15 p-4">
      <summary className="cursor-pointer select-none font-display font-semibold text-foreground">
        {title}
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}
