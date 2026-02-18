import { useState, useCallback } from "react";

export type AccessMode = "office" | "remote";
export type HostMode = "hostname" | "ip";

const ACCESS_MODE_KEY = "dam-access-mode";
const HOST_MODE_KEY = "dam-path-host-mode";
const SYNC_ROOT_KEY = "dam-synology-sync-root";

// Configurable via environment variables, with backward-compatible defaults
const SOURCE_HOST = import.meta.env.VITE_SOURCE_HOST || "edgesynology2";
const DISPLAY_HOST = import.meta.env.VITE_DISPLAY_HOST || "edgesynology1";
const DISPLAY_IP = import.meta.env.VITE_DISPLAY_IP || "192.168.3.100";

function getStoredAccessMode(): AccessMode {
  try {
    const stored = localStorage.getItem(ACCESS_MODE_KEY);
    if (stored === "remote") return "remote";
  } catch {}
  return "office";
}

function getStoredHostMode(): HostMode {
  try {
    const stored = localStorage.getItem(HOST_MODE_KEY);
    if (stored === "ip") return "ip";
  } catch {}
  return "hostname";
}

export function getSyncRoot(): string {
  try {
    return localStorage.getItem(SYNC_ROOT_KEY) || "";
  } catch {
    return "";
  }
}

export function setSyncRoot(root: string): void {
  localStorage.setItem(SYNC_ROOT_KEY, root);
}

export function isSynologyConfigured(): boolean {
  return getSyncRoot().length > 0;
}

/** Extract the relative NAS path from a UNC path like \\edgesynology2\mac\Decor\... → Decor/... */
function extractRelativePath(uncPath: string): string {
  const normalized = uncPath.replace(/\\\\/g, "/").replace(/\\/g, "/");
  const parts = normalized.replace(/^\/\//, "").split("/");
  // Skip host + share name (first 2 segments)
  return parts.slice(2).join("/");
}

export function usePathDisplay() {
  const [accessMode, setAccessModeState] = useState<AccessMode>(getStoredAccessMode);
  const [hostMode, setHostModeState] = useState<HostMode>(getStoredHostMode);

  const setAccessMode = useCallback((mode: AccessMode) => {
    setAccessModeState(mode);
    localStorage.setItem(ACCESS_MODE_KEY, mode);
  }, []);

  const toggleHostMode = useCallback(() => {
    setHostModeState((prev) => {
      const next = prev === "hostname" ? "ip" : "hostname";
      localStorage.setItem(HOST_MODE_KEY, next);
      return next;
    });
  }, []);

  const displayPath = useCallback(
    (originalPath: string): string => {
      if (accessMode === "remote") {
        const syncRoot = getSyncRoot();
        if (!syncRoot) return extractRelativePath(originalPath);
        const relative = extractRelativePath(originalPath);
        const root = syncRoot.replace(/[\\/]+$/, "");
        return `${root}/${relative}`;
      }
      // Office mode: SMB path with hostname or IP
      const replacement = hostMode === "hostname" ? DISPLAY_HOST : DISPLAY_IP;
      return originalPath.replace(new RegExp(SOURCE_HOST, "gi"), replacement);
    },
    [accessMode, hostMode]
  );

  return { accessMode, setAccessMode, hostMode, toggleHostMode, displayPath };
}
