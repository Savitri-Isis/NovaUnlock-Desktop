import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import axios from "axios";

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

export interface BackupSummary {
  path: string;
  name: string;
  productType: string;
  iosVersion: string;
  encrypted: boolean;
  sizeMb: number;
  modifiedAt: string;
}

export interface PreflightResult {
  task: MasterTask;
  ok: boolean;
  dryRun: true;
  blockers: string[];
  warnings: string[];
  steps: string[];
  activationLockNotice: string;
  backupCount: number;
  diskFreeGb: number;
}

export interface ParsedPlistMetadata {
  name: string;
  productType: string;
  iosVersion: string;
  isEncrypted: boolean | null;
  isBinary: boolean;
}

const APPLE_ID_RE = /^(iPhone|iPad|iPod)[0-9]+,[0-9]+$/i;

const ALLOWED_FIRMWARE_HOSTS = [
  "ipsw.me",
  "apple.com",
  "cdn-apple.com",
  "applecdn.com",
];

export function validateMasterTask(task: unknown): MasterTask {
  if (typeof task !== "string" || !VALID_MASTER_TASKS.includes(task as MasterTask)) {
    throw new Error(`Tâche maître invalide: ${String(task)}`);
  }
  return task as MasterTask;
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
  const isAllowedHost = ALLOWED_FIRMWARE_HOSTS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );

  if (!isAllowedHost) {
    throw new Error(
      `Domaine non autorisé pour le téléchargement firmware (${host}). Domaines autorisés: ${ALLOWED_FIRMWARE_HOSTS.join(", ")}`
    );
  }

  return parsed;
}

export function getFreeDiskSpaceGb(targetPath: string = os.homedir()): number {
  try {
    const existingTarget = fs.existsSync(targetPath) ? targetPath : os.homedir();
    if (typeof fs.statfsSync === "function") {
      const stats = fs.statfsSync(existingTarget);
      const freeBytes = Number(stats.bavail) * Number(stats.bsize);
      if (Number.isFinite(freeBytes) && freeBytes >= 0) {
        return Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10;
      }
    }
  } catch {
    // Repli sécurisé si le système de fichiers ne supporte pas statfsSync
  }
  return 0;
}

function backupRoots(): string[] {
  const roots = [
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "Apple Computer", "MobileSync", "Backup")
      : "",
    path.join(os.homedir(), "Apple", "MobileSync", "Backup"),
  ];
  return roots.filter(Boolean);
}

export function parsePlistContent(input: Buffer | string): ParsedPlistMetadata {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  const isBinary = buf.subarray(0, 8).toString("ascii") === "bplist00";

  if (isBinary) {
    // Extraction prudente de chaînes lisibles depuis un bplist00 sans crasher
    const ascii = buf.toString("latin1");
    const modelMatch = ascii.match(/(iPhone|iPad|iPod)[0-9]+,[0-9]+/);
    return {
      name: "",
      productType: modelMatch ? modelMatch[0] : "",
      iosVersion: "",
      isEncrypted: null,
      isBinary: true,
    };
  }

  const text = buf.toString("utf8");
  const getString = (key: string) =>
    text.match(
      new RegExp(`<key>${key}</key>\\s*<(?:string|date)>([^<]+)</(?:string|date)>`)
    )?.[1]?.trim() || "";

  const getBoolean = (key: string): boolean | null => {
    const match = text.match(new RegExp(`<key>${key}</key>\\s*<(true|false)\\s*/>`));
    if (!match) return null;
    return match[1] === "true";
  };

  return {
    name: getString("Device Name"),
    productType: getString("Product Type"),
    iosVersion: getString("Product Version"),
    isEncrypted: getBoolean("IsEncrypted"),
    isBinary: false,
  };
}

function readBackupMetadata(dir: string): ParsedPlistMetadata {
  const result: ParsedPlistMetadata = {
    name: "",
    productType: "",
    iosVersion: "",
    isEncrypted: null,
    isBinary: false,
  };

  for (const filename of ["Info.plist", "info.plist", "Manifest.plist", "Status.plist"]) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = parsePlistContent(fs.readFileSync(filePath));
      if (parsed.name && !result.name) result.name = parsed.name;
      if (parsed.productType && !result.productType) result.productType = parsed.productType;
      if (parsed.iosVersion && !result.iosVersion) result.iosVersion = parsed.iosVersion;
      if (parsed.isEncrypted !== null && result.isEncrypted === null) {
        result.isEncrypted = parsed.isEncrypted;
      }
      if (parsed.isBinary) result.isBinary = true;
    } catch {
      // Ignorer un fichier plist illisible
    }
  }

  return result;
}

function directorySize(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isFile()) total += fs.statSync(current).size;
      else if (entry.isDirectory()) total += directorySize(current);
    }
  } catch {
    /* inaccessible backup entries are skipped */
  }
  return total;
}

export function discoverBackups(customRoots?: string[]): BackupSummary[] {
  const result: BackupSummary[] = [];
  const roots = customRoots ?? backupRoots();

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const hasPlist = ["Info.plist", "info.plist", "Manifest.plist"].some((name) =>
        fs.existsSync(path.join(dir, name))
      );
      if (!hasPlist) continue;
      const metadata = readBackupMetadata(dir);
      const stat = fs.statSync(dir);
      result.push({
        path: dir,
        name: metadata.name || entry.name,
        productType: metadata.productType,
        iosVersion: metadata.iosVersion,
        encrypted: metadata.isEncrypted === true,
        sizeMb: Math.round(directorySize(dir) / 10000) / 100,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }
  return result;
}

export function hashDeviceId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function evaluatePreflight(
  task: MasterTask,
  device: {
    modelIdentifier?: string | null;
    serial?: string | null;
    mode?: string;
    activationLockStatus?: string | null;
  } = {}
): PreflightResult {
  const validTask = validateMasterTask(task);
  const safeDevice = device && typeof device === "object" ? device : {};
  const backups = discoverBackups();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isRestoreTask =
    validTask === "screenpass" || validTask === "factory-reset" || validTask === "versioning";

  if (!safeDevice.serial && validTask !== "sim-assist") {
    blockers.push("Aucun appareil identifié.");
  }

  if (isRestoreTask && safeDevice.mode !== "dfu" && safeDevice.mode !== "recovery") {
    warnings.push("L'appareil devra être placé en Recovery ou DFU avant la restauration.");
  }

  if (isRestoreTask && backups.length === 0) {
    warnings.push(
      "Aucune sauvegarde locale détectée : l'opération peut entraîner une perte irréversible de données."
    );
  }

  const lockState = safeDevice.activationLockStatus || "unknown";
  if (/^locked$|actif|^on$/i.test(lockState)) {
    warnings.push(
      "Le verrouillage d'activation peut rester actif après restauration. NovaUnlock ne le contourne jamais."
    );
  } else if (isRestoreTask && /^unknown$|^unavailable$/i.test(lockState)) {
    warnings.push(
      "Statut Activation Lock inconnu — assurez-vous de disposer des identifiants Apple du propriétaire avant toute restauration."
    );
  }

  if (
    validTask === "versioning" &&
    safeDevice.modelIdentifier &&
    !APPLE_ID_RE.test(safeDevice.modelIdentifier)
  ) {
    warnings.push(
      "Identifiant modèle non reconnu : vérifiez la compatibilité avant de choisir un firmware."
    );
  }

  const diskFreeGb = getFreeDiskSpaceGb();
  if (isRestoreTask && diskFreeGb > 0 && diskFreeGb < 10) {
    warnings.push(
      `Espace disque faible (${diskFreeGb} Go libres) : au moins 10 Go sont recommandés pour extraire et restaurer un IPSW.`
    );
  }

  const steps: Record<MasterTask, string[]> = {
    inspect: [
      "Lecture seule de l’identité et de l’état appareil",
      "Collecte des indicateurs batterie et activation",
      "Génération du rapport",
    ],
    backup: [
      "Vérification de l’appairage",
      "Création d’une sauvegarde locale chiffrée",
      "Vérification du manifeste",
    ],
    screenpass: [
      "Attestation de propriété",
      "Prévol et choix d’un build signé",
      "Restauration contrôlée en Recovery/DFU",
      "Vérification post-restore",
    ],
    "factory-reset": [
      "Prévol sauvegarde et perte de données",
      "Avertissement Activation Lock",
      "Effacement guidé ou restauration complète",
      "Attente de l’écran Hello",
    ],
    versioning: [
      "Vérification de la fenêtre de signature",
      "Contrôle du plafond matériel",
      "Restauration du build signé choisi",
    ],
    "screen-time": [
      "Lecture de la version iOS",
      "Proposition du flux officiel adapté",
      "Aucune modification non autorisée",
    ],
    "sim-assist": [
      "Lecture des informations opérateur disponibles",
      "Guidage vers l’opérateur",
      "Aucun déverrouillage logiciel promis",
    ],
  };

  return {
    task: validTask,
    ok: blockers.length === 0,
    dryRun: true,
    blockers,
    warnings,
    steps: steps[validTask],
    backupCount: backups.length,
    diskFreeGb,
    activationLockNotice:
      "Après une restauration, la réactivation peut exiger l’identifiant Apple du propriétaire. NovaUnlock ne contourne jamais le verrouillage d’activation.",
  };
}

export function appendAudit(task: MasterTask, deviceId: string, event: string): void {
  const validTask = validateMasterTask(task);
  if (typeof deviceId !== "string" || deviceId.trim().length === 0) {
    throw new Error("Identifiant d'appareil invalide pour l'audit.");
  }
  if (typeof event !== "string" || event.trim().length === 0 || event.length > 200) {
    throw new Error("Événement d'audit invalide.");
  }

  const dir = path.join(os.homedir(), ".novaunlock");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "audit.jsonl");
  fs.appendFileSync(
    file,
    JSON.stringify({
      at: new Date().toISOString(),
      task: validTask,
      deviceHash: hashDeviceId(deviceId.trim()),
      event: event.trim(),
    }) + "\n",
    "utf8"
  );
}

export async function downloadFirmware(url: string, buildId: string): Promise<string> {
  const validatedUrl = validateFirmwareUrl(url);
  if (typeof buildId !== "string" || buildId.trim().length === 0 || buildId.length > 64) {
    throw new Error("Identifiant de build firmware invalide.");
  }

  const safeBuildId = buildId.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(os.homedir(), "Downloads", "NovaUnlock");
  fs.mkdirSync(dir, { recursive: true });
  const destination = path.join(dir, `${safeBuildId}.ipsw`);
  const tempDestination = `${destination}.part`;

  const response = await axios.get(validatedUrl.toString(), {
    responseType: "stream",
    timeout: 30_000,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(tempDestination);
      response.data.pipe(writer);
      writer.on("finish", () => resolve());
      writer.on("error", reject);
      response.data.on("error", reject);
    });
    fs.renameSync(tempDestination, destination);
    return destination;
  } catch (err) {
    if (fs.existsSync(tempDestination)) {
      try {
        fs.unlinkSync(tempDestination);
      } catch {
        // Ignorer l'échec de nettoyage du fichier temporaire
      }
    }
    throw err;
  }
}
