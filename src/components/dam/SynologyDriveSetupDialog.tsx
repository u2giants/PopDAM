import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, FolderOpen, Monitor, Apple, ClipboardPaste } from "lucide-react";
import { getSyncRoot, setSyncRoot } from "@/hooks/usePathDisplay";

interface SynologyDriveSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type DetectedOS = "mac" | "windows" | "unknown";

function detectOS(): DetectedOS {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "unknown";
}

const defaults: Record<DetectedOS, string> = {
  mac: "~/SynologyDrive/mac",
  windows: "C:\\Users\\YourName\\SynologyDrive\\mac",
  unknown: "~/SynologyDrive/mac",
};

/** Known NAS folder segments to find in a pasted path */
const KNOWN_NAS_SEGMENTS = ["mac", "Decor", "Character Licensed", "Art", "Design"];

/** Known top-level NAS folders for folder picker verification */
const KNOWN_NAS_FOLDERS = ["Decor", "mac", "Character Licensed", "Design", "Art"];

/**
 * Given a pasted file path like /Users/maria/SynologyDrive/mac/Decor/Disney/file.psd
 * detect the sync root by finding the "mac" segment (the NAS share name)
 * and returning everything up to and including it.
 */
function detectSyncRootFromPath(pastedPath: string): { root: string; matched: boolean; segment: string } {
  // Normalize to forward slashes for matching
  const normalized = pastedPath.replace(/\\/g, "/");
  
  // Look for "mac" as a path segment (the NAS share name)
  // e.g., /Users/maria/SynologyDrive/mac/Decor/... → /Users/maria/SynologyDrive/mac
  const parts = normalized.split("/");
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].toLowerCase() === "mac") {
      // Check if the next segment is a known NAS folder to confirm
      const nextSegment = parts[i + 1];
      if (nextSegment && KNOWN_NAS_SEGMENTS.some(s => s.toLowerCase() === nextSegment.toLowerCase())) {
        const root = parts.slice(0, i + 1).join("/");
        // Restore backslashes for Windows paths
        const isWindows = pastedPath.includes("\\");
        return { root: isWindows ? root.replace(/\//g, "\\") : root, matched: true, segment: `${parts[i]}/${nextSegment}` };
      }
    }
  }
  
  // Fallback: look for any known NAS folder and take everything before it
  for (let i = 0; i < parts.length; i++) {
    if (KNOWN_NAS_SEGMENTS.some(s => s.toLowerCase() === parts[i].toLowerCase()) && i > 0) {
      const root = parts.slice(0, i).join("/");
      const isWindows = pastedPath.includes("\\");
      return { root: isWindows ? root.replace(/\//g, "\\") : root, matched: true, segment: parts[i] };
    }
  }
  
  return { root: "", matched: false, segment: "" };
}

const SynologyDriveSetupDialog = ({ open, onOpenChange, onComplete }: SynologyDriveSetupDialogProps) => {
  const os = detectOS();
  const [syncRootLocal, setLocalSyncRoot] = useState(getSyncRoot() || defaults[os]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [pastedPath, setPastedPath] = useState("");

  useEffect(() => {
    if (open) {
      const existing = getSyncRoot();
      if (existing) {
        setLocalSyncRoot(existing);
        setVerified(true);
        setVerifyMessage("Previously configured.");
      } else {
        setLocalSyncRoot(defaults[os]);
        setVerified(null);
        setVerifyMessage("");
      }
      setStep("pick");
      setPastedPath("");
    }
  }, [open, os]);

  const handleBrowse = async () => {
    if ("showDirectoryPicker" in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: "read" });
        const folderNames: string[] = [];
        for await (const entry of handle.values()) {
          if (entry.kind === "directory") folderNames.push(entry.name);
          if (folderNames.length >= 20) break;
        }

        const matched = folderNames.filter((f) =>
          KNOWN_NAS_FOLDERS.some((k) => f.toLowerCase() === k.toLowerCase())
        );

        if (matched.length > 0) {
          setVerified(true);
          setVerifyMessage(`Looks correct! Found folders: ${matched.join(", ")}`);
          setStep("confirm");
        } else {
          setVerified(false);
          setVerifyMessage(
            `Couldn't find expected NAS folders (like ${KNOWN_NAS_FOLDERS.slice(0, 3).join(", ")}). Found: ${folderNames.slice(0, 5).join(", ") || "nothing"}. You may have selected the wrong folder.`
          );
          setStep("confirm");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setVerified(false);
          setVerifyMessage("Could not open folder picker. Please use one of the other options.");
          setStep("confirm");
        }
      }
    } else {
      setVerified(null);
      setVerifyMessage("Your browser doesn't support the folder picker. Please use one of the other options.");
      setStep("confirm");
    }
  };

  const handlePastePath = () => {
    if (!pastedPath.trim()) return;
    const result = detectSyncRootFromPath(pastedPath.trim());
    if (result.matched) {
      setLocalSyncRoot(result.root);
      setVerified(true);
      setVerifyMessage(`Detected sync root from path! Found "${result.segment}" segment.`);
      setStep("confirm");
    } else {
      setVerified(false);
      setVerifyMessage("Couldn't detect the sync root from that path. Please enter it manually below.");
      setStep("confirm");
    }
  };

  const handleSave = () => {
    const trimmed = syncRootLocal.trim();
    if (!trimmed) return;
    setSyncRoot(trimmed);
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Set Up Synology Drive
          </DialogTitle>
          <DialogDescription>
            Point us to your local Synology Drive folder so we can show you file paths that work on your computer.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4 py-2">
            {/* OS Detection */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {os === "mac" ? <Apple className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              <span>Detected: {os === "mac" ? "macOS" : os === "windows" ? "Windows" : "Unknown OS"}</span>
            </div>

            <div className="space-y-3">
              {/* Option 1: Paste a file path */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 text-primary" />
                  Paste any file path
                </p>
                <p className="text-xs text-muted-foreground">
                  {os === "mac"
                    ? "Right-click any file in your Synology Drive folder in Finder → \"Copy as Pathname\", then paste it here."
                    : "Shift + right-click any file in your Synology Drive folder → \"Copy as path\", then paste it here."}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={pastedPath}
                    onChange={(e) => setPastedPath(e.target.value)}
                    placeholder={os === "mac" ? "/Users/you/SynologyDrive/mac/Decor/file.psd" : "C:\\Users\\You\\SynologyDrive\\mac\\Decor\\file.psd"}
                    className="font-mono text-xs flex-1"
                  />
                  <Button size="sm" onClick={handlePastePath} disabled={!pastedPath.trim()}>
                    Detect
                  </Button>
                </div>
              </div>

              {/* Option 2: Browse */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Browse to folder
                </p>
                <p className="text-xs text-muted-foreground">
                  Select your Synology Drive sync folder directly. Works best in Chrome.
                </p>
                <Button variant="outline" onClick={handleBrowse} className="w-full gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Browse...
                </Button>
              </div>

              {/* Option 3: Type manually */}
              <button
                onClick={() => setStep("confirm")}
                className="text-xs text-muted-foreground underline hover:text-foreground w-full text-center"
              >
                I'll type the path manually
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-2">
            {verified !== null && (
              <div className={`flex items-start gap-2 text-sm rounded-md p-3 ${verified ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {verified ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{verifyMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">
                {verified ? "Confirm or edit the sync root path:" : "Enter the full path to your Synology Drive sync folder:"}
              </Label>
              <Input
                value={syncRootLocal}
                onChange={(e) => setLocalSyncRoot(e.target.value)}
                placeholder={defaults[os]}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {os === "mac"
                  ? "Usually something like ~/SynologyDrive/mac or /Users/yourname/SynologyDrive/mac"
                  : "Usually something like C:\\Users\\YourName\\SynologyDrive\\mac"}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "confirm" && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep("pick")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSave} disabled={!syncRootLocal.trim()} className="flex-1">
                Save & Enable
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SynologyDriveSetupDialog;
