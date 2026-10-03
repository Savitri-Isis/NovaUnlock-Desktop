import { Link, useLocation } from "react-router-dom";
import { useDeviceStore } from "../store/device-store";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "D" },
  { path: "/master", label: "Maître", icon: "M" },
  { path: "/connect", label: "Connecter", icon: "C" },
  { path: "/dfu", label: "DFU Mode", icon: "DF" },
  { path: "/recovery", label: "Recovery", icon: "R" },
  { path: "/firmware", label: "Firmware", icon: "FW" },
  { path: "/device-info", label: "Infos", icon: "I" },
  { path: "/settings", label: "Settings", icon: "S" },
];

export default function Sidebar() {
  const location = useLocation();
  const connection = useDeviceStore((s) => s.connection);

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">NovaUnlock</h1>
            <p className="text-xs text-muted">v1.0.0 Desktop</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: connection.isConnected ? "#00E676" : "#8B8B9E" }}
          />
          <span className="text-xs text-muted">
            {connection.isConnected
              ? `Connecté (${connection.currentMode.toUpperCase()})`
              : "Déconnecté"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-border/50"
              }`}
            >
              <span
                className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? "bg-primary text-white"
                    : "bg-border/50 text-muted"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted">
          Windows • Electron • node-hid
        </p>
      </div>
    </aside>
  );
}
