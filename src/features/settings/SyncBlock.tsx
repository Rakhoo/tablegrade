import type { ReactNode } from "react";

type SyncBlockProps = {
  title: string;
  /** Explanation shown by the help. */
  help: string;
  children: ReactNode;
};

/** One titled block of the active sync view, set off from the one above by a line. */
export function SyncBlock({ title, help, children }: SyncBlockProps) {
  return (
    <section
      className="flex flex-col gap-2 border-t border-line pt-3"
      data-help={help}
      data-help-group
    >
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
