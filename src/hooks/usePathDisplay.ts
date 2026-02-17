import { useState, useCallback } from "react";

type HostMode = "hostname" | "ip";

const STORAGE_KEY = "dam-path-host-mode";
const DISPLAY_HOST = "edgesynology1";
const DISPLAY_IP = "192.168.3.100";
const SOURCE_HOST = "edgesynology2";

function getStoredMode(): HostMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ip") return "ip";
  } catch {}
  return "hostname";
}

export function usePathDisplay() {
  const [hostMode, setHostMode] = useState<HostMode>(getStoredMode);

  const toggleHostMode = useCallback(() => {
    setHostMode((prev) => {
      const next = prev === "hostname" ? "ip" : "hostname";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const displayPath = useCallback(
    (originalPath: string): string => {
      const replacement = hostMode === "hostname" ? DISPLAY_HOST : DISPLAY_IP;
      return originalPath.replace(new RegExp(SOURCE_HOST, "gi"), replacement);
    },
    [hostMode]
  );

  return { hostMode, toggleHostMode, displayPath };
}
