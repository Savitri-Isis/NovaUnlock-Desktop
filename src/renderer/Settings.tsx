import { useDeviceStore } from "../store/device-store";
import NativeSetup from "../components/NativeSetup";

export default function Settings() {
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
            <span className="text-sm font-mono text-foreground">node-hid / usb 3.1</span>
          </div>
        </div>
      </div>

      <NativeSetup />

      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">Créer un installateur Windows</h3>
        <p className="text-sm text-muted">
          Depuis le dossier des sources, double-cliquez sur <code className="text-foreground">Creer-installateur-Windows.cmd</code>.
          Cet assistant séparé installe les dépendances, prépare les outils et génère les fichiers dans <code>release</code>.
          Node.js est requis sur le PC de compilation, mais pas pour utiliser NovaUnlock déjà installé.
        </p>
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
