import { Loader2 } from "lucide-react";

export function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm text-muted-foreground">Ładowanie…</p>
    </div>
  );
}
