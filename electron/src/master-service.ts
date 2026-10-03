import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import axios from "axios";

export type MasterTask = "inspect" | "backup" | "screenpass" | "factory-reset" | "versioning" | "screen-time" | "sim-assist";

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

const APPLE_ID_RE = /^(iPhone|iPad|iPod)[0-9]+,[0-9]+$/i;

function backupRoots(): string[] {
  const roots = [
    process.env.APPDATA ? path.join(process.env.APPDATA, "Apple Computer", "MobileSync", "Backup") : "",
    path.join(os.homedir(), "Apple", "MobileSync", "Backup"),
  ];
  return roots.filter(Boolean);
}

function readPlistLike(file: string): Record<string, string> {
  try {
    const text = fs.readFileSync(file, "utf8");
    const get = (key: string) => text.match(new RegExp(`<key>${key}</key>[\\s\\S]{0,180}?<(?:string|date)>([^<]+)`))?.[1] || "";
    return { name: get("Device Name"), productType: get("Product Type"), iosVersion: get("Product Version") };
  } catch {
    return {};
  }
}

function directorySize(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isFile()) total += fs.statSync(current).size;
      else if (entry.isDirectory()) total += directorySize(current);
    }
  } catch { /* inaccessible backup entries are skipped */ }
  return total;
}

export function discoverBackups(): BackupSummary[] {
  const result: BackupSummary[] = [];
  for (const root of backupRoots()) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const manifest = ["Info.plist", "info.plist", "Manifest.plist"].find((name) => fs.existsSync(path.join(dir, name)));
      if (!manifest) continue;
      const metadata = readPlistLike(path.join(dir, manifest));
      const stat = fs.statSync(dir);
      result.push({
        path: dir,
        name: metadata.name || entry.name,
        productType: metadata.productType,
        iosVersion: metadata.iosVersion,
        encrypted: fs.existsSync(path.join(dir, "Manifest.plist")),
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

export function evaluatePreflight(task: MasterTask, device: { modelIdentifier?: string | null; serial?: string | null; mode?: string; activationLockStatus?: string | null }): PreflightResult {
  const backups = discoverBackups();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isRestoreTask = task === "screenpass" || task === "factory-reset" || task === "versioning";
  if (!device.serial && task !== "sim-assist") blockers.push("Aucun appareil identifié.");
  if (isRestoreTask && device.mode !== "dfu" && device.mode !== "recovery") warnings.push("L'appareil devra être placé en Recovery ou DFU avant la restauration.");
  if (isRestoreTask && backups.length === 0) warnings.push("Aucune sauvegarde locale détectée : l'opération peut entraîner une perte irréversible de données.");
  if (device.activationLockStatus && /locked|actif|on/i.test(device.activationLockStatus)) warnings.push("Le verrouillage d'activation peut rester actif après restauration. NovaUnlock ne le contourne jamais.");
  if (task === "versioning" && device.modelIdentifier && !APPLE_ID_RE.test(device.modelIdentifier)) warnings.push("Identifiant modèle non reconnu : vérifiez la compatibilité avant de choisir un firmware.");
  const diskFreeGb = Math.round(os.freemem() / 1024 / 1024 / 100) / 10;
  const steps: Record<MasterTask, string[]> = {
    inspect: ["Lecture seule de l’identité et de l’état appareil", "Collecte des indicateurs batterie et activation", "Génération du rapport"],
    backup: ["Vérification de l’appairage", "Création d’une sauvegarde locale chiffrée", "Vérification du manifeste"],
    screenpass: ["Attestation de propriété", "Prévol et choix d’un build signé", "Restauration contrôlée en Recovery/DFU", "Vérification post-restore"],
    "factory-reset": ["Prévol sauvegarde et perte de données", "Avertissement Activation Lock", "Effacement guidé ou restauration complète", "Attente de l’écran Hello"],
    versioning: ["Vérification de la fenêtre de signature", "Contrôle du plafond matériel", "Restauration du build signé choisi"],
    "screen-time": ["Lecture de la version iOS", "Proposition du flux officiel adapté", "Aucune modification non autorisée"],
    "sim-assist": ["Lecture des informations opérateur disponibles", "Guidage vers l’opérateur", "Aucun déverrouillage logiciel promis"],
  };
  return {
    task, ok: blockers.length === 0, dryRun: true, blockers, warnings,
    steps: steps[task], backupCount: backups.length, diskFreeGb,
    activationLockNotice: "Après une restauration, la réactivation peut exiger l’identifiant Apple du propriétaire. NovaUnlock ne contourne jamais le verrouillage d’activation.",
  };
}

export function appendAudit(task: MasterTask, deviceId: string, event: string): void {
  const dir = path.join(os.homedir(), ".novaunlock");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "audit.jsonl");
  fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), task, deviceHash: hashDeviceId(deviceId), event }) + "\n", "utf8");
}

export async function downloadFirmware(url: string, buildId: string): Promise<string> {
  if (!/^https:\/\//i.test(url)) throw new Error("URL firmware non sécurisée");
  const dir = path.join(os.homedir(), "Downloads", "NovaUnlock");
  fs.mkdirSync(dir, { recursive: true });
  const destination = path.join(dir, `${buildId.replace(/[^a-zA-Z0-9._-]/g, "_")}.ipsw`);
  const response = await axios.get(url, { responseType: "stream", timeout: 30_000 });
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destination);
    response.data.pipe(writer);
    writer.on("finish", () => resolve());
    writer.on("error", reject);
    response.data.on("error", reject);
  });
  return destination;
}
