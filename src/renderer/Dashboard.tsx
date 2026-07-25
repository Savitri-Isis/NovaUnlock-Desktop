import { useEffect } from "react";
import { useDeviceStore } from "../store/device-store";

export default function Dashboard() {
  const deviceInfo = useDeviceStore((s) => s.deviceInfo);
  const connection = useDeviceStore((s) => s.connection);
  const dfuProgress = useDeviceStore((s) => s.dfuProgress);
  const logs = useDeviceStore((s) => s.logs);
  const addLog = useDeviceStore((s) => s.addLog);

  useEffect(() => {
    if (!connection.isConnected) {
      addLog({ message: "Dashboard initialisé — En attente de connexion", type: "info" });
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted">Vue d'ensemble de l'appareil et des opérations</p>
      </div>

      {/* Connection Status */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: connection.isConnected ? "#00E676" : "#8B8B9E" }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: connection.isConnected ? "#00E676" : "#8B8B9E" }}
          >
            {connection.isConnected
              ? `Appareil connecté — ${connection.currentMode.toUpperCase()}`
              : "Aucun appareil connecté"}
          </span>
        </div>

        {connection.isConnected && deviceInfo.serial && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs text-muted">Modèle</p>
              <p className="text-sm font-mono text-foreground">{deviceInfo.model || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Série</p>
              <p className="text-sm font-mono text-foreground">{deviceInfo.serial}</p>
            </div>
            <div>
              <p className="text-xs text-muted">iOS</p>
              <p className="text-sm font-mono text-foreground">{deviceInfo.iosVersion || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Batterie</p>
              <p className="text-sm font-mono text-foreground">
                {deviceInfo.batteryLevel != null ? `${deviceInfo.batteryLevel}%` : "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DFU Progress */}
      {dfuProgress.isFlashing && (
        <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
          <p className="text-sm text-muted mb-2">Opération en cours</p>
          <p className="text-xl font-bold font-mono text-accent">{dfuProgress.progress}%</p>
          <p className="text-sm text-muted mb-3">{dfuProgress.stage}</p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${dfuProgress.progress}%`, backgroundColor: "#7B2FBE" }}
            />
          </div>
          {dfuProgress.speed && (
            <p className="text-xs text-muted mt-2 font-mono">{dfuProgress.speed}</p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted mb-1">Mode actuel</p>
          <p className="text-lg font-bold font-mono" style={{ color: "#7B2FBE" }}>
            {connection.currentMode.toUpperCase()}
          </p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted mb-1">ECID</p>
          <p className="text-sm font-mono text-foreground truncate">
            {deviceInfo.ecid || "N/A"}
          </p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted mb-1">Jailbreak</p>
          <p className="text-lg font-bold font-mono" style={{ color: deviceInfo.jailbreakStatus ? "#00E676" : "#8B8B9E" }}>
            {deviceInfo.jailbreakStatus ? "OUI" : "NON"}
          </p>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-surface rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Journal</h3>
          <span className="text-xs text-muted">{logs.length} entrées</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Aucun événement</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-b-0">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{
                    backgroundColor:
                      log.type === "error" ? "#FF1744" :
                      log.type === "warning" ? "#FFC107" :
                      log.type === "success" ? "#00E676" : "#7B2FBE",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{log.message}</p>
                  <p className="text-[10px] text-muted">
                    {log.timestamp.toLocaleTimeString("fr-FR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
