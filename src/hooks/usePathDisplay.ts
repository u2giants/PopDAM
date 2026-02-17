import { useState, useCallback } from "react";

export type HostMode = "hostname" | "ip" | "synology-full" | "synology-relative";

const STORAGE_KEY = "dam-path-host-mode";
const SYNC_ROOT_KEY = "dam-synology-sync-root";
const DISPLAY_HOST = "edgesynology1";
const DISPLAY_IP = "192.168.3.100";
const SOURCE_HOST = "edgesynology2";

function getStoredMode(): HostMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ip") return "ip";
    if (stored === "synology-full") return "synology-full";
    if (stored === "synology-relative") return "synology-relative";
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
  // Remove \\host\share prefix, keep everything after the share name
  // \\edgesynology2\mac\Decor\Foo\bar.psd → Decor\Foo\bar.psd
  const normalized = uncPath.replace(/\\\\/g, "/").replace(/\\/g, "/");
  // normalized: //edgesynology2/mac/Decor/Foo/bar.psd
  const parts = normalized.replace(/^\/\//, "").split("/");
  // parts: ["edgesynology2", "mac", "Decor", "Foo", "bar.psd"]
  // Skip host + share name (first 2 segments)
  return parts.slice(2).join("/");
}

export function usePathDisplay() {
  const [hostMode, setHostMode] = useState<HostMode>(getStoredMode);

  const cycleHostMode = useCallback(() => {
    setHostMode((prev) => {
      const synologyConfigured = isSynologyConfigured();
      const modes: HostMode[] = synologyConfigured
        ? ["hostname", "ip", "synology-full", "synology-relative"]
        : ["hostname", "ip"];
      const idx = modes.indexOf(prev);
      const next = modes[(idx + 1) % modes.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: HostMode) => {
    setHostMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const displayPath = useCallback(
    (originalPath: string): string => {
      if (hostMode === "synology-relative") {
        return extractRelativePath(originalPath);
      }
      if (hostMode === "synology-full") {
        const syncRoot = getSyncRoot();
        if (!syncRoot) return extractRelativePath(originalPath);
        const relative = extractRelativePath(originalPath);
        // Join sync root + relative, normalize slashes
        const root = syncRoot.replace(/[\\/]+$/, "");
        return `${root}/${relative}`;
      }
      const replacement = hostMode === "hostname" ? DISPLAY_HOST : DISPLAY_IP;
      return originalPath.replace(new RegExp(SOURCE_HOST, "gi"), replacement);
    },
    [hostMode]
  );

  const modeLabel = useCallback((): string => {
    switch (hostMode) {
      case "hostname": return "Name";
      case "ip": return "IP";
      case "synology-full": return "Drive (Full)";
      case "synology-relative": return "Drive (Rel)";
    }
  }, [hostMode]);

  return { hostMode, cycleHostMode, setMode, displayPath, modeLabel };
}
