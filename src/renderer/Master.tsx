import { useEffect, useMemo, useState } from "react";
import { useDeviceStore } from "../store/device-store";
import type { MasterOperationStatus, MasterPreflightResult } from "../types/electron";

type Task =
  | "inspect"
  | "backup"
  | "screenpass"
  | "factory-reset"
  | "versioning"
  | "screen-time"
  | "sim-assist";

const DESTRUCTIVE_CONFIRMATION = "EFFACER";
const DESTRUCTIVE_TASKS: Task[] = ["screenpass", "factory-reset", "versioning"];

const TASKS: Array<{ id: Task; title: string; description: string }> = [
  { id: "inspect", title: "Inspecter", description: "Diagnostic lecture seule et rapport appareil." },
  { id: "backup", title: "Sauvegarder", description: "Sauvegarde locale chiffrée via idevicebackup2." },
  {
    id: "screenpass",
    title: "Code d'écran oublié",
    description: "Restauration officielle d'un appareil autorisé ; les données sont effacées.",
  },
  { id: "factory-reset", title: "Remise à zéro", description: "Effacement officiel depuis un IPSW signé." },
  { id: "versioning", title: "Version iOS", description: "Restauration d'un build encore signé par Apple." },
  { id: "screen-time", title: "Temps d'écran", description: "Guidage officiel uniquement, sans modification." },
  { id: "sim-assist", title: "Assistance SIM", description: "Diagnostic et orientation opérateur, sans déverrouillage." },
];

function isDestructive(task: Task): boolean {
  return DESTRUCTIVE_TASKS.includes(task);
}

function taskLabel(task: Task): string {
  return TASKS.find((item) => item.id === task)?.title || task;
}

export default function Master() {
  const deviceInfo = useDeviceStore((state) => state.deviceInfo);
  const connection = useDeviceStore((state) => state.connection);
  const selectedFirmware = useDeviceStore((state) => state.selectedFirmware);
  const [selected, setSelected] = useState<Task>("inspect");
  const [result, setResult] = useState<MasterPreflightResult | null>(null);
  const [operation, setOperation] = useState<MasterOperationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [ownerAttested, setOwnerAttested] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [firmwarePath, setFirmwarePath] = useState("");

  const destructive = isDestructive(selected);
  const informational = selected === "screen-time" || selected === "sim-assist";
  const activeOperation = operation?.state === "queued" || operation?.state === "running";

  const device = useMemo(
    () => ({
      modelIdentifier: deviceInfo.modelIdentifier,
      serial: deviceInfo.serial,
      mode: connection.currentMode,
      activationLockStatus: deviceInfo.activationLockStatus,
    }),
    [connection.currentMode, deviceInfo.activationLockStatus, deviceInfo.modelIdentifier, deviceInfo.serial]
  );

  useEffect(() => {
    if (!operation || !activeOperation) return;
    let alive = true;
    const refresh = async () => {
      try {
        const next = await window.novaunlock.getMasterOperationStatus(operation.id);
        if (!alive || !next) return;
        setOperation(next);
      } catch {
        if (alive) {
          setError("Impossible de suivre l'opération en cours. Ne débranchez pas l'appareil avant confirmation de sa fin.");
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeOperation, operation]);

  const selectTask = (task: Task) => {
    if (activeOperation) return;
    setSelected(task);
    setResult(null);
    setOperation(null);
    setError(null);
    setBackupPassword("");
    setOwnerAttested(false);
    setTypedConfirmation("");
    setFirmwarePath("");
  };

  const runPreflight = async () => {
    setBusy(true);
    setError(null);
    setOperation(null);
    try {
      const next = await window.novaunlock.preflight(selected, device);
      setResult(next);
      try {
        await window.novaunlock.appendAudit(selected, deviceInfo.serial || "unknown", "preflight");
      } catch {
        // The preflight remains useful even if the local audit disk is unavailable.
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Le prévol n'a pas pu être exécuté.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const chooseFirmware = async () => {
    setError(null);
    try {
      const fromDialog = await window.novaunlock.selectFirmwareFile();
      if (fromDialog) setFirmwarePath(fromDialog);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Impossible de sélectionner le fichier IPSW.");
    }
  };

  const startOperation = async () => {
    if (!result || !result.canExecute || activeOperation || informational) return;
    setError(null);

    const selectedPath = firmwarePath || selectedFirmware?.localPath || "";
    try {
      const started = await window.novaunlock.executeMaster({
        task: selected,
        device,
        confirmation: {
          ownerAttested,
          typedConfirmation,
          backupPassword,
        },
        firmwarePath: selectedPath || undefined,
      });
      // Passwords are only sent to the main process for this request and never retained in UI state.
      setBackupPassword("");
      setOperation(started);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Impossible de démarrer l'opération.");
    }
  };

  const canStart = Boolean(result?.canExecute) && !busy && !activeOperation && !informational;
  const renderedFirmwarePath = firmwarePath || selectedFirmware?.localPath || "";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Application maîtresse</h2>
        <p className="text-sm text-muted">Diagnostic, sauvegarde et restauration officielle d'appareils autorisés</p>
      </div>

      <div className="bg-surface rounded-2xl p-4 border border-border mb-6">
        <p className="text-xs text-muted uppercase tracking-wider">Garde-fous actifs</p>
        <p className="text-sm text-foreground mt-2">
          Prévol obligatoire · Activation Lock fail-closed · audit local haché · confirmation écrite avant effacement
        </p>
        <p className="text-xs text-warning mt-2">
          NovaUnlock ne contourne jamais iCloud, Activation Lock, une SIM ou un code d'accès. Une restauration officielle efface les données et peut exiger l'identifiant Apple du propriétaire au redémarrage.
        </p>
      </div>

      {selectedFirmware?.localPath && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-foreground">
          IPSW prêt : <span className="font-mono break-all">{selectedFirmware.localPath}</span>. Choisissez « Version iOS », lancez le prévol, puis confirmez la restauration officielle.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        {TASKS.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={activeOperation}
            onClick={() => selectTask(task.id)}
            className={`text-left rounded-xl p-4 border disabled:opacity-50 ${
              selected === task.id ? "border-accent bg-accent/10" : "border-border bg-surface"
            }`}
          >
            <p className="text-sm font-semibold text-foreground">{task.title}</p>
            <p className="text-xs text-muted mt-1">{task.description}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={runPreflight}
        disabled={busy || activeOperation}
        className="w-full py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
      >
        {busy ? "Prévol en cours…" : `Lancer le prévol sécurisé — ${taskLabel(selected)}`}
      </button>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-surface rounded-2xl p-5 border border-border space-y-4">
          <div className="flex justify-between items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground">Résultat — {taskLabel(selected)}</h3>
            <span
              className={`text-xs font-semibold ${
                result.canExecute ? "text-success" : result.ok ? "text-warning" : "text-danger"
              }`}
            >
              {result.canExecute ? "PRÊT POUR VALIDATION" : result.ok ? "INFORMATION" : "BLOQUÉ"}
            </span>
          </div>

          <p className="text-xs text-warning">{result.activationLockNotice}</p>

          {result.capabilities && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ["Diagnostic", result.capabilities.diagnosticsReady],
                ["Sauvegarde", result.capabilities.backupReady],
                ["Restauration", result.capabilities.restoreReady],
                ["Activation Lock", result.capabilities.activationCheckReady],
              ].map(([label, available]) => (
                <span
                  key={String(label)}
                  className={`rounded-lg px-2 py-1 ${available ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                >
                  {String(label)} : {available ? "prêt" : "absent"}
                </span>
              ))}
            </div>
          )}

          {result.blockers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-danger">Blocages</p>
              <ul className="text-xs text-muted list-disc pl-5 space-y-1">
                {result.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warning">Avertissements</p>
              <ul className="text-xs text-muted list-disc pl-5 space-y-1">
                {result.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted mb-2">Plan proposé</p>
            <ol className="text-xs text-foreground list-decimal pl-5 space-y-1">
              {result.steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <p className="text-xs text-muted">
            Sauvegardes détectées : {result.backupCount} · Espace disque libre : {result.diskFreeGb} Go · Le prévol n'a effectué aucune écriture.
          </p>

          {result.canExecute && selected === "backup" && (
            <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
              <label className="block text-sm font-semibold text-foreground" htmlFor="backup-password">
                Mot de passe de la sauvegarde chiffrée
              </label>
              <input
                id="backup-password"
                type="password"
                autoComplete="new-password"
                value={backupPassword}
                onChange={(event) => setBackupPassword(event.target.value)}
                placeholder="Au moins 8 caractères — non conservé par NovaUnlock"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-primary"
              />
              <p className="text-xs text-muted">
                Ce mot de passe est transmis une seule fois à idevicebackup2, puis effacé de l'interface. Conservez-le dans un gestionnaire de mots de passe.
              </p>
            </div>
          )}

          {result.canExecute && destructive && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-danger">Confirmation de restauration officielle</p>
                <p className="text-xs text-muted mt-1">
                  Cette action efface les données. Elle ne retire pas Activation Lock et ne rend pas un appareil utilisable sans les identifiants Apple de son propriétaire.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  readOnly
                  value={renderedFirmwarePath}
                  placeholder="Sélectionnez un fichier .ipsw signé"
                  className="min-w-0 flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted/50"
                  aria-label="Fichier firmware IPSW sélectionné"
                />
                <button
                  type="button"
                  onClick={chooseFirmware}
                  className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
                >
                  Choisir IPSW
                </button>
              </div>

              <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerAttested}
                  onChange={(event) => setOwnerAttested(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  J'atteste être le propriétaire autorisé de cet appareil ou disposer d'une autorisation explicite pour sa restauration.
                </span>
              </label>

              <label className="block text-xs text-foreground" htmlFor="erase-confirmation">
                Saisissez <span className="font-mono text-danger">{DESTRUCTIVE_CONFIRMATION}</span> pour confirmer l'effacement
              </label>
              <input
                id="erase-confirmation"
                type="text"
                value={typedConfirmation}
                onChange={(event) => setTypedConfirmation(event.target.value)}
                placeholder={DESTRUCTIVE_CONFIRMATION}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted/50 outline-none focus:border-danger"
              />
            </div>
          )}

          {informational ? (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-muted">
              Cette tâche ne lance volontairement aucune modification. Consultez l'assistance Apple ou votre opérateur pour poursuivre avec le flux officiel.
            </div>
          ) : (
            <button
              type="button"
              onClick={startOperation}
              disabled={!canStart}
              className={`w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 ${
                destructive ? "bg-danger" : "bg-success"
              }`}
            >
              {activeOperation
                ? "Opération en cours — ne débranchez pas l'appareil"
                : selected === "backup"
                ? "Créer la sauvegarde chiffrée"
                : destructive
                ? "Lancer la restauration officielle"
                : "Exécuter le diagnostic lecture seule"}
            </button>
          )}
        </div>
      )}

      {operation && (
        <div className="mt-6 bg-surface rounded-2xl p-5 border border-border space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Opération — {taskLabel(selected)}</h3>
            <span
              className={`text-xs font-semibold ${
                operation.state === "completed"
                  ? "text-success"
                  : operation.state === "failed" || operation.state === "blocked"
                  ? "text-danger"
                  : "text-accent"
              }`}
            >
              {operation.state === "queued"
                ? "EN ATTENTE"
                : operation.state === "running"
                ? "EN COURS"
                : operation.state === "completed"
                ? "TERMINÉE"
                : "ARRÊTÉE"}
            </span>
          </div>
          <p className="text-sm text-foreground">{operation.stage}</p>
          {operation.progress != null && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, operation.progress))}%` }}
                />
              </div>
              <p className="text-xs font-mono text-muted">
                {operation.progress}%{operation.speed ? ` · ${operation.speed}` : ""}
              </p>
            </>
          )}
          {operation.result && (
            <div className={`rounded-lg p-3 text-sm ${operation.result.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              <p>{operation.result.message}</p>
              {operation.result.backup && (
                <p className="mt-2 break-all text-xs text-foreground">
                  Emplacement : {operation.result.backup.path} · {operation.result.backup.encrypted ? "chiffrée" : "non chiffrée"}
                </p>
              )}
              {operation.result.report && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-foreground">
                  <dt>Modèle</dt><dd>{operation.result.report.model || "N/A"}</dd>
                  <dt>Identifiant</dt><dd>{operation.result.report.modelIdentifier || "N/A"}</dd>
                  <dt>iOS</dt><dd>{operation.result.report.iosVersion || "N/A"}</dd>
                  <dt>Batterie</dt><dd>{operation.result.report.batteryLevel == null ? "N/A" : `${operation.result.report.batteryLevel}%`}</dd>
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
