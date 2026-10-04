/**
 * NovaUnlock — Exécuteur d'action jailbreak
 *
 * Périmètre strictement limité à deux choses :
 *  1. vérifier un IPA choisi par l'utilisateur (taille, empreinte, conteneur) ;
 *  2. l'installer sur l'appareil appairé avec `ideviceinstaller.exe` du paquet
 *     libimobiledevice déjà vérifié, quand il est présent.
 *
 * Aucun binaire de jailbreak n'est téléchargé, exécuté ou injecté par
 * NovaUnlock : l'installation ne fait que poser l'application sur l'appareil,
 * où l'utilisateur la lance lui-même. Une action « manuelle » n'exécute aucun
 * processus et se contente de renvoyer ses étapes.
 */

import {
  describeArtifact,
  formatBytes,
  validateJailbreakAction,
  type JailbreakAction,
} from "./jailbreak-plan";
import { resolveNativeTool } from "./native-tools";
import { getConnectedUdid, runNativeToolCommand } from "./usb-scanner";

export interface JailbreakProgress {
  progress: number;
  stage: string;
  speed?: string;
}

export interface JailbreakExecutionResult {
  success: boolean;
  methodId: string;
  methodName: string;
  kind: JailbreakAction["kind"];
  stage: string;
  message: string;
  artifact?: {
    fileName: string;
    size: string;
    sha256: string;
  };
  /** Sortie brute tronquée de ideviceinstaller, utile au diagnostic. */
  toolOutput?: string;
}

export type ProgressReporter = (progress: JailbreakProgress) => void;

const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;

/** `ideviceinstaller.exe` est-il présent dans le paquet natif vérifié ? */
export function resolveInstallerTool(): string | null {
  return resolveNativeTool("installer");
}

/** Dépendances injectables : les tests vérifient le contrat sans appareil réel. */
export interface JailbreakExecutorDeps {
  resolveInstaller: () => string | null;
  runCommand: typeof runNativeToolCommand;
  getUdid: () => string | null;
}

const defaultDeps: JailbreakExecutorDeps = {
  resolveInstaller: resolveInstallerTool,
  runCommand: runNativeToolCommand,
  getUdid: getConnectedUdid,
};

export async function executeJailbreakAction(
  rawAction: unknown,
  onProgress?: ProgressReporter,
  deps: JailbreakExecutorDeps = defaultDeps
): Promise<JailbreakExecutionResult> {
  const action = validateJailbreakAction(rawAction);

  if (action.kind === "manual") {
    onProgress?.({ progress: 100, stage: "Étapes manuelles disponibles" });
    return {
      success: true,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "manual",
      stage: "Action manuelle",
      message:
        "Cette méthode ne peut pas être lancée depuis Windows : suivez les étapes affichées depuis un poste compatible et la source officielle.",
    };
  }

  const installPath = deps.resolveInstaller();
  if (!installPath) {
    return {
      success: false,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "install-ipa",
      stage: "Outil manquant",
      message:
        "ideviceinstaller.exe est absent du paquet libimobiledevice configuré. Ajoutez-le (il provient du même paquet officiel) avant d'installer un IPA.",
    };
  }

  const artifactPath = action.artifactPath as string;

  let description;
  try {
    description = describeArtifact(artifactPath, (fraction) =>
      onProgress?.({
        progress: Math.min(60, Math.round(fraction * 60)),
        stage: "Vérification de l'IPA (empreinte SHA-256)…",
      })
    );
  } catch (error: unknown) {
    return {
      success: false,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "install-ipa",
      stage: "Vérification impossible",
      message: error instanceof Error ? error.message.slice(0, 300) : "IPA illisible.",
    };
  }

  if (!description.looksLikeIpa) {
    return {
      success: false,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "install-ipa",
      stage: "Fichier refusé",
      message: `Le fichier « ${description.fileName} » n'est pas un conteneur IPA (ZIP) valide.`,
    };
  }

  const udid = deps.getUdid();
  if (!udid) {
    return {
      success: false,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "install-ipa",
      stage: "Appareil non appairé",
      message: "Aucun appareil appairé : connectez-le, déverrouillez-le et acceptez « Faire confiance ».",
    };
  }

  onProgress?.({
    progress: 65,
    stage: `Installation de ${description.fileName} (${formatBytes(description.sizeBytes)}) sur l'appareil…`,
  });

  let lastReported = 65;
  const outcome = await deps.runCommand(installPath, ["-u", udid, "-i", artifactPath], INSTALL_TIMEOUT_MS, (text) => {
    // ideviceinstaller affiche sa progression en pourcentage : on la relaie
    // bornée entre 65 et 99 %, sans jamais dépasser la fin réelle.
    const matches = text.match(/(\d{1,3})%/g);
    if (!matches) return;
    const latest = Number.parseInt(matches[matches.length - 1].replace("%", ""), 10);
    if (!Number.isFinite(latest)) return;
    const scaled = 65 + Math.round((Math.max(0, Math.min(100, latest)) / 100) * 34);
    lastReported = Math.max(lastReported, Math.min(99, scaled));
    onProgress?.({ progress: lastReported, stage: "Installation en cours sur l'appareil…" });
  });

  const artifact = {
    fileName: description.fileName,
    size: formatBytes(description.sizeBytes),
    sha256: description.sha256,
  };

  if (outcome.code === 0) {
    onProgress?.({ progress: 100, stage: "IPA installé" });
    return {
      success: true,
      methodId: action.methodId,
      methodName: action.methodName,
      kind: "install-ipa",
      stage: "Installation terminée",
      message:
        "IPA installé. Sur l'appareil, ouvrez l'application jailbreak et lancez la procédure indiquée par la méthode : NovaUnlock n'exécute rien à votre place.",
      artifact,
      toolOutput: outcome.output.slice(-2000),
    };
  }

  const failure = outcome.error || `code ${outcome.code ?? "inconnu"}`;
  return {
    success: false,
    methodId: action.methodId,
    methodName: action.methodName,
    kind: "install-ipa",
    stage: "Échec de l'installation",
    message: `ideviceinstaller a échoué (${failure}). Vérifiez que l'appareil est déverrouillé, appairé, et que l'IPA correspond bien à la méthode et à la version iOS.`,
    artifact,
    toolOutput: outcome.output.slice(-2000),
  };
}
