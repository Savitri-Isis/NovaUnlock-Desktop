/**
 * NovaUnlock — Plan de jailbreak : validation et mise en forme de l'action
 *
 * Ce module est volontairement pur : il valide une action reçue du renderer
 * isolé, décrit un artefact local et refuse tout ce qui sort du périmètre
 * autorisé. Aucune commande n'est lancée ici ; l'exécution se limite à
 * `ideviceinstaller` (voir `jailbreak-executor.ts`).
 *
 * Règles appliquées :
 *  - aucune méthode n'est codée en dur comme « binaire automatique » : la
 *    source doit figurer dans la liste blanche des liens externes ;
 *  - l'artefact doit être un fichier `.ipa` absolu choisi explicitement par
 *    l'utilisateur, jamais téléchargé par l'application ;
 *  - une action « manuelle » ne peut déclencher aucun processus.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { isAllowedExternalUrl } from "./external-links";

export type JailbreakActionKind = "install-ipa" | "manual";

export interface JailbreakAction {
  methodId: string;
  methodName: string;
  kind: JailbreakActionKind;
  /** Source officielle consultable (liste blanche des liens externes). */
  sourceUrl: string;
  /** Chemin absolu d'un IPA déjà présent sur le disque (kind = install-ipa). */
  artifactPath?: string;
  /** Étapes à exécuter par l'utilisateur (kind = manual). */
  manualSteps?: string[];
}

export interface ArtifactDescription {
  path: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  looksLikeIpa: boolean;
  warning: string | null;
}

const METHOD_ID_RE = /^[a-z0-9-]{2,40}$/;
const MAX_MANUAL_STEPS = 12;
const MAX_STEP_LENGTH = 300;

function bad(message: string): never {
  throw new Error(message);
}

function validateSourceUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    bad("Source officielle manquante pour cette méthode.");
  }
  const url = (raw as string).trim();
  if (!isAllowedExternalUrl(url)) {
    bad("La source de cette méthode n'est pas dans la liste des sites officiels autorisés.");
  }
  return url;
}

export function validateJailbreakAction(raw: unknown): JailbreakAction {
  if (!raw || typeof raw !== "object") bad("Plan de jailbreak invalide.");
  const candidate = raw as Record<string, unknown>;

  const methodId = typeof candidate.methodId === "string" ? candidate.methodId.trim() : "";
  if (!METHOD_ID_RE.test(methodId)) bad("Identifiant de méthode invalide.");

  const methodName =
    typeof candidate.methodName === "string" ? candidate.methodName.trim().slice(0, 80) : "";
  if (methodName.length === 0) bad("Nom de méthode manquant.");

  const kind = candidate.kind;
  if (kind !== "install-ipa" && kind !== "manual") bad("Type d'action de jailbreak invalide.");

  const sourceUrl = validateSourceUrl(candidate.sourceUrl);

  if (kind === "install-ipa") {
    const artifactPath = typeof candidate.artifactPath === "string" ? candidate.artifactPath.trim() : "";
    if (artifactPath.length === 0 || artifactPath.length > 4096) {
      bad("Chemin de l'IPA manquant : sélectionnez le fichier téléchargé depuis la source officielle.");
    }
    if (!path.isAbsolute(artifactPath)) {
      bad("Le chemin de l'IPA doit être absolu.");
    }
    if (path.extname(artifactPath).toLowerCase() !== ".ipa") {
      bad("Seul un fichier .ipa peut être installé par cette action.");
    }
    const resolved = path.resolve(artifactPath);
    return { methodId, methodName, kind, sourceUrl, artifactPath: resolved };
  }

  const steps = Array.isArray(candidate.manualSteps)
    ? candidate.manualSteps
        .filter((step): step is string => typeof step === "string")
        .map((step) => step.trim().slice(0, MAX_STEP_LENGTH))
        .filter((step) => step.length > 0)
    : [];
  if (steps.length === 0) {
    bad("Une action manuelle doit décrire au moins une étape.");
  }
  return { methodId, methodName, kind, sourceUrl, manualSteps: steps.slice(0, MAX_MANUAL_STEPS) };
}

/** Lit les 4 premiers octets et vérifie la signature ZIP locale (`PK\x03\x04`). */
export function hasZipMagic(filePath: string): boolean {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(filePath, "r");
    const header = Buffer.alloc(4);
    const read = fs.readSync(descriptor, header, 0, 4, 0);
    if (read < 4) return false;
    return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
  } catch {
    return false;
  } finally {
    if (descriptor != null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Le descripteur peut déjà être fermé par le système.
      }
    }
  }
}

/**
 * Décrit l'artefact avant installation : taille, empreinte SHA-256 et contrôle
 * de conteneur ZIP. Un fichier qui n'est pas un conteneur ZIP est signalé mais
 * n'est pas refusé ici : la décision finale revient à l'appelant.
 */
export function describeArtifact(artifactPath: string, onProgress?: (fraction: number) => void): ArtifactDescription {
  const stats = fs.statSync(artifactPath);
  if (!stats.isFile()) bad("L'artefact sélectionné n'est pas un fichier.");
  if (stats.size === 0) bad("Le fichier IPA sélectionné est vide.");

  const hash = crypto.createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  let processed = 0;
  const descriptor = fs.openSync(artifactPath, "r");
  try {
    let read = fs.readSync(descriptor, buffer, 0, buffer.length, processed);
    while (read > 0) {
      hash.update(buffer.subarray(0, read));
      processed += read;
      onProgress?.(processed / stats.size);
      read = fs.readSync(descriptor, buffer, 0, buffer.length, processed);
    }
  } finally {
    fs.closeSync(descriptor);
  }

  const looksLikeIpa = hasZipMagic(artifactPath);
  return {
    path: artifactPath,
    fileName: path.basename(artifactPath),
    sizeBytes: stats.size,
    sha256: hash.digest("hex"),
    looksLikeIpa,
    warning: looksLikeIpa
      ? null
      : "Ce fichier n'a pas la signature d'un conteneur ZIP : il ne s'agit probablement pas d'un IPA valide.",
  };
}

/** Résumé lisible de la taille d'un artefact. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}
