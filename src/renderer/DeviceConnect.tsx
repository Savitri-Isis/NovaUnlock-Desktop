import { useState } from "react";
import { useDeviceStore } from "../store/device-store";
import { DeviceDetector } from "../lib/usb/DeviceDetector";

export default function DeviceConnect() {
  const [isInstallingLib, setIsInstallingLib] = useState(false);
  const connection = useDeviceStore((s) => s.connection);
  const deviceInfo = useDeviceStore((s) => s.deviceInfo);
  const isLibimobiledeviceInstalled = useDeviceStore((s) => s.isLibimobiledeviceInstalled);
  const setLibimobiledeviceInstalled = useDeviceStore((s) => s.setLibimobiledeviceInstalled);

  const handleScan = async () => {
    await DeviceDetector.scan();
  };

  const handleInstallLib = async () => {
    setIsInstallingLib(true);
    try {
      const result = await window.novaunlock.installLibimobiledevice();
      setLibimobiledeviceInstalled(result.status.diagnosticsReady);
      alert(result.message);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsInstallingLib(false);
    }
  };

  const handleDisconnect = async () => {
    if (connection.deviceId == null) {
      alert("Aucun endpoint USB actif à déconnecter.");
      return;
    }
    await DeviceDetector.disconnect(connection.deviceId);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Connexion USB</h2>
        <p className="text-sm text-muted">Connectez un appareil iOS via USB</p>
      </div>

      {/* Status */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: connection.isConnected ? "#00E676" : connection.isSearching ? "#FFC107" : "#8B8B9E" }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: connection.isConnected ? "#00E676" : connection.isSearching ? "#FFC107" : "#8B8B9E" }}
          >
            {connection.isSearching
              ? "Recherche en cours..."
              : connection.isConnected
              ? "Appareil connecté"
              : "Déconnecté"}
          </span>
        </div>

        {connection.isConnected && deviceInfo.serial && (
          <div className="mt-4 p-3 bg-background rounded-lg">
            <p className="text-sm font-mono text-foreground">
              {deviceInfo.model} — {deviceInfo.serial}
            </p>
            <p className="text-xs text-muted mt-1">
              Mode: {connection.currentMode.toUpperCase()} • iOS {deviceInfo.iosVersion || "N/A"}
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Instructions</h3>
        <div className="space-y-3">
          {[
            { step: 1, title: "Branchez le câble USB", desc: "Connectez votre iPhone/iPad au PC Windows via USB." },
            { step: 2, title: "Autorisez la connexion", desc: "Acceptez « Faire confiance à cet ordinateur » sur l'iPhone." },
            { step: 3, title: "Cliquez sur Rechercher", desc: "NovaUnlock détectera automatiquement l'appareil." },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* libimobiledevice */}
      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">libimobiledevice</h3>
            <p className="text-xs text-muted">
              {isLibimobiledeviceInstalled
                ? "Diagnostic disponible — vérifiez les capacités dans Maître"
                : "Importez le paquet Windows x64 officiel pour les opérations USB"}
            </p>
          </div>
          <button
            onClick={handleInstallLib}
            disabled={isInstallingLib}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50"
          >
            {isInstallingLib ? "Importation..." : "Importer / mettre à jour"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleScan}
          disabled={connection.isSearching}
          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
        >
          {connection.isSearching ? "Recherche..." : "Rechercher les appareils"}
        </button>

        {connection.isConnected && (
          <button
            onClick={handleDisconnect}
            className="px-6 py-3 rounded-xl bg-danger text-white font-semibold"
          >
            Déconnecter
          </button>
        )}
      </div>
    </div>
  );
}
