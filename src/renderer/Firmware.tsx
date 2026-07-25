import { useState } from "react";
import { useDeviceStore, type FirmwareInfo } from "../store/device-store";
import { FirmwareManager } from "../lib/usb/FirmwareManager";
import { DFUClient } from "../lib/usb/DFUClient";
import { RecoveryClient } from "../lib/usb/RecoveryClient";

export default function Firmware() {
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableFirmwares = useDeviceStore((s) => s.availableFirmwares);
  const selectedFirmware = useDeviceStore((s) => s.selectedFirmware);
  const downloadProgress = useDeviceStore((s) => s.firmwareDownloadProgress);
  const connection = useDeviceStore((s) => s.connection);
  const setSelectedFirmware = useDeviceStore((s) => s.setSelectedFirmware);
  const setFirmwareDownloadProgress = useDeviceStore((s) => s.setFirmwareDownloadProgress);

  const handleSearch = async () => {
    if (!deviceIdentifier.trim()) {
      alert("Entrez l'identifiant de l'appareil (ex: iPhone14,5)");
      return;
    }
    setIsLoading(true);
    await FirmwareManager.listFirmwares(deviceIdentifier.trim());
    setIsLoading(false);
  };

  const handleDownload = async (fw: FirmwareInfo) => {
    const confirmed = window.confirm(`Télécharger iOS ${fw.version} (${fw.filesize}) ?`);
    if (!confirmed) return;

    setSelectedFirmware(fw);
    await FirmwareManager.downloadFirmware(fw);
  };

  const handleFlash = async () => {
    if (!selectedFirmware) {
      alert("Aucun firmware sélectionné.");
      return;
    }
    if (!connection.isConnected) {
      alert("Connectez un appareil d'abord.");
      return;
    }

    const confirmed = window.confirm(
      `Flasher iOS ${selectedFirmware.version} ?\n\nL'opération est irréversible.`
    );
    if (!confirmed) return;

    const mode = connection.currentMode;
    if (mode === "dfu") {
      await DFUClient.flashFirmware(selectedFirmware.url);
    } else if (mode === "recovery") {
      await RecoveryClient.flashFromRecovery(selectedFirmware.url);
    } else {
      alert("L'appareil doit être en mode DFU ou Recovery pour flasher.");
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Firmware Manager</h2>
        <p className="text-sm text-muted">Gestion et flash de firmware iOS</p>
      </div>

      <div className="mb-4">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-accent/20 text-accent">
          API ipsw.me • idevicerestore
        </span>
      </div>

      {/* Device Identifier */}
      <div className="bg-surface rounded-2xl p-4 border border-border mb-4">
        <p className="text-sm text-muted mb-2">Identifiant de l'appareil</p>
        <p className="text-xs text-muted mb-3">Ex: iPhone14,5 | iPhone15,2 | iPad11,3</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={deviceIdentifier}
            onChange={(e) => setDeviceIdentifier(e.target.value)}
            placeholder="iPhone14,5"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted/50 outline-none focus:border-primary"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? "..." : "Rechercher"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {["iPhone14,5", "iPhone15,2", "iPhone15,5", "iPhone14,2", "iPhone16,1", "iPhone16,2"].map((id) => (
            <button
              key={id}
              onClick={() => setDeviceIdentifier(id)}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-mono"
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Download Progress */}
      {downloadProgress.isDownloading && (
        <div className="bg-surface rounded-2xl p-5 border border-border mb-4">
          <p className="text-sm text-muted mb-2">Téléchargement firmware</p>
          <p className="text-xl font-bold font-mono text-accent mb-1">{downloadProgress.progress}%</p>
          <p className="text-xs text-muted mb-2">{downloadProgress.downloadedSize} / {downloadProgress.totalSize}</p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${downloadProgress.progress}%`, backgroundColor: "#00D4FF" }} />
          </div>
        </div>
      )}

      {/* Firmware List */}
      {!isLoading && availableFirmwares.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Firmwares disponibles ({availableFirmwares.length})
          </h3>
          {availableFirmwares.map((fw) => {
            const isSelected = selectedFirmware?.buildid === fw.buildid;
            return (
              <div
                key={fw.buildid}
                onClick={() => setSelectedFirmware(fw)}
                className={`bg-surface rounded-xl p-4 border mb-3 cursor-pointer ${
                  isSelected ? "border-accent" : "border-border"
                }`}
                style={{ borderWidth: isSelected ? 1.5 : 1 }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base font-semibold text-foreground">iOS {fw.version}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-success/20 text-success">Signé</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted font-mono">Build: {fw.buildid}</span>
                  <span className="text-xs text-muted font-mono">{fw.filesize}</span>
                </div>
                <p className="text-xs text-muted mt-1">Publié le {fw.released}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(fw); }}
                  className="mt-3 w-full py-2 rounded-lg bg-primary text-white text-xs font-semibold"
                >
                  Télécharger
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Flash Button */}
      {selectedFirmware && (
        <div className="bg-surface rounded-2xl p-4 border border-accent">
          <p className="text-sm font-semibold text-accent mb-2">Firmware sélectionné</p>
          <p className="text-sm text-foreground mb-1">iOS {selectedFirmware.version}</p>
          <p className="text-xs text-muted mb-3">Build: {selectedFirmware.buildid}</p>
          <button
            onClick={handleFlash}
            className="w-full py-3 rounded-xl bg-danger text-white font-semibold"
          >
            Flasher le firmware
          </button>
        </div>
      )}
    </div>
  );
}
