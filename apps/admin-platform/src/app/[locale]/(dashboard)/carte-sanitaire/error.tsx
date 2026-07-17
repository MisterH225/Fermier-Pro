"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CarteSanitaireError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[carte-sanitaire]", error);
  }, [error]);

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          Impossible d&apos;afficher la carte sanitaire
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Une erreur est survenue lors du chargement de cette page. Réessayez
          ou revenez plus tard.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
