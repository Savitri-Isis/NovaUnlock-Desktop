import { useDeviceStore } from "../store/device-store";
import { DeviceDetector } from "../lib/usb/DeviceDetector";

interface InfoRow {
  label: string;
  value: string;
}

function InfoCard({ label, value }: InfoRow) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-mono text-foreground">{value}</span>
    </div>
  );
}

export default function DeviceInfo() {
  const deviceInfo = useDeviceStore((s) => s.deviceInfo);
  const connection = useDeviceStore((s) => s.connection);

  const infoRows: InfoRow[] = [
    { label: "Numéro de série", value: deviceInfo.serial || "N/A" },
    { label: "Modèle", value: deviceInfo.model || "N/A" },
    { label: "Identifiant modèle", value: deviceInfo.modelIdentifier || "N/A" },
    { label: "IMEI", value: deviceInfo.imei || "N/A" },
    { label: "Version iOS", value: deviceInfo.iosVersion || "N/A" },
    { label: "Batterie", value: deviceInfo.batteryLevel != null ? `${deviceInfo.batteryLevel}%` : "N/A" },
    { label: "Santé batterie", value: deviceInfo.batteryHealth || "N/A" },
    { label: "Stockage utilisé", value: deviceInfo.storageUsed || "N/A" },
    { label: "Stockage total", value: deviceInfo.storageTotal || "N/A" },
    { label: "Jailbreak", value: deviceInfo.jailbreakStatus ? "Oui" : "Non" },
    { label: "Activation Lock", value: deviceInfo.activationLockStatus || "N/A" },
    { label: "Type de connexion", value: deviceInfo.connectionType ? "USB" : "Aucune" },
    { label: "Mode actuel", value: connection.currentMode.toUpperCase() },
    { label: "ECID", value: deviceInfo.ecid || "N/A" },
    { label: "iBoot Version", value: deviceInfo.ibootVersion || "N/A" },
    { label: "Chipset", value: deviceInfo.chipset || "N/A" },
    { label: "Board Config", value: deviceInfo.boardConfig || "N/A" },
    { label: "Baseband", value: deviceInfo.basebandVersion || "N/A" },
  ];

  const isConnected = connection.isConnected;

  const handleRefresh = async () => {
    await DeviceDetector.fetchDeviceInfo();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Informations appareil</h2>
        <p className="text-sm text-muted">Détails techniques de l'appareil connecté</p>
      </div>

      <div className="mb-4">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-accent/20 text-accent">
          Windows • libimobiledevice
        </span>
      </div>

      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isConnected ? "#00E676" : "#8B8B9E" }} />
          <span className="text-sm font-semibold" style={{ color: isConnected ? "#00E676" : "#8B8B9E" }}>
            {isConnected ? "Appareil connecté" : "Aucun appareil"}
          </span>
        </div>
        {!isConnected && (
          <p className="text-sm text-muted text-center py-4">
            Connectez un appareil pour afficher ses informations.
          </p>
        )}
      </div>

      {isConnected && (
        <>
          <div className="bg-surface rounded-2xl p-4 border border-border mb-4">
            <h3 className="text-sm font-semibold text-muted mb-2 uppercase tracking-wider">
              Spécifications
            </h3>
            {infoRows.map((row) => (
              <InfoCard key={row.label} label={row.label} value={row.value} />
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="w-full py-3 rounded-xl bg-surface border border-border text-accent text-sm font-semibold"
          >
            Rafraîchir les informations
          </button>
        </>
      )}
    </div>
  );
}
