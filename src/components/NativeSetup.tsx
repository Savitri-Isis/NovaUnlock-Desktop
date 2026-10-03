import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceStore } from "../store/device-store";
import type { NativeToolStatus } from "../types/electron";

const REQUIRED_TOOLS = [
  ["deviceId", "idevice_id.exe"],
  ["deviceInfo", "ideviceinfo.exe"],
  ["activation", "ideviceactivation.exe"],
  ["backup", "idevicebackup2.exe"],
  ["restore", "idevicerestore.exe"],
  ["recovery", "irecovery.exe"],
] as const;

const SOURCES = {
  runtime: "dossier utilisateur",
  bundled: "fournis avec l’application",
  mixed: "application et dossier utilisateur",
  none: "aucune",
};

type Feedback = { kind: "info" | "success" | "warning" | "error"; message: string };

/** Presence-only setup: imports the selected payload, never downloads or runs it. */
export default function NativeSetup() {
  const [status, setStatus] = useState<NativeToolStatus | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "importing">("checking");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const requestId = useRef(0);
  const setInstalled = useDeviceStore((store) => store.setLibimobiledeviceInstalled);
  const available = Boolean(window.novaunlock?.getNativeToolStatus && window.novaunlock?.installLibimobiledevice);

  const applyStatus = useCallback((next: NativeToolStatus) => {
    setStatus(next);
    // Preserve the store's existing meaning: diagnostic executables are present.
    setInstalled(next.diagnosticsReady);
  }, [setInstalled]);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setPhase("checking");
    setFeedback(null);
    try {
      if (!window.novaunlock?.getNativeToolStatus) {
        setFeedback({ kind: "info", message: "Cet assistant est disponible dans l’application Windows, pas dans un aperçu navigateur." });
        return;
      }
      const next = await window.novaunlock.getNativeToolStatus();
      if (id === requestId.current) applyStatus(next);
    } catch {
      if (id === requestId.current) {
        setStatus(null);
        setFeedback({ kind: "error", message: "Impossible de vérifier les outils. Réessayez avec « Revérifier »." });
      }
    } finally {
      if (id === requestId.current) setPhase("idle");
    }
  }, [applyStatus]);

  useEffect(() => {
    void refresh();
    return () => { ++requestId.current; };
  }, [refresh]);

  const configure = async () => {
    if (!available || phase !== "idle") return;
    const id = ++requestId.current;
    setPhase("importing");
    setFeedback(null);
    try {
      const result = await window.novaunlock.installLibimobiledevice();
      if (id !== requestId.current) return;
      applyStatus(result.status);
      if (result.canceled) {
        setFeedback({ kind: "info", message: "Configuration annulée. Les outils existants sont conservés." });
        return;
      }
      if (!result.success) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      setPhase("checking");
      const next = await window.novaunlock.getNativeToolStatus!();
      if (id !== requestId.current) return;
      applyStatus(next);
      setFeedback(next.complete && next.hasDlls
        ? { kind: "success", message: "Configuration terminée : les six exécutables requis et des DLL sont présents. Vous pouvez passer à la connexion USB." }
        : { kind: "warning", message: "Importation effectuée, mais le paquet reste incomplet. Consultez les fichiers absents ci-dessous et choisissez un paquet Windows x64 complet." });
    } catch (error: unknown) {
      if (id === requestId.current) {
        setStatus(null);
        setFeedback({ kind: "error", message: error instanceof Error ? error.message : "La configuration a échoué. Vous pouvez réessayer." });
      }
    } finally {
      if (id === requestId.current) setPhase("idle");
    }
  };

  const busy = phase !== "idle";
  const complete = Boolean(status?.complete && status.hasDlls);

  return (
    <section className="bg-surface rounded-2xl p-5 border border-border mb-6" aria-label="Assistant de configuration des outils USB" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Assistant de configuration</h3>
          <p className="text-xs text-muted mt-1">Outils USB · libimobiledevice · Windows x64</p>
        </div>
        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${complete ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          {phase === "importing" ? "Sélection / copie…" : phase === "checking" ? "Vérification…" : !status ? "Non vérifié" : complete ? "Fichiers requis présents" : "Configuration incomplète"}
        </span>
      </div>

      <p className="text-sm text-muted mb-4">
        Choisissez un paquet libimobiledevice de confiance, déjà extrait, avec ses DLL et ses licences.
        NovaUnlock s’occupe de la copie et du contrôle des fichiers, sans commande PowerShell ni droits administrateur.
      </p>
      <ol className="grid gap-3 md:grid-cols-3 mb-4 text-xs text-muted">
        <li className="p-3 rounded-lg bg-background"><strong className="block text-foreground mb-1">1. Choisir le dossier</strong>Un sélecteur Windows s’ouvre. Aucun téléchargement automatique.</li>
        <li className="p-3 rounded-lg bg-background"><strong className="block text-foreground mb-1">2. Copier les outils</strong>Copie automatique dans votre dossier utilisateur, sans modifier Program Files.</li>
        <li className="p-3 rounded-lg bg-background"><strong className="block text-foreground mb-1">3. Vérifier les fichiers</strong>Contrôle automatique des exécutables requis et de la présence de DLL.</li>
      </ol>

      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" onClick={() => void configure()} disabled={!available || busy}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
          {phase === "importing" ? "Configuration en cours…" : "Configurer automatiquement"}
        </button>
        <button type="button" onClick={() => void refresh()} disabled={!available || busy}
          className="px-4 py-2 rounded-lg border border-border text-foreground text-sm disabled:opacity-50">
          Revérifier
        </button>
      </div>

      {feedback && (
        <p role={feedback.kind === "error" ? "alert" : "status"}
          className={`mb-4 text-sm break-words ${feedback.kind === "error" ? "text-danger" : feedback.kind === "warning" ? "text-warning" : feedback.kind === "success" ? "text-success" : "text-muted"}`}>
          {feedback.message}
        </p>
      )}

      {status && (
        <div className="p-3 rounded-lg bg-background mb-4">
          <p className="text-xs text-muted mb-3">Source : {SOURCES[status.source]}</p>
          <ul className="grid gap-2 sm:grid-cols-2 text-xs" aria-label="Fichiers requis">
            {REQUIRED_TOOLS.map(([key, name]) => (
              <li key={key} className={status.tools[key] ? "text-success" : "text-warning"}>
                <span className="font-mono">{name}</span> — {status.tools[key] ? "présent" : "absent"}
              </li>
            ))}
            <li className={status.hasDlls ? "text-success" : "text-warning"}>Bibliothèques DLL — {status.hasDlls ? "présentes" : "absentes"}</li>
          </ul>
          {!status.tools.enterRecovery && <p className="text-xs text-muted mt-3">Facultatif : ideviceenterrecovery.exe n’est pas présent. Il ne bloque pas cette configuration.</p>}
        </div>
      )}
      <p className="text-xs text-muted">
        Ce contrôle porte sur la présence des fichiers, pas sur leur authenticité ni leur compatibilité.
        Les pilotes Apple, le câble et l’appairage restent à vérifier lors de la connexion USB.
        Aucun appareil n’est modifié par cet assistant.
      </p>
    </section>
  );
}
