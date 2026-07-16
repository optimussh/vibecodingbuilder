import { useCallback, useEffect, useState } from "react";

export interface PanelWidths {
  sessions: number;
  files: number;
  rag: number;
}

const STORAGE_KEY = "vibe.panelWidths.v1";

const DEFAULTS: PanelWidths = {
  sessions: 200,
  files: 220,
  rag: 240,
};

const LIMITS = {
  sessions: { min: 140, max: 420 },
  files: { min: 160, max: 480 },
  rag: { min: 160, max: 480 },
} as const;

function clamp(key: keyof PanelWidths, value: number): number {
  const { min, max } = LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

function load(): PanelWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      sessions: clamp("sessions", parsed.sessions ?? DEFAULTS.sessions),
      files: clamp("files", parsed.files ?? DEFAULTS.files),
      rag: clamp("rag", parsed.rag ?? DEFAULTS.rag),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function usePanelWidths() {
  const [widths, setWidths] = useState<PanelWidths>(() => load());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }, [widths]);

  const setPanel = useCallback((key: keyof PanelWidths, value: number) => {
    setWidths((w) => ({ ...w, [key]: clamp(key, value) }));
  }, []);

  /** Apply delta without stale closure (for drag resize) */
  const adjustPanel = useCallback((key: keyof PanelWidths, delta: number) => {
    setWidths((w) => ({ ...w, [key]: clamp(key, w[key] + delta) }));
  }, []);

  const reset = useCallback(() => {
    setWidths({ ...DEFAULTS });
  }, []);

  return { widths, setPanel, adjustPanel, reset, defaults: DEFAULTS, limits: LIMITS };
}
