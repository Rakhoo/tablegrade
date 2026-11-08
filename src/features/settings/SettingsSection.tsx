import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  hint?: string;
  /** Explanation shown by the help. */
  help: string;
  children: ReactNode;
};

/** Card of one topic on the settings page. */
export function SettingsSection({
  title,
  hint,
  help,
  children,
}: SettingsSectionProps) {
  return (
    <section
      className="card flex flex-col gap-3 p-5"
      data-help={help}
      data-help-place="inside"
    >
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
