import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import axios from "axios";
import type { NativeToolStatus } from "./native-tools";

export type MasterTask =
  | "inspect"
  | "backup"
  | "screenpass"
  | "factory-reset"
  | "versioning"
  | "screen-time"
  | "sim-assist";

export const VALID_MASTER_TASKS: readonly MasterTask[] = [
  "inspect",
  "backup",
  "screenpass",
  "factory-reset",
  "versioning",
  "screen-time",
  "sim-assist",
] as const;

export type DestructiveMasterTask = "screenpass" | "factory-reset" | "versioning";

export interface BackupSummary {
  path: string;
  name: string;
  productType: string;
  iosVersion: string;
  encrypted: boolean;
  sizeMb: number;
  modifiedAt: string;
}

export interface MasterDeviceContext {
  modelIdentifier?: string | null;
  serial?: string | null;
  mode?: string;
  activationLockStatus?: string | null;
}

export interface MasterCapabilities {
  diagnosticsReady: boolean;
  backupReady: boolean;
  restoreReady: boolean;
  activationCheckReady: boolean;
}

export interface PreflightResult {
  task: MasterTask;
  ok: boolean;
  /** A preflight never performs an action; execution is a separate, explicit step. */
  dryRun: true;
  /** True only if the guarded execution endpoint may be used. */
  canExecute: boolean;
  blockers: string[];
  warnings: string[];
  steps: string[];
  activationLockNotice: string;
  backupCount: number;
  diskFreeGb: number;
  requirements: {
    ownerAttestation: boolean;
    typedConfirmation: boolean;
    backupPassword: boolean;
    firmwareFile: boolean;
    requiredMode: "normal" | "dfu-or-recovery" | null;
  };
  capabilities?: MasterCapabilities;
}

export interface ParsedPlistMetadata {
  name: string;
  productType: string;
  iosVersion: string;
  isEncrypted: boolean | null;
  isBinary: boolean;
}

const APPLE_ID_RE = /^(iPhone|iPad|iPod)[0-9]+,[0-9]+$/i;
const ALLOWED_FIRMWARE_HOSTS = ["ipsw.me", "apple.com", "cdn-apple.com", "applecdn.com"];
const AUDIT_EVENT_RE = /^[\p{L}\p{N} .,:;_/-]+$/u;

function isAllowedFirmwareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_FIRMWARE_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function validateMasterTask(task: unknown): MasterTask {
  if (typeof task !== "string" || !VALID_MASTER_TASKS.includes(task as MasterTask)) {
    throw new Error(`Tâche maître invalide: ${String(task)}`);
  }
  return task as MasterTask;
}

export function isDestructiveMasterTask(task: MasterTask): task is DestructiveMasterTask {
  return task === "screenpass" || task === "factory-reset" || task === "versioning";
}

export function validateFirmwareUrl(rawUrl: unknown): URL {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new Error("URL firmware manquante ou invalide.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Format d'URL firmware invalide.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("URL firmware non sécurisée : seul HTTPS est autorisé.");
  }

  const host = parsed.hostname.toLowerCase();
  const isAllowedHost = isAllowedFirmwareHost(host);
  if (!isAllowedHost) {
    throw new Error(
      `Domaine non autorisé pour le téléchargement firmware (${host}). Domaines autorisés: ${ALLOWED_FIRMWARE_HOSTS.join(", ")}`
    );
  }

  return parsed;
}

export function getFreeDiskSpaceGb(targetPath: string = os.homedir()): number {
  try {
    let existingTarget = path.resolve(targetPath);
    // The destination folder may not exist yet. Walk to its closest existing
    // ancestor so a redirected Documents/Downloads drive is measured correctly.
    while (!fs.existsSync(existingTarget) && path.dirname(existingTarget) !== existingTarget) {
      existingTarget = path.dirname(existingTarget);
    }
    if (!fs.existsSync(existingTarget)) existingTarget = os.homedir();
    if (typeof fs.statfsSync === "function") {
      const stats = fs.statfsSync(existingTarget);
      const freeBytes = Number(stats.bavail) * Number(stats.bsize);
      if (Number.isFinite(freeBytes) && freeBytes >= 0) {
        return Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10;
      }
    }
  } catch {
    // Repli sûr pour les systèmes sans statfsSync.
  }
  return 0;
}

function managedBackupRoot(): string {
  const documents = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "Documents")
    : path.join(os.homedir(), "Documents");
  return path.join(documents, "NovaUnlock", "Backups");
}

function backupRoots(): string[] {
  const roots = [
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "Apple Computer", "MobileSync", "Backup")
      : "",
    path.join(os.homedir(), "Apple", "MobileSync", "Backup"),
    managedBackupRoot(),
  ];
  return [...new Set(roots.filter(Boolean))];
}

export function parsePlistContent(input: Buffer | string): ParsedPlistMetadata {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  const isBinary = buffer.subarray(0, 8).toString("ascii") === "bplist00";

  if (isBinary) {
    // Extraction non invasive de chaînes lisibles : aucun bplist n'est exécuté.
    const ascii = buffer.toString("latin1");
    const modelMatch = ascii.match(/(iPhone|iPad|iPod)[0-9]+,[0-9]+/);
    return {
      name: "",
      productType: modelMatch ? modelMatch[0] : "",
      iosVersion: "",
      isEncrypted: null,
      isBinary: true,
    };
  }

  const text = buffer.toString("utf8");
  const getString = (key: string) =>
    text.match(new RegExp(`<key>${key}</key>\\s*<(?:string|date)>([^<]+)</(?:string|date)>`))?.[1]?.trim() ||
    "";
  const getBoolean = (key: string): boolean | null => {
    const match = text.match(new RegExp(`<key>${key}</key>\\s*<(true|false)\\s*/>`));
    return match ? match[1] === "true" : null;
  };

  return {
    name: getString("Device Name"),
    productType: getString("Product Type"),
    iosVersion: getString("Product Version"),
    isEncrypted: getBoolean("IsEncrypted"),
    isBinary: false,
  };
}

function readBackupMetadata(directory: string): ParsedPlistMetadata {
  const result: ParsedPlistMetadata = {
    name: "",
    productType: "",
    iosVersion: "",
    isEncrypted: null,
    isBinary: false,
  };

  for (const filename of ["Info.plist", "info.plist", "Manifest.plist", "Status.plist"]) {
    const filePath = path.join(directory, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = parsePlistContent(fs.readFileSync(filePath));
      if (parsed.name && !result.name) result.name = parsed.name;
      if (parsed.productType && !result.productType) result.productType = parsed.productType;
      if (parsed.iosVersion && !result.iosVersion) result.iosVersion = parsed.iosVersion;
      if (parsed.isEncrypted !== null && result.isEncrypted === null) result.isEncrypted = parsed.isEncrypted;
      if (parsed.isBinary) result.isBinary = true;
    } catch {
      // Un manifeste illisible ne doit pas interrompre le diagnostic local.
    }
  }
  return result;
}

function directorySize(directory: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const current = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile()) total += fs.statSync(current).size;
      else if (entry.isDirectory()) total += directorySize(current);
    }
  } catch {
    // Les entrées inaccessibles sont ignorées plutôt que de faire échouer tout l'inventaire.
  }
  return total;
}

function hasBackupManifest(directory: string): boolean {
  return ["Info.plist", "info.plist", "Manifest.plist", "Manifest.db"].some((name) =>
    fs.existsSync(path.join(directory, name))
  );
}

/**
 * iTunes stores UDID directories directly below its root, whereas idevicebackup2
 * releases may put them one level below the destination provided by NovaUnlock.
 */
function backupDirectoriesBelow(root: string): string[] {
  const candidates: string[] = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const direct = path.join(root, entry.name);
      candidates.push(direct);
      if (hasBackupManifest(direct)) continue;
      try {
        for (const nested of fs.readdirSync(direct, { withFileTypes: true })) {
          if (nested.isDirectory() && !nested.isSymbolicLink()) candidates.push(path.join(direct, nested.name));
        }
      } catch {
        // A protected child is ignored.
      }
    }
  } catch {
    // A backup root may be protected by Windows or removed during scanning.
  }
  return candidates;
}

export function discoverBackups(customRoots?: string[]): BackupSummary[] {
  const result: BackupSummary[] = [];
  const roots = customRoots ?? backupRoots();
  const visited = new Set<string>();

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const directory of backupDirectoriesBelow(root)) {
      const canonical = path.resolve(directory);
      if (visited.has(canonical) || !hasBackupManifest(canonical)) continue;
      visited.add(canonical);
      try {
        const metadata = readBackupMetadata(canonical);
        const stat = fs.statSync(canonical);
        result.push({
          path: canonical,
          name: metadata.name || path.basename(canonical),
          productType: metadata.productType,
          iosVersion: metadata.iosVersion,
          encrypted: metadata.isEncrypted === true,
          sizeMb: Math.round((directorySize(canonical) / (1024 * 1024)) * 100) / 100,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // A backup may disappear while it is inventoried.
      }
    }
  }

  return result.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

export function hashDeviceId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function capabilitySummary(status: NativeToolStatus): MasterCapabilities {
  return {
    diagnosticsReady: status.diagnosticsReady,
    backupReady: status.backupReady,
    restoreReady: status.restoreReady,
    activationCheckReady: status.activationCheckReady,
  };
}

/**
 * Performs checks only. It deliberately never launches a backup, an erase or a
 * restore. executeMasterOperation is responsible for the separate confirmed action.
 */
export function evaluatePreflight(
  task: MasterTask,
  device: MasterDeviceContext = {},
  nativeStatus?: NativeToolStatus
): PreflightResult {
  const validTask = validateMasterTask(task);
  const safeDevice = device && typeof device === "object" ? device : {};
  const backups = discoverBackups();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const destructive = isDestructiveMasterTask(validTask);
  const capabilities = nativeStatus ? capabilitySummary(nativeStatus) : undefined;

  if (!safeDevice.serial && validTask !== "sim-assist") {
    blockers.push("Aucun appareil identifié.");
    warnings.push("Connectez puis autorisez l'appareil avant de continuer.");
  }

  if (validTask === "backup" && safeDevice.mode !== "normal") {
    blockers.push("Une sauvegarde exige un appareil démarré, déverrouillé et appairé en mode normal.");
  }

  if (destructive && safeDevice.mode !== "dfu" && safeDevice.mode !== "recovery") {
    blockers.push("La restauration officielle exige le mode Recovery ou DFU avant l'exécution.");
  }

  if (destructive && backups.length === 0) {
    warnings.push(
      "Aucune sauvegarde locale détectée : l'opération peut entraîner une perte irréversible de données."
    );
  }

  const lockState = safeDevice.activationLockStatus || "unknown";
  if (destructive && lockState !== "unlocked") {
    blockers.push(
      "Le statut Activation Lock doit être explicitement confirmé comme déverrouillé avant une restauration. NovaUnlock ne contourne jamais ce verrouillage."
    );
    if (/^unknown$|^unavailable$/i.test(lockState)) {
      warnings.push(
        "Statut Activation Lock inconnu — assurez-vous de disposer des identifiants Apple du propriétaire avant toute restauration."
      );
    }
  } else if (/^locked$|actif|^on$/i.test(lockState)) {
    warnings.push("Le verrouillage d'activation est actif. Aucune restauration maître ne sera lancée.");
  }

  if (validTask === "versioning" && safeDevice.modelIdentifier && !APPLE_ID_RE.test(safeDevice.modelIdentifier)) {
    warnings.push("Identifiant modèle non reconnu : vérifiez la compatibilité avant de choisir un firmware.");
  }

  const diskTarget =
    validTask === "backup"
      ? managedBackupRoot()
      : destructive
      ? path.join(os.homedir(), "Downloads", "NovaUnlock")
      : os.homedir();
  const diskFreeGb = getFreeDiskSpaceGb(diskTarget);
  if ((destructive || validTask === "backup") && diskFreeGb > 0 && diskFreeGb < 10) {
    warnings.push(
      `Espace disque faible (${diskFreeGb} Go libres) : au moins 10 Go sont recommandés avant cette opération.`
    );
  }

  if (nativeStatus) {
    if ((validTask === "inspect" || validTask === "screen-time" || validTask === "sim-assist") && !nativeStatus.diagnosticsReady) {
      blockers.push("Les outils de diagnostic libimobiledevice sont absents ou incomplets.");
    }
    if (validTask === "backup" && !nativeStatus.backupReady) {
      blockers.push("idevicebackup2.exe est requis pour créer une sauvegarde locale.");
    }
    if (destructive && !nativeStatus.restoreReady) {
      blockers.push("idevicerestore.exe et irecovery.exe sont requis pour une restauration officielle.");
    }
    if (destructive && !nativeStatus.activationCheckReady) {
      blockers.push("ideviceactivation.exe est requis pour vérifier l'Activation Lock en mode fail-closed.");
    }
    if (!nativeStatus.hasDlls) {
      warnings.push("Aucune DLL libimobiledevice n'a été détectée : vérifiez que le paquet Windows x64 complet a été importé.");
    }
  }

  const steps: Record<MasterTask, string[]> = {
    inspect: [
      "Lecture seule de l'identité et de l'état appareil",
      "Collecte des indicateurs disponibles",
      "Génération d'un rapport local sans donnée d'authentification",
    ],
    backup: [
      "Vérification de l'appairage et du mode normal",
      "Création d'une sauvegarde locale chiffrée via idevicebackup2",
      "Vérification du manifeste de sauvegarde",
    ],
    screenpass: [
      "Attestation de propriété et confirmation de l'effacement",
      "Vérification Activation Lock et choix d'un IPSW signé",
      "Restauration officielle contrôlée en Recovery/DFU",
      "Réactivation par le propriétaire après restauration",
    ],
    "factory-reset": [
      "Attestation de propriété et confirmation de perte de données",
      "Vérification Activation Lock",
      "Restauration officielle complète depuis un IPSW signé",
      "Attente de l'écran Hello et réactivation légitime",
    ],
    versioning: [
      "Vérification de la fenêtre de signature Apple",
      "Contrôle du modèle et du firmware choisi",
      "Restauration du build signé choisi",
    ],
    "screen-time": [
      "Lecture de la version iOS",
      "Proposition du flux Apple adapté",
      "Aucune modification de code ou de réglage n'est exécutée",
    ],
    "sim-assist": [
      "Lecture des informations opérateur disponibles",
      "Guidage vers l'opérateur",
      "Aucun déverrouillage logiciel n'est effectué ni promis",
    ],
  };

  return {
    task: validTask,
    ok: blockers.length === 0,
    dryRun: true,
    canExecute: blockers.length === 0 && validTask !== "screen-time" && validTask !== "sim-assist",
    blockers,
    warnings,
    steps: steps[validTask],
    backupCount: backups.length,
    diskFreeGb,
    capabilities,
    requirements: {
      ownerAttestation: destructive,
      typedConfirmation: destructive,
      backupPassword: validTask === "backup",
      firmwareFile: destructive,
      requiredMode: validTask === "backup" ? "normal" : destructive ? "dfu-or-recovery" : null,
    },
    activationLockNotice:
      "Après toute restauration, la réactivation peut exiger l'identifiant Apple du propriétaire. NovaUnlock ne contourne jamais le verrouillage d'activation, iCloud ou SIM.",
  };
}

function auditDirectory(): string {
  return path.join(os.homedir(), ".novaunlock");
}

function previousAuditHash(file: string): string | null {
  try {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    const last = lines.at(-1);
    if (!last) return null;
    const parsed = JSON.parse(last) as { entryHash?: unknown };
    if (typeof parsed.entryHash === "string" && /^[a-f0-9]{64}$/i.test(parsed.entryHash)) {
      return parsed.entryHash;
    }
    // A legacy/malformed final line is still bound into the next entry rather than ignored.
    return createHash("sha256").update(last).digest("hex");
  } catch {
    return null;
  }
}

/** Append a privacy-preserving, hash-chained local audit entry. */
export function appendAudit(task: MasterTask, deviceId: string, event: string): void {
  const validTask = validateMasterTask(task);
  if (typeof deviceId !== "string" || deviceId.trim().length === 0 || deviceId.length > 256) {
    throw new Error("Identifiant d'appareil invalide pour l'audit.");
  }
  if (
    typeof event !== "string" ||
    event.trim().length === 0 ||
    event.length > 200 ||
    !AUDIT_EVENT_RE.test(event.trim())
  ) {
    throw new Error("Événement d'audit invalide.");
  }

  const directory = auditDirectory();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "audit.jsonl");
  const previousHash = previousAuditHash(file);
  const entry = {
    at: new Date().toISOString(),
    task: validTask,
    deviceHash: hashDeviceId(deviceId.trim()),
    event: event.trim(),
    previousHash,
  };
  const entryHash = createHash("sha256").update(JSON.stringify(entry)).digest("hex");
  fs.appendFileSync(file, `${JSON.stringify({ ...entry, entryHash })}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows ACLs are managed by the operating system; chmod is best-effort.
  }
}

/** Download only an HTTPS IPSW from an allow-listed firmware source. */
export async function downloadFirmware(url: string, buildId: string): Promise<string> {
  const validatedUrl = validateFirmwareUrl(url);
  if (typeof buildId !== "string" || buildId.trim().length === 0 || buildId.length > 64) {
    throw new Error("Identifiant de build firmware invalide.");
  }

  const safeBuildId = buildId.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const directory = path.join(os.homedir(), "Downloads", "NovaUnlock");
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, `${safeBuildId}.ipsw`);
  const temporary = `${destination}.part`;

  const response = await axios.get(validatedUrl.toString(), {
    responseType: "stream",
    timeout: 30_000,
    maxRedirects: 5,
    // Axios delegates redirects to follow-redirects. Validate every hop, not just
    // the initial ipsw.me URL, before opening a local file stream.
    beforeRedirect: (options) => {
      const host = typeof options.hostname === "string" ? options.hostname : "";
      if (options.protocol !== "https:" || !host || !isAllowedFirmwareHost(host)) {
        throw new Error("Redirection firmware vers un domaine non autorisé.");
      }
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(temporary);
      const fail = (error: Error) => {
        writer.destroy();
        reject(error);
      };
      response.data.on("error", fail);
      writer.on("error", reject);
      writer.on("close", resolve);
      response.data.pipe(writer);
    });
    // Windows does not replace an existing destination on rename. Replace only
    // after the new stream has closed successfully, never before.
    if (fs.existsSync(destination)) fs.unlinkSync(destination);
    fs.renameSync(temporary, destination);
    return destination;
  } catch (error) {
    if (fs.existsSync(temporary)) {
      try {
        fs.unlinkSync(temporary);
      } catch {
        // Best-effort cleanup only.
      }
    }
    throw error;
  }
}
