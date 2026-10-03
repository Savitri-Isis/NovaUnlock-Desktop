import { useDeviceStore } from "../store/device-store";
import { DFUClient } from "../lib/usb/DFUClient";
import { DeviceDetector } from "../lib/usb/DeviceDetector";

const INSTRUCTIONS = [
  { step: 1, title: "Éteignez l'appareil", desc: "Maintenez le bouton latéral jusqu'à l'extinction." },
  { step: 2, title: "Connectez le câble USB", desc: "Branchez le câble à votre iPhone via USB." },
  { step: 3, title: "Maintenez le bouton latéral", desc: "10 secondes." },
  { step: 4, title: "Ajoutez Volume Bas", desc: "Maintenez les deux boutons 5 secondes." },
  { step: 5, title: "Relâchez le bouton latéral", desc: "Gardez Volume Bas jusqu'à la détection DFU." },
];

export default function DFU() {
  const connection = useDeviceStore((s) => s.connection);
  const dfuProgress = useDeviceStore((s) => s.dfuProgress);

  const handleDetectDFU = async () => {
    const confirmed = window.confirm(
      "Le mode DFU doit être déclenché physiquement avec les boutons de l'appareil.\n\nAvez-vous suivi les étapes ci-dessus ?"
    );
    if (confirmed) {
      await DeviceDetector.scan();
    }
  };

  const handleExitDFU = async () => {
    const confirmed = window.confirm("Sortir du mode DFU ?\nL'appareil va redémarrer.");
    if (confirmed) {
      await DFUClient.exitDFU();
    }
  };

  const isInDFU = connection.currentMode === "dfu";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Mode DFU</h2>
        <p className="text-sm text-muted">Device Firmware Update</p>
      </div>

      {/* Platform badge */}
      <div className="mb-4">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary">
          Windows • irecovery • libimobiledevice
        </span>
      </div>

      {/* Status */}
      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isInDFU ? "#7B2FBE" : "#8B8B9E" }} />
          <span className="text-sm font-semibold" style={{ color: isInDFU ? "#7B2FBE" : "#8B8B9E" }}>
            {isInDFU ? "Mode DFU actif" : connection.isConnected ? "Appareil connecté" : "Aucun appareil"}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Instructions</h3>
      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        {INSTRUCTIONS.map((item) => (
          <div key={item.step} className="flex gap-3 mb-4 last:mb-0">
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

      {/* DFU Progress */}
      {dfuProgress.isFlashing && (
        <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
          <p className="text-sm text-muted mb-2">Progression DFU</p>
          <p className="text-xl font-bold font-mono text-accent mb-2">{dfuProgress.progress}%</p>
          <p className="text-sm text-muted mb-3">{dfuProgress.stage}</p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${dfuProgress.progress}%`, backgroundColor: "#7B2FBE" }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDetectDFU}
          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold"
        >
          {isInDFU ? "Mode DFU détecté" : "Détecter le mode DFU"}
        </button>

        {isInDFU && (
          <button
            onClick={handleExitDFU}
            className="px-6 py-3 rounded-xl bg-accent text-white font-semibold"
          >
            Sortir du mode DFU
          </button>
        )}
      </div>
    </div>
  );
}
