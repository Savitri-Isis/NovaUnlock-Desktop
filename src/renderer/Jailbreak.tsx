import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceDetector } from "../lib/usb/DeviceDetector";
import { useDeviceStore } from "../store/device-store";
import { SELECTABLE_CHIPS } from "../lib/jailbreak/chips";
import {
  CATALOGUE_VERIFIED_AT,
  JAILBREAK_METHODS,
  IOS_CFW_GUIDE,
} from "../lib/jailbreak/methods";
import { analyseCatalogue, sortEvaluations } from "../lib/jailbreak/compatibility";
import {
  buildJailbreakPlan,
  isPlanConsistent,
  selectAutoMethod,
  toJailbreakAction,
  type JailbreakPlan,
} from "../lib/jailbreak/execution";
import type { CompatVerdict, JailbreakMethod, MethodEvaluation } from "../lib/jailbreak/types";
import type { JailbreakOperationStatus } from "../types/electron";

type FilterId = "pertinentes" | "compatibles" | "toutes" | "inventaire";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "pertinentes", label: "Pertinentes" },
  { id: "compatibles", label: "Compatibles" },
  { id: "toutes", label: "Toutes" },
  { id: "inventaire", label: "Inventaire" },
];

const VERDICT_STYLE: Record<CompatVerdict, { label: string; color: string; background: string }> = {
  compatible: { label: "Compatible", color: "#00E676", background: "rgba(0,230,118,0.12)" },
  "hors-plage": { label: "Hors plage", color: "#FFC107", background: "rgba(255,193,7,0.12)" },
  "non-supporte": { label: "Non prise en charge", color: "#FF1744", background: "rgba(255,23,68,0.12)" },
  inconnu: { label: "À déterminer", color: "#FFB020", background: "rgba(255,176,32,0.12)" },
  "hors-evaluation": { label: "Référence", color: "#00D4FF", background: "rgba(0,212,255,0.12)" },
};

const STATUS_LABEL: Record<JailbreakMethod["status"], string> = {
  actif: "Actif",
  maintenu: "Maintenu",
  "en-veille": "En veille",
  abandonne: "Abandonné",
  recherche: "Recherche",
};

const KIND_LABEL: Record<JailbreakMethod["kind"], string> = {
  "semi-untethered": "Semi-untethered",
  "semi-tethered": "Semi-tethered",
  tethered: "Tethered",
  untethered: "Untethered",
  "semi-jailbreak": "Semi-jailbreak",
  bootstrap: "Bootstrap",
  installateur: "Installateur",
};

function hostLabel(host: JailbreakMethod["hosts"][number]): string {
  switch (host) {
    case "appareil":
      return "Sur l'appareil";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "Windows";
  }
}

const PLAN_OUTCOME_STYLE: Record<JailbreakPlan["outcome"], { label: string; color: string; background: string }> = {
  "pret-a-appliquer": { label: "Prêt à appliquer", color: "#00E676", background: "rgba(0,230,118,0.12)" },
  "action-manuelle": { label: "Action manuelle", color: "#FFC107", background: "rgba(255,193,7,0.12)" },
  bloque: { label: "Bloqué", color: "#FF1744", background: "rgba(255,23,68,0.12)" },
  indisponible: { label: "Indisponible", color: "#8B8B9E", background: "rgba(139,139,158,0.12)" },
};

const CONFIRMATION_WORD = "JAILBREAK";

function openSource(url: string) {
  try {
    window.novaunlock?.openExternal?.(url);
  } catch {
    // L'ouverture externe est optionnelle : ne jamais interrompre l'affichage.
  }
}

function VerdictBadge({ verdict }: { verdict: CompatVerdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <span
      className="rounded px-2 py-0.5 font-mono text-xs"
      style={{ color: style.color, backgroundColor: style.background }}
    >
      {style.label}
    </span>
  );
}

function MethodCard({
  evaluation,
  expanded,
  onToggle,
}: {
  evaluation: MethodEvaluation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { method, verdict, reasons, hostWarnings } = evaluation;
  const detailsId = `methode-${method.id}-details`;

  return (
    <article
      className="rounded-2xl border border-border bg-surface p-4"
      data-testid={`methode-${method.id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold text-foreground">{method.name}</h4>
          <VerdictBadge verdict={verdict} />
          {method.recommended && (
            <span className="rounded bg-success/15 px-2 py-0.5 font-mono text-xs text-success">
              Préconisée
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded bg-border/60 px-2 py-0.5 font-mono">{KIND_LABEL[method.kind]}</span>
          <span className="rounded bg-border/60 px-2 py-0.5 font-mono">{STATUS_LABEL[method.status]}</span>
        </div>
      </header>

      <p className="mt-2 text-sm text-muted">{method.summary}</p>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted">Dernière version connue</dt>
          <dd className="font-mono text-foreground">{method.lastRelease}</dd>
        </div>
        <div>
          <dt className="text-muted">Exécution depuis</dt>
          <dd className="font-mono text-foreground">
            {method.hosts.map(hostLabel).join(" • ")}
          </dd>
        </div>
      </dl>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      )}

      {hostWarnings.map((warning) => (
        <p
          key={warning}
          className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground"
        >
          ⚠ {warning}
        </p>
      ))}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="mt-3 w-full rounded-xl border border-border bg-background/50 py-2 text-sm font-semibold text-accent"
      >
        {expanded ? "Masquer le détail" : "Voir prérequis, étapes et sources"}
      </button>

      {expanded && (
        <div id={detailsId} className="mt-4 space-y-4">
          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Prérequis</h5>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {method.requires.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {method.steps.length > 0 && (
            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Étapes</h5>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
                {method.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Risques et limites</h5>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {method.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Sources officielles</h5>
            <div className="mt-2 flex flex-wrap gap-2">
              {method.sources.map((source) => (
                <button
                  key={source.url}
                  type="button"
                  onClick={() => openSource(source.url)}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-accent"
                  title={source.url}
                >
                  {source.label} ↗
                </button>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted">
            Informations vérifiées le {method.verifiedAt} — {method.verifiedFrom}. Les périmètres
            évoluent : confirmez toujours sur la source avant d'agir.
          </p>
        </div>
      )}
    </article>
  );
}

export default function Jailbreak() {
  const connection = useDeviceStore((state) => state.connection);
  const deviceInfo = useDeviceStore((state) => state.deviceInfo);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");
  const [chipOverride, setChipOverride] = useState("");
  const [iosOverride, setIosOverride] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("pertinentes");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [devicePaired, setDevicePaired] = useState(false);
  const [artifactPath, setArtifactPath] = useState<string | null>(null);
  const [artifactNotice, setArtifactNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [operation, setOperation] = useState<JailbreakOperationStatus | null>(null);
  const [applyError, setApplyError] = useState("");

  const isApplying = operation?.state === "queued" || operation?.state === "running";

  const iosVersion = deviceInfo.iosVersion || iosOverride || null;

  const analysis = useMemo(
    () =>
      analyseCatalogue(
        {
          modelIdentifier: deviceInfo.modelIdentifier,
          iosVersion,
          chipOverride: chipOverride || null,
        },
        JAILBREAK_METHODS
      ),
    [deviceInfo.modelIdentifier, iosVersion, chipOverride]
  );

  const evaluations = useMemo(() => sortEvaluations(analysis.evaluations), [analysis.evaluations]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return evaluations.filter((evaluation) => {
      const { method, verdict } = evaluation;
      if (filter === "compatibles" && verdict !== "compatible") return false;
      if (
        filter === "pertinentes" &&
        verdict !== "compatible" &&
        verdict !== "hors-plage" &&
        verdict !== "inconnu"
      ) {
        return false;
      }
      if (filter === "inventaire" && verdict !== "hors-evaluation") return false;
      if (!normalized) return true;
      return [method.name, method.summary, method.exploit, method.kind]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [evaluations, filter, query]);

  const analyseDevice = async () => {
    setIsAnalyzing(true);
    setNotice("");
    try {
      if (connection.isConnected) {
        await DeviceDetector.fetchDeviceInfo();
      } else {
        const detected = await DeviceDetector.scan();
        if (!detected) {
          setNotice(
            "Aucun appareil détecté. Vérifiez le câble USB, déverrouillez l’iPhone et acceptez « Faire confiance à cet ordinateur »."
          );
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

  const refreshCapabilities = useCallback(async () => {
    try {
      const capabilities = await window.novaunlock?.jailbreakCapabilities?.();
      setInstallReady(Boolean(capabilities?.installReady));
      setDevicePaired(Boolean(capabilities?.devicePaired));
    } catch {
      setInstallReady(false);
      setDevicePaired(false);
    }
  }, []);

  useEffect(() => {
    void refreshCapabilities();
  }, [refreshCapabilities, connection.isConnected]);

  // Suivi de l'opération en cours : l'état vient du processus principal.
  useEffect(() => {
    if (!operation || (operation.state !== "queued" && operation.state !== "running")) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const status = await window.novaunlock?.getJailbreakOperationStatus?.(operation.id);
        if (!cancelled && status) {
          setOperation(status);
          if (status.state !== "queued" && status.state !== "running") void refreshCapabilities();
        }
      } catch {
        // Un échec de lecture ne doit pas interrompre l'application en cours.
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [operation, refreshCapabilities]);

  const autoSelection = useMemo(() => selectAutoMethod(analysis.evaluations), [analysis.evaluations]);

  const selectedEvaluation = useMemo(() => {
    if (!selectedMethodId) return autoSelection;
    return (
      analysis.evaluations.find((evaluation) => evaluation.method.id === selectedMethodId) ?? autoSelection
    );
  }, [analysis.evaluations, autoSelection, selectedMethodId]);

  const plan = useMemo(() => {
    if (!selectedEvaluation) return null;
    return buildJailbreakPlan({
      method: selectedEvaluation.method,
      verdict: selectedEvaluation.verdict,
      chip: analysis.chip,
      iosVersion: analysis.iosVersion,
      installReady,
      devicePaired,
      artifactPath,
    });
  }, [selectedEvaluation, analysis.chip, analysis.iosVersion, installReady, devicePaired, artifactPath]);

  const confirmationOk = confirmation.trim().toUpperCase() === CONFIRMATION_WORD;
  const canApply = Boolean(
    plan && plan.outcome === "pret-a-appliquer" && isPlanConsistent(plan) && consent && confirmationOk && !isApplying
  );

  const chooseArtifact = async () => {
    setArtifactNotice("");
    try {
      const selected = await window.novaunlock?.selectJailbreakIpa?.();
      if (!selected) {
        setArtifactNotice("Sélection annulée : aucun IPA retenu.");
        return;
      }
      setArtifactPath(selected);
      setArtifactNotice(
        "IPA sélectionné. Son empreinte SHA-256 sera calculée et affichée pendant l'installation."
      );
    } catch {
      setArtifactNotice("La sélection du fichier a échoué. Réessayez depuis le plan d'application.");
    }
  };

  const applyPlan = async () => {
    if (!plan || !canApply) return;
    setApplyError("");
    try {
      const started = await window.novaunlock?.applyJailbreak?.(toJailbreakAction(plan));
      if (started) {
        setOperation(started);
      } else {
        setApplyError("Le pont Electron n'expose pas l'application assistée dans cette version.");
      }
    } catch (error: unknown) {
      setApplyError(
        error instanceof Error
          ? error.message
          : "L'application assistée a échoué. Vérifiez l'appareil et les outils natifs."
      );
    }
  };

  const verdictSummary = analysis.chip
    ? `${analysis.counts.compatible} méthode(s) compatible(s) · ${analysis.counts.horsPlage} hors plage · ${analysis.counts.nonSupporte} non prise(s) en charge`
    : "Puce et version iOS à déterminer pour calculer la compatibilité";

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">Assistant jailbreak</h2>
        <p className="text-sm text-muted">
          Catalogue documentaire des méthodes publiques, avec la compatibilité calculée pour l’appareil
          connecté.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs text-accent">
          Windows • USB • catalogue vérifié
        </span>
        <span className="rounded bg-border/60 px-2 py-0.5 font-mono text-xs text-muted">
          {JAILBREAK_METHODS.length} entrées · vérifiées le {CATALOGUE_VERIFIED_AT}
        </span>
      </div>

      <section
        className="mb-5 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="device-profile-title"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            id="device-profile-title"
            className="text-sm font-semibold uppercase tracking-wider text-muted"
          >
            Profil de l’appareil
          </h3>
          <span className="text-xs text-muted">{connection.isConnected ? "Connecté" : "Déconnecté"}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Modèle</p>
            <p className="font-mono text-sm text-foreground">
              {analysis.deviceName || deviceInfo.model || "À détecter"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Identifiant</p>
            <p className="font-mono text-sm text-foreground">{deviceInfo.modelIdentifier || "À détecter"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Version iOS</p>
            <p className="font-mono text-sm text-foreground">{iosVersion || "À détecter"}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Puce (détection automatique ou choix manuel)
            <select
              value={chipOverride}
              onChange={(event) => setChipOverride(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
            >
              <option value="">
                {analysis.chipSource === "auto" && analysis.chip
                  ? `Automatique — ${analysis.chip.label}`
                  : "Sélectionner la puce…"}
              </option>
              {SELECTABLE_CHIPS.map((chip) => (
                <option key={chip.id} value={chip.id}>
                  {chip.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted">
            Version iOS si l’appareil n’est pas connecté
            <input
              value={iosOverride}
              onChange={(event) => setIosOverride(event.target.value)}
              placeholder="ex. 16.7.1"
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          {analysis.chip
            ? `Puce retenue : ${analysis.chip.label} (${analysis.chip.architecture})${
                analysis.chipSource === "auto" ? " — déduite du modèle" : " — choisie manuellement"
              }.`
            : "Puce inconnue : choisissez-la manuellement ou connectez l’appareil pour lire son identifiant matériel."}
        </p>

        <button
          type="button"
          onClick={analyseDevice}
          disabled={isAnalyzing}
          className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isAnalyzing
            ? "Analyse en cours…"
            : connection.isConnected
              ? "Analyser / actualiser l’appareil"
              : "Détecter l’iPhone connecté"}
        </button>
        {notice && (
          <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">
            {notice}
          </p>
        )}
      </section>

      <section
        className="mb-5 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="verdict-title"
      >
        <h3 id="verdict-title" className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Résultat de compatibilité
        </h3>
        <p className="font-semibold text-foreground" data-testid="verdict-summary">
          {verdictSummary}
        </p>
        {analysis.chip && analysis.counts.compatible === 0 && (
          <p className="mt-2 text-sm text-muted">
            Aucune méthode publique documentée ne couvre cette combinaison puce + version. Attendez une
            nouvelle publication ou vérifiez l’inventaire de référence ; n’utilisez jamais un outil
            « en ligne » promettant un jailbreak universel.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Règle appliquée : la puce et la version iOS de l’appareil sont comparées aux périmètres publiés
          par les projets. Une méthode « hors plage » couvre bien la puce, mais pas cette version.
        </p>
      </section>

      <section
        className="mb-5 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="assisted-title"
        data-testid="assisted-application"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="assisted-title" className="text-sm font-semibold uppercase tracking-wider text-muted">
            Application assistée
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className="rounded px-2 py-0.5 font-mono"
              style={{
                color: installReady ? "#00E676" : "#FFC107",
                backgroundColor: installReady ? "rgba(0,230,118,0.12)" : "rgba(255,193,7,0.12)",
              }}
              data-testid="installer-status"
            >
              {installReady ? "ideviceinstaller prêt" : "ideviceinstaller absent"}
            </span>
            <span
              className="rounded px-2 py-0.5 font-mono"
              style={{
                color: devicePaired ? "#00E676" : "#FFC107",
                backgroundColor: devicePaired ? "rgba(0,230,118,0.12)" : "rgba(255,193,7,0.12)",
              }}
              data-testid="pairing-status"
            >
              {devicePaired ? "Appareil appairé" : "Aucun appareil appairé"}
            </span>
          </div>
        </div>

        {!selectedEvaluation || !plan ? (
          <p className="text-sm text-muted" data-testid="no-auto-method">
            Aucune méthode compatible avec les informations reçues de l'appareil. Connectez-le, ou renseignez
            sa puce et sa version iOS ci-dessus : le système retiendra automatiquement la méthode adaptée.
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground" data-testid="auto-selection">
              {selectedMethodId
                ? "Méthode choisie : "
                : "Méthode retenue automatiquement : "}
              <span className="font-semibold">{selectedEvaluation.method.name}</span>{" "}
              <span className="text-muted">
                ({selectedEvaluation.method.kind}, {selectedEvaluation.method.status})
              </span>
            </p>

            <label className="mt-3 block text-xs text-muted">
              Remplacer la méthode retenue
              <select
                value={selectedMethodId ?? ""}
                onChange={(event) => {
                  setSelectedMethodId(event.target.value || null);
                  setArtifactPath(null);
                  setArtifactNotice("");
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                aria-label="Remplacer la méthode retenue"
              >
                <option value="">
                  Automatique — {autoSelection ? autoSelection.method.name : "aucune méthode compatible"}
                </option>
                {sortEvaluations(analysis.evaluations).map((evaluation) => (
                  <option key={evaluation.method.id} value={evaluation.method.id}>
                    {evaluation.method.name} — {VERDICT_STYLE[evaluation.verdict].label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 font-mono text-xs"
                style={{
                  color: PLAN_OUTCOME_STYLE[plan.outcome].color,
                  backgroundColor: PLAN_OUTCOME_STYLE[plan.outcome].background,
                }}
                data-testid="plan-outcome"
              >
                {PLAN_OUTCOME_STYLE[plan.outcome].label}
              </span>
              <span className="font-mono text-xs text-muted" data-testid="plan-kind">
                {plan.kind === "install-ipa" ? "Installation IPA depuis ce PC" : "Étapes manuelles"}
              </span>
            </div>

            {plan.blockers.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-foreground">
                {plan.blockers.map((blocker) => (
                  <li key={blocker}>✕ {blocker}</li>
                ))}
              </ul>
            )}

            {plan.steps.length > 0 && (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground">
                {plan.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}

            <ul className="mt-3 space-y-1 text-xs text-muted">
              {plan.warnings.map((warning) => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>

            {plan.kind === "install-ipa" && (
              <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs text-muted">
                  NovaUnlock n'héberge ni ne télécharge aucun IPA de jailbreak. Téléchargez-le depuis la source
                  officielle, puis sélectionnez le fichier local.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={chooseArtifact}
                    className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    Choisir l'IPA téléchargé…
                  </button>
                  <button
                    type="button"
                    onClick={() => openSource(plan.sourceUrl)}
                    className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    Source officielle de {plan.methodName} ↗
                  </button>
                </div>
                {artifactPath && (
                  <p className="mt-2 font-mono text-xs text-foreground" data-testid="artifact-path">
                    {artifactPath}
                  </p>
                )}
                {artifactNotice && (
                  <p className="mt-2 text-xs text-muted" role="status" aria-live="polite">
                    {artifactNotice}
                  </p>
                )}

                <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5"
                    aria-label="Consentement propriétaire"
                  />
                  <span>
                    Je suis propriétaire de cet appareil (ou autorisé à l'administrer) et j'accepte les risques
                    d'un jailbreak : perte de garantie logicielle, instabilité et incompatibilités applicatives.
                  </span>
                </label>

                <label className="mt-3 block text-xs text-muted">
                  Saisissez {CONFIRMATION_WORD} pour confirmer l'installation
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder={CONFIRMATION_WORD}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                    aria-label="Confirmation d'installation"
                  />
                </label>

                <button
                  type="button"
                  onClick={applyPlan}
                  disabled={!canApply}
                  className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="apply-button"
                >
                  {isApplying
                    ? "Application en cours…"
                    : `Installer ${plan.methodName} sur l'appareil appairé`}
                </button>
              </div>
            )}

            {plan.kind === "manual" && plan.outcome !== "indisponible" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openSource(plan.sourceUrl)}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-accent"
                >
                  Ouvrir la source officielle de {plan.methodName} ↗
                </button>
                <span className="text-xs text-muted">
                  Aucune commande n'est exécutée par NovaUnlock pour cette méthode.
                </span>
              </div>
            )}

            {applyError && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {applyError}
              </p>
            )}

            {operation && (
              <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3" data-testid="operation">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{operation.stage}</p>
                  <span className="font-mono text-xs text-muted">
                    {operation.progress != null ? `${operation.progress}%` : "…"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${operation.progress ?? 0}%`,
                      backgroundColor:
                        operation.state === "failed" || operation.state === "blocked" ? "#FF1744" : "#00E676",
                    }}
                  />
                </div>
                {operation.result && (
                  <>
                    <p
                      className={`mt-2 text-sm ${
                        operation.result.success ? "text-foreground" : "text-danger"
                      }`}
                    >
                      {operation.result.message}
                    </p>
                    {operation.result.artifact && (
                      <p className="mt-1 font-mono text-xs text-muted">
                        {operation.result.artifact.fileName} • {operation.result.artifact.size} • SHA-256{" "}
                        {operation.result.artifact.sha256.slice(0, 16)}…
                      </p>
                    )}
                  </>
                )}
                <p className="mt-2 text-xs text-muted">
                  Opération consignée dans le journal local d'audit (identifiant d'appareil haché).
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mb-5" aria-labelledby="catalogue-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="catalogue-title" className="text-sm font-semibold uppercase tracking-wider text-muted">
            Méthodes ({visible.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une méthode"
              aria-label="Rechercher une méthode"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                filter === item.id
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border bg-background/50 text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visible.map((evaluation) => (
            <MethodCard
              key={evaluation.method.id}
              evaluation={evaluation}
              expanded={expandedId === evaluation.method.id}
              onToggle={() =>
                setExpandedId((current) => (current === evaluation.method.id ? null : evaluation.method.id))
              }
            />
          ))}
          {visible.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              Aucune méthode ne correspond au filtre ou à la recherche. Essayez « Toutes » ou l’inventaire.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="policy-title">
        <h3 id="policy-title" className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Ce que NovaUnlock fait — et ne fait pas
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
          <li>
            Cet écran ne télécharge, n’installe et n’exécute aucune charge utile de jailbreak : il
            documente les méthodes publiques et ouvre leurs sources officielles dans votre navigateur.
          </li>
          <li>
            Aucune méthode ne contourne un code d’accès, Activation Lock/iCloud, une SIM ou Temps
            d’écran, et NovaUnlock ne sait pas le faire.
          </li>
          <li>
            Méfiez-vous des sites qui promettent un « jailbreak en ligne sans ordinateur » : les projets
            légitimes publient leur code et leurs binaires sur GitHub ou leur site officiel.
          </li>
          <li>
            Sauvegardez l’appareil et conservez ses blobs SHSH avant toute modification : un retour vers
            une version non signée par Apple est impossible sans eux.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => openSource(IOS_CFW_GUIDE)}
          className="mt-4 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-accent"
        >
          Guide communautaire ios.cfw.guide ↗
        </button>
      </section>
    </div>
  );
}
