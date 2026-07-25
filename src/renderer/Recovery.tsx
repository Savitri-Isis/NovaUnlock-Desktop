import { useDeviceStore } from "../store/device-store";
import { RecoveryClient } from "../lib/usb/RecoveryClient";

const INSTRUCTIONS = [
  { step: 1, title: "Éteignez l'appareil", desc: "Maintenez le bouton latéral jusqu'à l'extinction." },
  { step: 2, title: "Connectez le câble USB", desc: "Branchez le câble à votre iPhone via USB." },
  { step: 3, title: "Allumez en maintenant le bouton", desc: "10 secondes." },
  { step: 4, title: "Ajoutez Volume Bas", desc: "Maintenez les deux boutons 5 secondes." },
  { step: 5, title: "Relâchez le bouton latéral", desc: "Gardez Volume Bas jusqu'au logo recovery." },
];

export default function Recovery() {
  const connection = useDeviceStore((s) => s.connection);
  const dfuProgress = useDeviceStore((s) => s.dfuProgress);

  const handleEnterRecovery = async () => {
    if (!connection.isConnected) {
      alert("Connectez un appareil d'abord.");
      return;
    }
    const confirmed = window.confirm("Entrer en mode Recovery ?");
    if (confirmed) {
      await RecoveryClient.enterRecovery();
    }
  };

  const handleExitRecovery = async () => {
    const confirmed = window.confirm("Sortir du mode Recovery ?");
    if (confirmed) {
      await RecoveryClient.exitRecovery();
    }
  };

  const isInRecovery = connection.currentMode === "recovery";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Mode Recovery</h2>
        <p className="text-sm text-muted">Restauration et flash firmware</p>
      </div>

      <div className="mb-4">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-warning/20" style={{ color: "#FFC107" }}>
          Windows • irecovery • libimobiledevice
        </span>
      </div>

      <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isInRecovery ? "#FFC107" : "#8B8B9E" }} />
          <span className="text-sm font-semibold" style={{ color: isInRecovery ? "#FFC107" : "#8B8B9E" }}>
            {isInRecovery ? "Mode Recovery actif" : connection.isConnected ? "Appareil connecté" : "Aucun appareil"}
          </span>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Instructions</h3>
      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        {INSTRUCTIONS.map((item) => (
          <div key={item.step} className="flex gap-3 mb-4 last:mb-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#FFC107" }}>
              <span className="text-white text-xs font-bold">{item.step}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {dfuProgress.isFlashing && (
        <div className="bg-surface rounded-2xl p-5 border border-border mb-6">
          <p className="text-sm text-muted mb-2">Flash Recovery en cours</p>
          <p className="text-xl font-bold font-mono text-accent mb-2">{dfuProgress.progress}%</p>
          <p className="text-sm text-muted mb-3">{dfuProgress.stage}</p>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${dfuProgress.progress}%`, backgroundColor: "#FFC107" }} />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleEnterRecovery}
          className="flex-1 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: "#FFC107" }}
        >
          {isInRecovery ? "Déjà en mode Recovery" : "Entrer en mode Recovery"}
        </button>

        {isInRecovery && (
          <button
            onClick={handleExitRecovery}
            className="px-6 py-3 rounded-xl bg-accent text-white font-semibold"
          >
            Sortir du mode Recovery
          </button>
        )}
      </div>
    </div>
  );
}
