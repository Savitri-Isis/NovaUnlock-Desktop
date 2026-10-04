import { useState } from "react";
import { DeviceDetector } from "../lib/usb/DeviceDetector";
import { useDeviceStore } from "../store/device-store";

function jailbreakStateLabel(state?: string): { label: string; color: string; detail: string } {
  if (state === "yes") {
    return {
      label: "Jailbreak détecté",
      color: "#00E676",
      detail: "L’appareil signale déjà un jailbreak. Aucun nouvel outil ne sera lancé.",
    };
  }
  if (state === "no") {
    return {
      label: "Aucun indice détecté",
      color: "#8B8B9E",
      detail: "Cela ne prouve pas qu’un appareil n’a jamais été jailbreaké.",
    };
  }
  if (state === "not-checked") {
    return {
      label: "Non vérifié",
      color: "#FFB020",
      detail: "La vérification n’est pas disponible avec les outils actuellement configurés.",
    };
  }
  return {
    label: "Indéterminé",
    color: "#FFB020",
    detail: "iOS n’expose pas de signal public fiable permettant de certifier le statut.",
  };
}

export default function Jailbreak() {
  const connection = useDeviceStore((state) => state.connection);
  const deviceInfo = useDeviceStore((state) => state.deviceInfo);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");
  const state = jailbreakStateLabel(deviceInfo.jailbreakState);
  const connected = connection.isConnected;
  const profileReady = Boolean(deviceInfo.modelIdentifier && deviceInfo.iosVersion);

  const analyzeDevice = async () => {
    setIsAnalyzing(true);
    setNotice("");
    try {
      if (connected) {
        await DeviceDetector.fetchDeviceInfo();
      } else {
        const detected = await DeviceDetector.scan();
        if (!detected) {
          setNotice("Aucun appareil détecté. Vérifiez le câble USB, déverrouillez l’iPhone et acceptez « Faire confiance à cet ordinateur ».");
          return;
        }
        // scan() already retrieves the details once it has paired a normal-mode device.
      }
      const latest = useDeviceStore.getState();
      setNotice(
        latest.connection.isConnected
          ? "Analyse terminée. Vérifiez le modèle et la version iOS avant de choisir une méthode."
          : "Appareil détecté, mais non appairé. Déverrouillez-le et acceptez « Faire confiance »."
      );
    } catch {
      setNotice("L’analyse a échoué. Vérifiez la connexion USB et les outils libimobiledevice.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Assistant jailbreak</h2>
        <p className="text-sm text-muted">
          Analyse de l’appareil et préparation d’un parcours selon sa compatibilité.
        </p>
      </header>

      <div className="mb-4">
        <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs text-accent">
          Windows • USB • diagnostic
        </span>
      </div>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-5" aria-labelledby="device-profile-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="device-profile-title" className="text-sm font-semibold uppercase tracking-wider text-muted">
            Profil de l’appareil
          </h3>
          <span className="text-xs text-muted">{connected ? "Connecté" : "Déconnecté"}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Modèle</p>
            <p className="font-mono text-sm text-foreground">{deviceInfo.model || "À détecter"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Identifiant</p>
            <p className="font-mono text-sm text-foreground">{deviceInfo.modelIdentifier || "À détecter"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Version iOS</p>
            <p className="font-mono text-sm text-foreground">{deviceInfo.iosVersion || "À détecter"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={analyzeDevice}
          disabled={isAnalyzing}
          className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isAnalyzing ? "Analyse en cours…" : connected ? "Analyser / actualiser l’appareil" : "Détecter l’iPhone connecté"}
        </button>
        {notice && <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">{notice}</p>}
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-5" aria-labelledby="jailbreak-status-title">
        <h3 id="jailbreak-status-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          État du jailbreak
        </h3>
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: state.color }} />
          <div>
            <p className="font-semibold text-foreground">{state.label}</p>
            <p className="mt-1 text-sm text-muted">{state.detail}</p>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-5" aria-labelledby="compatibility-title">
        <h3 id="compatibility-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Compatibilité et prochaine étape
        </h3>
        {profileReady ? (
          <p className="text-sm text-foreground">
            Profil relevé pour <span className="font-mono">{deviceInfo.modelIdentifier}</span> sous iOS{" "}
            <span className="font-mono">{deviceInfo.iosVersion}</span>. La compatibilité d’un jailbreak dépend
            aussi de la puce et de la méthode; NovaUnlock ne dispose pas encore d’un catalogue vérifié couvrant
            ces combinaisons.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Connectez et appairez l’iPhone en mode normal pour relever son modèle et sa version iOS. Sans ces
            informations, aucune compatibilité ne peut être évaluée.
          </p>
        )}
        <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-4">
          <p className="text-sm font-semibold text-foreground">Aucune méthode de jailbreak n’est lancée par cet écran.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Il n’existe pas de méthode universelle pour tous les iPhone et toutes les versions iOS. Avant d’activer
            un lancement, il faut valider une méthode officielle pour l’identifiant matériel et la version détectés,
            vérifier sa provenance et prévoir une sauvegarde. Cette version n’installe ni ne télécharge de payload
            de jailbreak.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Une méthode officiellement documentée et compatible doit être intégrée avant le lancement."
          className="mt-4 w-full cursor-not-allowed rounded-xl border border-border bg-background/50 py-3 text-sm font-semibold text-muted"
        >
          {profileReady ? "Lancement indisponible — compatibilité non validée" : "Lancement indisponible — détectez d’abord l’appareil"}
        </button>
      </section>

      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="text-sm font-semibold text-foreground">Avant toute opération</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
          <li>Faites une sauvegarde vérifiée et conservez son mot de passe en lieu sûr.</li>
          <li>Utilisez uniquement une méthode dont la documentation officielle confirme la compatibilité.</li>
          <li>Ne poursuivez pas si le statut, le modèle ou la version iOS reste inconnu.</li>
        </ul>
      </section>
    </div>
  );
}
