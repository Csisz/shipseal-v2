import { useEffect, useState, type ReactNode } from 'react';

interface ResultWorkspaceDisclosureProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  lazyMount?: boolean;
}

export function ResultWorkspaceDisclosure({
  title,
  children,
  defaultOpen = false,
  lazyMount = false,
}: ResultWorkspaceDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hasOpened, setHasOpened] = useState(defaultOpen);

  useEffect(() => {
    if (!defaultOpen) return;
    setOpen(true);
    setHasOpened(true);
  }, [defaultOpen]);

  return (
    <details
      open={open}
      className="mb-8 rounded-2xl border border-border/60 bg-secondary/15 p-4"
    >
      <summary
        className="cursor-pointer select-none font-display font-semibold text-foreground"
        onClick={event => {
          event.preventDefault();
          setHasOpened(true);
          setOpen(current => !current);
        }}
      >
        {title}
      </summary>
      {(!lazyMount || hasOpened) && <div className="mt-5">{children}</div>}
    </details>
  );
}
