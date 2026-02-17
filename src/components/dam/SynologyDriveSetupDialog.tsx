import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, FolderOpen, Monitor, Apple } from "lucide-react";
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

/** Known top-level NAS folders to verify the selected directory */
const KNOWN_NAS_FOLDERS = ["Decor", "mac", "Character Licensed", "Design", "Art"];

const SynologyDriveSetupDialog = ({ open, onOpenChange, onComplete }: SynologyDriveSetupDialogProps) => {
  const os = detectOS();
  const [syncRoot, setLocalSyncRoot] = useState(getSyncRoot() || defaults[os]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [step, setStep] = useState<"pick" | "confirm">("pick");

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
    }
  }, [open, os]);

  const handleBrowse = async () => {
    // Use Chrome's Directory Picker API if available
    if ("showDirectoryPicker" in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: "read" });
        // Read top-level folder names to verify it looks like the NAS structure
        const folderNames: string[] = [];
        for await (const entry of handle.values()) {
          if (entry.kind === "directory") {
            folderNames.push(entry.name);
          }
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
          setVerifyMessage("Could not open folder picker. Please type the path manually below.");
          setStep("confirm");
        }
      }
    } else {
      // Fallback for non-Chrome browsers
      setVerified(null);
      setVerifyMessage("Your browser doesn't support the folder picker. Please type your Synology Drive path below.");
      setStep("confirm");
    }
  };

  const handleSave = () => {
    const trimmed = syncRoot.trim();
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
              <p className="text-sm text-foreground">
                Click the button below and navigate to your <strong>Synology Drive</strong> sync folder — the one that mirrors the server files.
              </p>
              <Button onClick={handleBrowse} className="w-full gap-2">
                <FolderOpen className="h-4 w-4" />
                Browse to Synology Drive Folder
              </Button>
              <button
                onClick={() => setStep("confirm")}
                className="text-xs text-muted-foreground underline hover:text-foreground w-full text-center"
              >
                I'll type the path instead
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-2">
            {/* Verification result */}
            {verified !== null && (
              <div className={`flex items-start gap-2 text-sm rounded-md p-3 ${verified ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {verified ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{verifyMessage}</span>
              </div>
            )}

            {!verified && verifyMessage && (
              <div className="flex items-start gap-2 text-sm rounded-md p-3 bg-muted text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{verifyMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">
                {verified
                  ? "Confirm or edit the path to your Synology Drive folder:"
                  : "Enter the full path to your Synology Drive sync folder:"}
              </Label>
              <Input
                value={syncRoot}
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
              <Button onClick={handleSave} disabled={!syncRoot.trim()} className="flex-1">
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
