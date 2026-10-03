import { useState } from "react";
import { useDeviceStore } from "../store/device-store";

type Task = "inspect" | "backup" | "screenpass" | "factory-reset" | "versioning" | "screen-time" | "sim-assist";
const TASKS: Array<{ id: Task; title: string; description: string }> = [
  { id: "inspect", title: "Inspecter", description: "Diagnostic lecture seule et rapport appareil." },
  { id: "backup", title: "Sauvegarder", description: "Préparer une sauvegarde locale avant une action sensible." },
  { id: "screenpass", title: "Code d’écran oublié", description: "Restauration officielle d’un appareil autorisé." },
  { id: "factory-reset", title: "Remise à zéro", description: "Effacement guidé ou restauration complète." },
  { id: "versioning", title: "Version iOS", description: "Contrôler la fenêtre de signature avant restauration." },
  { id: "screen-time", title: "Temps d’écran", description: "Orienter vers le flux officiel adapté à la version iOS." },
  { id: "sim-assist", title: "Assistance SIM", description: "Diagnostic et guidage opérateur, sans promesse de contournement." },
];

export default function Master() {
  const deviceInfo = useDeviceStore((s) => s.deviceInfo);
  const connection = useDeviceStore((s) => s.connection);
  const [selected, setSelected] = useState<Task>("inspect");
  const [result, setResult] = useState<Awaited<ReturnType<typeof window.novaunlock.preflight>> | null>(null);
  const [busy, setBusy] = useState(false);
  const runPreflight = async () => {
    setBusy(true);
    try {
      const next = await window.novaunlock.preflight(selected, {
        modelIdentifier: deviceInfo.modelIdentifier,
        serial: deviceInfo.serial,
        mode: connection.currentMode,
        activationLockStatus: deviceInfo.activationLockStatus,
      });
      setResult(next);
      await window.novaunlock.appendAudit(selected, deviceInfo.serial || "unknown", "preflight");
    } finally { setBusy(false); }
  };
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Application maîtresse</h2>
        <p className="text-sm text-muted">Orchestration commune des tâches NovaUnlock-App et NovaLink</p>
      </div>
      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        <p className="text-xs text-muted uppercase tracking-wider">Garde-fous actifs</p>
        <p className="text-sm text-foreground mt-2">Prévol obligatoire · avertissement Activation Lock · audit haché · opérations destructrices en prévisualisation</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TASKS.map((task) => (
          <button key={task.id} onClick={() => { setSelected(task.id); setResult(null); }} className={`text-left rounded-xl p-4 border ${selected === task.id ? "border-accent bg-accent/10" : "border-border bg-surface"}`}>
            <p className="text-sm font-semibold text-foreground">{task.title}</p>
            <p className="text-xs text-muted mt-1">{task.description}</p>
          </button>
        ))}
      </div>
      <button onClick={runPreflight} disabled={busy} className="w-full py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50">
        {busy ? "Prévol en cours…" : "Lancer le prévol sécurisé"}
      </button>
      {result && (
        <div className="mt-6 bg-surface rounded-2xl p-5 border border-border space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-sm font-semibold text-foreground">Résultat — {result.task}</h3><span className={`text-xs font-semibold ${result.ok ? "text-success" : "text-danger"}`}>{result.ok ? "PRÊT POUR VALIDATION" : "BLOQUÉ"}</span></div>
          <p className="text-xs text-warning">{result.activationLockNotice}</p>
          {result.blockers.length > 0 && <div><p className="text-xs font-semibold text-danger">Blocages</p><ul className="text-xs text-muted list-disc pl-5">{result.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {result.warnings.length > 0 && <div><p className="text-xs font-semibold text-warning">Avertissements</p><ul className="text-xs text-muted list-disc pl-5">{result.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          <div><p className="text-xs font-semibold text-muted mb-2">Plan proposé</p><ol className="text-xs text-foreground list-decimal pl-5 space-y-1">{result.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <p className="text-xs text-muted">Sauvegardes détectées : {result.backupCount} · Prévisualisation uniquement : aucune écriture n’a été lancée.</p>
        </div>
      )}
    </div>
  );
}
