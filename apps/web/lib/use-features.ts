"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeaturesResponse } from "./server/account";

export type { FeaturesResponse };

/**
 * Plan y funciones de quien visita (GET /api/cuenta/funciones). Mientras carga,
 * o si el servidor no responde, `data` es null.
 */
export function useFeatures(withUsage = false) {
  const [data, setData] = useState<FeaturesResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/cuenta/funciones${withUsage ? "?uso=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as FeaturesResponse);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [withUsage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, failed, refresh };
}
