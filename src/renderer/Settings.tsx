import { useDeviceStore } from "../store/device-store";

export default function Settings() {
  const isLibimobiledeviceInstalled = useDeviceStore((s) => s.isLibimobiledeviceInstalled);
  const connection = useDeviceStore((s) => s.connection);
  const logs = useDeviceStore((s) => s.logs);
  const clearLogs = useDeviceStore((s) => s.clearLogs);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Paramètres</h2>
        <p className="text-sm text-muted">Configuration de NovaUnlock Desktop</p>
      </div>

      {/* App Info */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Application</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted">Version</span>
            <span className="text-sm font-mono text-foreground">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Plateforme</span>
            <span className="text-sm font-mono text-foreground">Windows x64</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Framework</span>
            <span className="text-sm font-mono text-foreground">Electron</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Moteur USB</span>
            <span className="text-sm font-mono text-foreground">node-hid / node-usb</span>
          </div>
        </div>
      </div>

      {/* libimobiledevice */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          libimobiledevice
        </h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-foreground">Statut d'installation</p>
            <p className="text-xs text-muted">Requis pour les opérations USB avancées</p>
          </div>
          <span
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: isLibimobiledeviceInstalled ? "#00E67620" : "#8B8B9E20",
              color: isLibimobiledeviceInstalled ? "#00E676" : "#8B8B9E",
            }}
          >
            {isLibimobiledeviceInstalled ? "Installé" : "Non installé"}
          </span>
        </div>
        <div className="mt-3 p-3 bg-background rounded-lg">
          <p className="text-xs text-muted">
            Dossier: <span className="font-mono">native/libimobiledevice/</span>
          </p>
          <p className="text-xs text-muted mt-1">
            Binaires: ideviceinfo, irecovery, idevicerestore, idevice_id
          </p>
        </div>
      </div>

      {/* USB Preferences */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Préférences USB
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted">Vendor ID</span>
            <span className="text-sm font-mono text-foreground">0x05AC (Apple)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Mode DFU</span>
            <span className="text-sm font-mono text-foreground">0x1281</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Mode Recovery</span>
            <span className="text-sm font-mono text-foreground">0x1282</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Mode Normal</span>
            <span className="text-sm font-mono text-foreground">0x1290</span>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Connexion
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted">Statut</span>
            <span
              className="text-sm font-semibold"
              style={{ color: connection.isConnected ? "#00E676" : "#8B8B9E" }}
            >
              {connection.isConnected ? "Connecté" : "Déconnecté"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Mode</span>
            <span className="text-sm font-mono text-foreground">
              {connection.currentMode.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-surface rounded-2xl p-5 border border-border">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Journal ({logs.length})
          </h3>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs text-muted hover:text-foreground"
            >
              Effacer
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Aucun événement</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-2 py-1 border-b border-border/50 last:border-b-0">
                <span className="text-xs text-muted shrink-0 w-16">
                  {log.timestamp.toLocaleTimeString("fr-FR")}
                </span>
                <span className="text-xs text-foreground flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
