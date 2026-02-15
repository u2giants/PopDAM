import { Settings as SettingsIcon, Server, Image, Clock, Sparkles, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import AppHeader from "@/components/dam/AppHeader";

const SettingsPage = () => {
  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure your DesignVault instance</p>
          </div>

          {/* NAS Connection */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" />
                NAS Connection
              </CardTitle>
              <CardDescription>Configure your Synology NAS connection via Tailscale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">NAS Hostname / Tailscale IP</Label>
                <Input defaultValue="nas01.tail12345.ts.net" className="bg-secondary border-border font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Base Share Path</Label>
                <Input defaultValue="/volume1/Designs" className="bg-secondary border-border font-mono text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Connection Status</p>
                  <p className="text-xs text-muted-foreground">Last checked 2 minutes ago</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm text-success">Connected</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingestion */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Ingestion Settings
              </CardTitle>
              <CardDescription>Control which files are scanned and cataloged</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Only ingest files from the last (years)</Label>
                <Input type="number" defaultValue="6" className="bg-secondary border-border w-24 font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">File types to scan</Label>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="font-mono">.psd</Button>
                  <Button variant="secondary" size="sm" className="font-mono">.ai</Button>
                  <Button variant="outline" size="sm" className="font-mono text-muted-foreground">+ Add type</Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-sync schedule</p>
                  <p className="text-xs text-muted-foreground">Scan NAS for new/changed files</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Thumbnails */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="h-4 w-4 text-primary" />
                Thumbnail & Preview
              </CardTitle>
              <CardDescription>Configure generated image sizes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Thumbnail size (px)</Label>
                  <Input type="number" defaultValue="300" className="bg-secondary border-border font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Preview size (px)</Label>
                  <Input type="number" defaultValue="1200" className="bg-secondary border-border font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Image quality (%)</Label>
                <Input type="number" defaultValue="85" className="bg-secondary border-border w-24 font-mono" />
              </div>
            </CardContent>
          </Card>

          {/* AI Tagging */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Tagging
              </CardTitle>
              <CardDescription>Configure automatic AI-powered tagging of assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-tag new assets</p>
                  <p className="text-xs text-muted-foreground">Use AI to identify characters, scenes, and product types</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Write tags to XMP metadata</p>
                  <p className="text-xs text-muted-foreground">Write AI-generated tags back to the file's XMP metadata</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Preserve modified date</p>
                  <p className="text-xs text-muted-foreground">Restore file modification timestamp after writing metadata</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Safety & Permissions
              </CardTitle>
              <CardDescription>Control what the system can do with your files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Read-only file access</p>
                  <p className="text-xs text-muted-foreground">System can only read files, never modify content</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Allow XMP metadata writes only</p>
                  <p className="text-xs text-muted-foreground">Permit writing metadata tags but nothing else</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <div className="pb-8">
            <Button className="w-full">Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
