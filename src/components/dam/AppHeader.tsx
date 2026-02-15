import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Settings, Activity, Database } from "lucide-react";

const navItems = [
  { path: "/", label: "Library", icon: LayoutGrid },
  { path: "/ingestion", label: "Ingestion", icon: Database },
  { path: "/activity", label: "Activity", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

const AppHeader = () => {
  const location = useLocation();

  return (
    <header className="h-12 border-b border-border bg-sidebar flex items-center px-4 gap-6 shrink-0">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xs">D</span>
        </div>
        <span className="font-semibold text-sm text-foreground tracking-tight">DesignVault</span>
      </Link>

      <nav className="flex items-center gap-1 ml-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success" />
          NAS Connected
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
