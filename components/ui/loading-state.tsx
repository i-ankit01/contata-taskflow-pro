import { Loader2 } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-foreground" aria-hidden="true" />
        <span>Loading {label}</span>
      </div>
    </div>
  );
}