import { LoadingFeather } from "./LoadingFeather";

/** Shown while the app starts and prepares its database, before the first page is loaded. */
export function StartupScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 text-brand-600">
      <LoadingFeather size={56} />
      <span className="text-lg font-semibold tracking-tight">Notenfeder</span>
    </div>
  );
}
