import { Download, Monitor, Server, ArrowRight, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/dam/AppHeader";

const AGENTS = [
  {
    name: "Windows Render Agent",
    description:
      "Runs on a Windows PC with Adobe Illustrator installed. Automatically generates thumbnails for .ai files saved without PDF compatibility.",
    icon: Monitor,
    version: "1.0.0",
    downloadUrl:
      "https://github.com/u2giants/P/releases/latest/download/windows-render-agent.zip",
    repoUrl: "https://github.com/u2giants/P/tree/main/windows-agent",
    requirements: [
      "Windows 10/11",
      "Adobe Illustrator 2023+",
      "Node.js 18+",
      "Tailscale (same network as NAS)",
    ],
    steps: [
      "Download and extract the agent",
      "Copy .env.example to .env and fill in credentials",
      "Run npm install",
      "Run npm start (or set up as a Windows service)",
    ],
  },
  {
    name: "Bridge Agent (Linux/Docker)",
    description:
      "Runs on the Synology NAS via Docker. Scans shared folders, generates thumbnails, and ingests assets into PopDAM.",
    icon: Server,
    version: "1.0.0",
    downloadUrl:
      "https://github.com/u2giants/P/releases/latest/download/bridge-agent.zip",
    repoUrl: "https://github.com/u2giants/P/tree/main/bridge-agent",
    requirements: [
      "Docker & Docker Compose",
      "Synology NAS or Linux server",
      "Tailscale",
      "Access to shared folders",
    ],
    steps: [
      "Clone the PopDAM repo on the NAS",
      "Configure .env with your credentials",
      "Run docker-compose up -d",
      "Verify agent appears in Settings → Agents",
    ],
  },
];

const DownloadsPage = () => {
  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto p-8 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Downloads</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Download and install PopDAM agents to connect your infrastructure
            </p>
          </div>

          {AGENTS.map((agent) => (
            <Card key={agent.name} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <agent.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {agent.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    v{agent.version}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Requirements
                  </h3>
                  <ul className="space-y-1.5">
                    {agent.requirements.map((req) => (
                      <li
                        key={req}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Setup Steps
                  </h3>
                  <ol className="space-y-1.5">
                    {agent.steps.map((step, i) => (
                      <li
                        key={step}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="font-mono text-xs text-primary mt-0.5 shrink-0 w-5">
                          {i + 1}.
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button className="gap-2" asChild>
                    <a href={agent.repoUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                      View on GitHub
                    </a>
                  </Button>
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={agent.repoUrl + "/blob/main/README.md"} target="_blank" rel="noopener noreferrer">
                      Documentation
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DownloadsPage;
