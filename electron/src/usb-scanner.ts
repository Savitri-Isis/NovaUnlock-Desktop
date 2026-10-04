/**
 * NovaUnlock — USB Scanner Module (Windows)
 *
 * Cette couche ne contient aucun mécanisme de contournement. Elle orchestre les
 * outils officiels libimobiledevice pour le diagnostic, la sauvegarde et la
 * restauration IPSW signée d'appareils autorisés.
 */

import { execFileSync, spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getBundledNativePath,
  getNativeToolStatus,
  getRuntimeNativePath,
  importNativePayload,
  NATIVE_TOOL_FILES,
  resolveNativeTool,
  type NativeImportResult,
  type NativePathEnvironment,
  type NativeToolName,
  type NativeToolStatus,
} from "./native-tools";

export { getNativeToolStatus, getRuntimeNativePath, importNativePayload, NATIVE_TOOL_FILES };
export type { NativeImportResult, NativePathEnvironment, NativeToolName, NativeToolStatus };

// --- Apple USB Constants ---

export const APPLE_VENDOR_ID = 0x05ac;
export const DEVICE_IDS = {
  DFU: 0x1281,
  RECOVERY: 0x1282,
  NORMAL: 0x1290,
  NORMAL_2: 0x1297,
  NORMAL_3: 0x129c,
  KDFU: 0x1881,
} as const;

// --- Types ---

export type DeviceConnectionMode = "normal" | "dfu" | "recovery" | "kdfu" | "unknown";
export type ActivationLockState = "locked" | "unlocked" | "unknown" | "unavailable";
export type JailbreakState = "yes" | "no" | "unknown" | "not-checked";

export interface USBDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  productName: string;
  serialNumber: string | null;
  manufacturer: string;
  mode: DeviceConnectionMode;
  connectionId: string;
}

export interface FlashProgress {
  success: boolean;
  progress: number;
  stage: string;
  speed: string;
}

export interface BackupProgress {
  progress: number | null;
  stage: string;
}

export interface BackupResult {
  success: boolean;
  path: string;
  encrypted: boolean;
  stage: string;
  message: string;
}

export interface ActivationLockStatusResult {
  state: ActivationLockState;
  locked: boolean | null;
  account: string | null;
  message?: string;
}

interface ActiveConnection {
  deviceId: number;
  connectionId: string | null;
}

const connectedDeviceIds = new Set<number>();
let activeConnection: ActiveConnection | null = null;

const MAX_CAPTURED_OUTPUT = 8_000;
const MAX_BACKUP_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const MAX_RESTORE_TIMEOUT_MS = 30 * 60 * 1000;

// --- Helpers ---

/** Existing public API: returns the packaged/dev native root, not the writable override. */
export function getNativePath(envOverride?: NativePathEnvironment): string {
  return getBundledNativePath(envOverride);
}

/**
 * Diagnostics only require the two read-only tools. Other features use the more
 * precise capability report returned by getNativeToolStatus.
 */
export function isLibimobiledeviceInstalled(nativeDir?: string): boolean {
  return nativeDir
    ? getNativeToolStatus([nativeDir]).diagnosticsReady
    : getNativeToolStatus().diagnosticsReady;
}

export function getModeFromProductId(productId: number): DeviceConnectionMode {
  switch (productId) {
    case DEVICE_IDS.DFU:
      return "dfu";
    case DEVICE_IDS.RECOVERY:
      return "recovery";
    case DEVICE_IDS.NORMAL:
    case DEVICE_IDS.NORMAL_2:
    case DEVICE_IDS.NORMAL_3:
      return "normal";
    case DEVICE_IDS.KDFU:
      return "kdfu";
    default:
      return "unknown";
  }
}

function nativeTool(tool: NativeToolName): string | null {
  return resolveNativeTool(tool);
}

function isSafeConnectionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /^[A-Za-z0-9-]+$/.test(value)
  );
}

function activeUdid(): string | null {
  return activeConnection && isSafeConnectionId(activeConnection.connectionId)
    ? activeConnection.connectionId
    : null;
}

/**
 * UDID de l'appareil actuellement appairé, ou null. Utilisé pour associer un
 * journal d'audit haché à l'appareil sans exposer son identifiant en clair.
 */
export function getConnectedUdid(): string | null {
  return activeUdid();
}

/** Exécuteur natif partagé (installation d'IPA, outils diagnostics). */
export const runNativeToolCommand = runNativeCommand;

function deviceArgs(args: string[] = []): string[] {
  const udid = activeUdid();
  return udid ? ["-u", udid, ...args] : args;
}

function lineValue(output: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return output.match(new RegExp(`(?:^|\\r?\\n)${escaped}:\\s*(.+)`, "i"))?.[1]?.trim() || null;
}

function trimOutput(value: string): string {
  return value.length > MAX_CAPTURED_OUTPUT ? value.slice(-MAX_CAPTURED_OUTPUT) : value;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function notifySafely<T>(callback: ((value: T) => void) | undefined, value: T): void {
  try {
    callback?.(value);
  } catch {
    // A progress observer must never break the native operation.
  }
}

export function validateIpswPath(filePath: unknown): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("Chemin du fichier firmware invalide.");
  }
  if (filePath.includes("\0")) {
    throw new Error("Caractères interdits dans le chemin du fichier firmware.");
  }
  const trimmed = filePath.trim();
  if (!trimmed.toLowerCase().endsWith(".ipsw")) {
    throw new Error("Le fichier firmware doit avoir l'extension .ipsw.");
  }
  const resolved = path.resolve(trimmed);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("Le fichier firmware .ipsw spécifié est introuvable sur le disque.");
  }
  return resolved;
}

export function parseRestoreOutput(
  output: string,
  current: { progress: number; stage: string; speed: string }
): { progress: number; stage: string; speed: string } {
  let { progress, stage, speed } = current;

  if (/Preparing|Préparation/i.test(output)) stage = "Préparation...";
  if (/Extracting|Extraction/i.test(output)) stage = "Extraction du firmware...";
  if (/Restoring|Restauration/i.test(output)) stage = "Restauration en cours...";
  if (/Flashing|Flash/i.test(output)) stage = "Flash firmware...";
  if (/Verifying|Vérification/i.test(output)) stage = "Vérification...";

  const pctMatches = [...output.matchAll(/(\d{1,3})%/g)];
  if (pctMatches.length > 0) {
    const parsed = parseInt(pctMatches[pctMatches.length - 1][1], 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) progress = parsed;
  }

  const speedMatch = output.match(/(\d+(?:\.\d+)?)\s*MB\/s/i);
  if (speedMatch) speed = `${speedMatch[1]} MB/s`;

  return { progress, stage, speed };
}

function managedBackupRoot(): string {
  const documents = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "Documents")
    : path.join(os.homedir(), "Documents");
  return path.join(documents, "NovaUnlock", "Backups");
}

export function createManagedBackupDirectory(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return path.join(managedBackupRoot(), `backup-${stamp}`);
}

function validateBackupPassword(password: unknown): string | null {
  if (password == null || password === "") return null;
  if (typeof password !== "string" || password.length < 8 || password.length > 256) {
    throw new Error("Le mot de passe de sauvegarde doit contenir entre 8 et 256 caractères.");
  }
  return password;
}

function containsBackupManifest(directory: string, depth = 0): boolean {
  const markers = new Set(["info.plist", "manifest.plist", "manifest.db", "status.plist"]);
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && markers.has(entry.name.toLowerCase()))) return true;
    // Some idevicebackup2 releases create a UDID child directory below the
    // requested destination. Limit recursion to avoid scanning a whole drive.
    if (depth < 2) {
      return entries.some(
        (entry) =>
          entry.isDirectory() &&
          !entry.isSymbolicLink() &&
          containsBackupManifest(path.join(directory, entry.name), depth + 1)
      );
    }
  } catch {
    return false;
  }
  return false;
}

function runNativeCommand(
  executable: string,
  args: string[],
  timeoutMs: number,
  onData?: (text: string) => void
): Promise<{ code: number | null; output: string; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let output = "";
    let spawnError = "";
    const child = spawn(executable, args, { shell: false, windowsHide: true });

    const complete = (result: { code: number | null; output: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve({ ...result, output: trimOutput(result.output) });
    };

    const consume = (data: Buffer) => {
      const text = data.toString();
      output = trimOutput(`${output}${text}`);
      notifySafely(onData, text);
    };

    child.stdout?.on("data", consume);
    child.stderr?.on("data", consume);
    child.on("error", (error: Error) => {
      spawnError = error.message;
      complete({ code: null, output, error: spawnError });
    });
    child.on("close", (code) => complete({ code, output, error: spawnError || undefined }));

    const timeoutId = setTimeout(() => {
      if (!settled) {
        if (!child.killed) child.kill();
        complete({ code: null, output, error: "Délai d'exécution dépassé" });
      }
    }, timeoutMs);
  });
}

// --- Scan Devices ---

export async function scanAllDevices(): Promise<USBDevice[]> {
  if (getNativeToolStatus().diagnosticsReady) {
    const libDevices = await scanAllWithLibimobiledevice();
    if (libDevices.length > 0) return libDevices;
  }

  const hidDevices = await scanAllWithNodeHid();
  if (hidDevices.length > 0) return hidDevices;

  return scanAllWithNodeUSB();
}

export async function scanDevices(): Promise<USBDevice | null> {
  const devices = await scanAllDevices();
  return devices[0] ?? null;
}

async function scanAllWithLibimobiledevice(): Promise<USBDevice[]> {
  const ideviceid = nativeTool("deviceId");
  const ideviceinfo = nativeTool("deviceInfo");
  if (!ideviceid || !ideviceinfo) return [];

  try {
    const result = execFileSync(ideviceid, ["-l"], {
      timeout: 5_000,
      encoding: "utf-8",
      windowsHide: true,
    }).trim();
    if (!result) return [];

    const udids = result
      .split(/\r?\n/)
      .map((udid) => udid.trim())
      .filter(isSafeConnectionId);

    const devices: USBDevice[] = [];
    udids.forEach((udid, index) => {
      try {
        const info = execFileSync(ideviceinfo, ["-u", udid], {
          timeout: 5_000,
          encoding: "utf-8",
          windowsHide: true,
        });
        devices.push({
          deviceId: index + 1,
          vendorId: APPLE_VENDOR_ID,
          productId: DEVICE_IDS.NORMAL,
          deviceName: lineValue(info, "DeviceName") || "Appareil iOS",
          productName: lineValue(info, "ProductType") || "iPhone",
          serialNumber: lineValue(info, "SerialNumber"),
          manufacturer: "Apple Inc.",
          mode: "normal",
          connectionId: udid,
        });
      } catch {
        // An unpaired or busy device is skipped without failing other devices.
      }
    });
    return devices;
  } catch {
    return [];
  }
}

async function scanAllWithNodeHid(): Promise<USBDevice[]> {
  try {
    const HID = require("node-hid");
    const devices = HID.devices();
    const appleDevices = devices.filter((device: any) => device.vendorId === APPLE_VENDOR_ID);
    return appleDevices.map((device: any, index: number) => ({
      deviceId: typeof device.deviceId === "number" ? device.deviceId : index + 1,
      vendorId: device.vendorId,
      productId: device.productId,
      deviceName: device.product || "Apple Device",
      productName: device.product || "iPhone",
      serialNumber: device.serialNumber || null,
      manufacturer: device.manufacturer || "Apple Inc.",
      mode: getModeFromProductId(device.productId),
      connectionId: `${device.vendorId}-${device.productId}-${device.serialNumber || index + 1}`,
    }));
  } catch {
    return [];
  }
}

async function scanAllWithNodeUSB(): Promise<USBDevice[]> {
  try {
    const { usb } = require("usb");
    const devices = await usb.getDevices();
    const appleDevices = devices.filter((device: any) => device.vendorId === APPLE_VENDOR_ID);
    return appleDevices.map((device: any, index: number) => ({
      deviceId: typeof device.address === "number" ? device.address : index + 1,
      vendorId: device.vendorId,
      productId: device.productId,
      deviceName: device.productName || "Apple Device",
      productName: device.productName || "iPhone",
      serialNumber: device.serialNumber || null,
      manufacturer: device.manufacturerName || "Apple Inc.",
      mode: getModeFromProductId(device.productId),
      connectionId: `${device.vendorId}-${device.productId}-${device.serialNumber || device.address || index + 1}`,
    }));
  } catch {
    return [];
  }
}

// --- Connect / Disconnect ---

export async function connectDevice(deviceId: number, connectionId?: string | null): Promise<boolean> {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) return false;
  if (connectionId != null && !isSafeConnectionId(connectionId)) return false;

  const status = getNativeToolStatus();
  if (status.diagnosticsReady) {
    const ideviceinfo = nativeTool("deviceInfo");
    if (!ideviceinfo) return false;
    try {
      const output = execFileSync(ideviceinfo, connectionId ? ["-u", connectionId] : [], {
        timeout: 5_000,
        encoding: "utf-8",
        windowsHide: true,
      }).trim();
      if (!output || /(?:ERROR|No device found|Unable to connect)/i.test(output)) return false;
      connectedDeviceIds.add(deviceId);
      activeConnection = { deviceId, connectionId: connectionId || null };
      return true;
    } catch {
      return false;
    }
  }

  const detectedDevices = await scanAllDevices();
  const matchingDevice = detectedDevices.find(
    (device) => device.deviceId === deviceId && (!connectionId || device.connectionId === connectionId)
  );
  if (!matchingDevice) return false;

  connectedDeviceIds.add(deviceId);
  activeConnection = { deviceId, connectionId: matchingDevice.connectionId };
  return true;
}

export async function disconnectDevice(deviceId: number): Promise<boolean> {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) return false;
  connectedDeviceIds.delete(deviceId);
  if (activeConnection?.deviceId === deviceId) activeConnection = null;
  return true;
}

// --- DFU and Recovery commands ---

export async function sendDFUCommand(
  command: string,
  _args: string
): Promise<{ success: boolean; response?: string }> {
  if (typeof command !== "string" || !["enter_dfu", "exit_dfu", "flash"].includes(command)) {
    return { success: false, response: `Commande inconnue: ${String(command)}` };
  }

  if (command === "enter_dfu") {
    return {
      success: false,
      response:
        "Le mode DFU exige la séquence physique de boutons indiquée à l'écran. NovaUnlock peut le détecter et en sortir, mais ne le simule jamais.",
    };
  }
  if (command === "flash") {
    return {
      success: false,
      response: "Utilisez le gestionnaire Firmware ou une opération maître autorisée pour lancer une restauration IPSW.",
    };
  }

  const irecovery = nativeTool("recovery");
  if (!irecovery) {
    return { success: false, response: "Binaire irecovery.exe introuvable dans libimobiledevice." };
  }

  try {
    execFileSync(irecovery, ["-c", "setenv auto-boot true"], { timeout: 10_000, windowsHide: true });
    execFileSync(irecovery, ["-c", "saveenv"], { timeout: 10_000, windowsHide: true });
    execFileSync(irecovery, ["-c", "reboot"], { timeout: 10_000, windowsHide: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, response: errorMessage(error, "Impossible de redémarrer l'appareil depuis DFU.") };
  }
}

export async function sendRecoveryCommand(
  command: string
): Promise<{ success: boolean; response?: string }> {
  if (typeof command !== "string" || !["enter_recovery", "exit_recovery", "flash"].includes(command)) {
    return { success: false, response: `Commande inconnue: ${String(command)}` };
  }
  if (command === "flash") {
    return {
      success: false,
      response: "Utilisez le gestionnaire Firmware ou une opération maître autorisée pour lancer une restauration IPSW.",
    };
  }

  if (command === "enter_recovery") {
    const enterRecovery = nativeTool("enterRecovery");
    if (!enterRecovery) {
      return {
        success: false,
        response:
          "ideviceenterrecovery.exe est absent. Utilisez la séquence de boutons Apple pour entrer en Recovery, puis relancez la détection.",
      };
    }
    try {
      execFileSync(enterRecovery, deviceArgs(), { timeout: 10_000, windowsHide: true });
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        response: errorMessage(error, "Impossible de demander l'entrée officielle en Recovery."),
      };
    }
  }

  const irecovery = nativeTool("recovery");
  if (!irecovery) {
    return { success: false, response: "Binaire irecovery.exe introuvable dans libimobiledevice." };
  }

  try {
    execFileSync(irecovery, ["-c", "setenv auto-boot true"], { timeout: 10_000, windowsHide: true });
    execFileSync(irecovery, ["-c", "saveenv"], { timeout: 10_000, windowsHide: true });
    execFileSync(irecovery, ["-c", "reboot"], { timeout: 10_000, windowsHide: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, response: errorMessage(error, "Impossible de sortir du mode Recovery.") };
  }
}

// --- Backup ---

/**
 * Create a local backup with idevicebackup2. The optional password is only held in
 * memory and is never written to logs, results or the audit trail.
 */
export async function createDeviceBackup(options: {
  destination?: string;
  password?: string | null;
  onProgress?: (progress: BackupProgress) => void;
} = {}): Promise<BackupResult> {
  const backupTool = nativeTool("backup");
  if (!backupTool) {
    return {
      success: false,
      path: "",
      encrypted: false,
      stage: "Outil de sauvegarde indisponible",
      message: "idevicebackup2.exe est introuvable dans libimobiledevice.",
    };
  }

  let password: string | null;
  try {
    password = validateBackupPassword(options.password);
  } catch (error: unknown) {
    return {
      success: false,
      path: "",
      encrypted: false,
      stage: "Mot de passe invalide",
      message: errorMessage(error, "Mot de passe de sauvegarde invalide."),
    };
  }

  const destination = path.resolve(options.destination || createManagedBackupDirectory());
  try {
    fs.mkdirSync(destination, { recursive: true });
  } catch (error: unknown) {
    return {
      success: false,
      path: destination,
      encrypted: Boolean(password),
      stage: "Dossier de sauvegarde inaccessible",
      message: errorMessage(error, "Impossible de créer le dossier de sauvegarde."),
    };
  }

  if (password) {
    notifySafely(options.onProgress, { progress: null, stage: "Activation du chiffrement de sauvegarde..." });
    const encryption = await runNativeCommand(
      backupTool,
      deviceArgs(["encryption", "on", password]),
      30_000
    );
    if (encryption.code !== 0) {
      return {
        success: false,
        path: destination,
        encrypted: true,
        stage: "Chiffrement non configuré",
        message:
          "Impossible de configurer le chiffrement. Vérifiez que l'appareil est déverrouillé, appairé et que le mot de passe de sauvegarde existant est connu.",
      };
    }
  }

  notifySafely(options.onProgress, { progress: null, stage: "Sauvegarde locale en cours..." });
  const backup = await runNativeCommand(
    backupTool,
    deviceArgs(["backup", destination]),
    MAX_BACKUP_TIMEOUT_MS,
    () => notifySafely(options.onProgress, { progress: null, stage: "Sauvegarde locale en cours..." })
  );

  if (backup.code !== 0) {
    return {
      success: false,
      path: destination,
      encrypted: Boolean(password),
      stage: "Échec de la sauvegarde",
      message:
        "La sauvegarde n'a pas abouti. Vérifiez la confiance USB, l'espace disque, le câble et l'état de l'appareil avant de réessayer.",
    };
  }

  if (!containsBackupManifest(destination)) {
    return {
      success: false,
      path: destination,
      encrypted: Boolean(password),
      stage: "Manifeste de sauvegarde introuvable",
      message:
        "idevicebackup2 s'est terminé sans manifeste vérifiable. La sauvegarde n'est pas considérée comme valide ; conservez l'appareil connecté et réessayez.",
    };
  }

  return {
    success: true,
    path: destination,
    encrypted: Boolean(password),
    stage: "Sauvegarde terminée",
    message: password
      ? "Sauvegarde chiffrée créée localement. Conservez son mot de passe hors de NovaUnlock."
      : "Sauvegarde locale créée. Elle n'est pas chiffrée.",
  };
}

// --- Official IPSW restore ---

export async function flashFirmware(
  filePath: string,
  onProgress?: (progress: { progress: number; stage: string; speed: string }) => void
): Promise<FlashProgress> {
  let resolvedFirmwarePath: string;
  try {
    resolvedFirmwarePath = validateIpswPath(filePath);
  } catch (error: unknown) {
    return { success: false, progress: 0, stage: errorMessage(error, "Chemin firmware invalide"), speed: "" };
  }

  const restore = nativeTool("restore");
  if (!restore) {
    return {
      success: false,
      progress: 0,
      stage: "Binaire idevicerestore.exe introuvable dans libimobiledevice.",
      speed: "",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let state = { progress: 0, stage: "Initialisation...", speed: "" };
    const child = spawn(restore, ["-e", resolvedFirmwarePath], { shell: false, windowsHide: true });

    const finalize = (result: FlashProgress) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.removeAllListeners();
      resolve(result);
    };

    const consume = (data: Buffer) => {
      state = parseRestoreOutput(data.toString(), state);
      notifySafely(onProgress, state);
    };

    child.stdout?.on("data", consume);
    child.stderr?.on("data", consume);
    child.on("error", (error: Error) => {
      finalize({
        success: false,
        progress: state.progress,
        stage: `Erreur d'exécution: ${error.message}`,
        speed: state.speed,
      });
    });
    child.on("close", (code) => {
      const success = code === 0;
      finalize({
        success,
        progress: success ? 100 : state.progress,
        stage: success ? "Terminé" : `Échec du flash (code ${code ?? "inconnu"})`,
        speed: state.speed,
      });
    });

    const timeoutId = setTimeout(() => {
      if (!settled) {
        if (!child.killed) child.kill();
        finalize({
          success: false,
          progress: state.progress,
          stage: "Timeout — opération annulée",
          speed: state.speed,
        });
      }
    }, MAX_RESTORE_TIMEOUT_MS);
  });
}

// --- Device Info ---

export async function getDeviceInfo(): Promise<any | null> {
  const ideviceinfo = nativeTool("deviceInfo");
  if (!ideviceinfo) return null;

  try {
    const diskUsage = execFileSync(ideviceinfo, deviceArgs(["-q", "com.apple.disk_usage"]), {
      timeout: 10_000,
      encoding: "utf-8",
      windowsHide: true,
    });
    const battery = execFileSync(ideviceinfo, deviceArgs(["-q", "com.apple.mobile.battery"]), {
      timeout: 10_000,
      encoding: "utf-8",
      windowsHide: true,
    });
    const info = execFileSync(ideviceinfo, deviceArgs(), {
      timeout: 10_000,
      encoding: "utf-8",
      windowsHide: true,
    });

    const batteryLevel = parseInt(lineValue(battery, "CurrentCapacity") || "", 10);
    const totalBytes = parseInt(lineValue(diskUsage, "TotalDiskCapacity") || "", 10);
    const freeBytes = parseInt(lineValue(diskUsage, "TotalDataCapacity") || "", 10);
    const usedBytes = Number.isFinite(totalBytes) && Number.isFinite(freeBytes) ? Math.max(0, totalBytes - freeBytes) : null;

    const activation = await getActivationLockStatus();
    const jailbreakState = await checkJailbreakState();
    const ecid = await getECID();

    return {
      serial: lineValue(info, "SerialNumber"),
      model: lineValue(info, "ProductName"),
      modelIdentifier: lineValue(info, "ProductType"),
      imei: lineValue(info, "InternationalMobileEquipmentIdentity"),
      iosVersion: lineValue(info, "ProductVersion"),
      batteryLevel: Number.isFinite(batteryLevel) ? batteryLevel : null,
      batteryHealth: null,
      storageUsed: usedBytes == null ? null : `${(usedBytes / 1073741824).toFixed(1)} GB`,
      storageTotal: Number.isFinite(totalBytes) ? `${(totalBytes / 1073741824).toFixed(0)} GB` : null,
      jailbreakStatus: jailbreakState === "yes",
      jailbreakState,
      activationLockStatus: activation.state,
      connectionType: "usb",
      ecid,
      ibootVersion: lineValue(info, "iBootVersion"),
      chipset: lineValue(info, "HardwarePlatform"),
      boardConfig: lineValue(info, "BoardId"),
      basebandVersion: lineValue(info, "BasebandVersion"),
    };
  } catch {
    return null;
  }
}

// --- ECID ---

/** ECID is only reliably exposed by irecovery in Recovery/DFU; a UDID is never mislabeled as ECID. */
export async function getECID(): Promise<string | null> {
  const irecovery = nativeTool("recovery");
  if (!irecovery) return null;
  try {
    const result = execFileSync(irecovery, ["-q"], {
      timeout: 10_000,
      encoding: "utf-8",
      windowsHide: true,
    });
    return lineValue(result, "ECID") || null;
  } catch {
    return null;
  }
}

// --- Activation Lock (strict fail-closed) ---

/**
 * ideviceactivation's generic “Activated” state does not prove that Find My / Activation
 * Lock is disabled. We only report unlocked when a tool explicitly says so; all other
 * replies remain unknown and destructive master operations are blocked.
 */
export async function getActivationLockStatus(): Promise<ActivationLockStatusResult> {
  const activation = nativeTool("activation");
  if (!activation) {
    return {
      state: "unavailable",
      locked: null,
      account: null,
      message: "Statut Activation Lock non vérifiable : ideviceactivation.exe est absent.",
    };
  }

  try {
    const result = execFileSync(activation, deviceArgs(["state"]), {
      timeout: 10_000,
      encoding: "utf-8",
      windowsHide: true,
    });
    const normalized = result.replace(/\s+/g, " ").toLowerCase();
    const lockMentioned = /activation\s*lock|find\s*my|icloud\s*lock/.test(normalized);

    // Test the explicit "off/unlocked" wording first: "unlocked" contains the
    // substring "locked" and must never be classified as locked by accident.
    if (lockMentioned && /(?:unlocked|disabled|\boff\b|false)/.test(normalized)) {
      return { state: "unlocked", locked: false, account: null };
    }
    if (lockMentioned && /(?:\blocked\b|enabled|\bon\b|true)/.test(normalized)) {
      return {
        state: "locked",
        locked: true,
        account: null,
        message: "Le verrouillage d'activation est signalé comme actif.",
      };
    }

    return {
      state: "unknown",
      locked: null,
      account: null,
      message:
        "Le service n'a pas fourni un état Find My / Activation Lock explicite. Par sécurité, les opérations destructrices restent bloquées.",
    };
  } catch {
    return {
      state: "unknown",
      locked: null,
      account: null,
      message: "Statut Activation Lock inconnu — opération sensible bloquée.",
    };
  }
}

// --- Jailbreak Check ---

/** A paired device does not expose a reliable jailbreak signal through a safe public API. */
export async function checkJailbreakState(): Promise<JailbreakState> {
  if (!nativeTool("deviceInfo")) return "not-checked";
  return "unknown";
}

export async function checkJailbreakStatus(): Promise<boolean> {
  return (await checkJailbreakState()) === "yes";
}

// --- User-selected native payload import ---

/**
 * Backwards-compatible entry point. The caller must provide an extracted official
 * directory; automatic downloads are deliberately avoided for binary supply-chain
 * safety. Electron's main process opens the folder picker.
 */
export async function installLibimobiledevice(
  sourceDirectory?: string
): Promise<{ success: boolean; message: string; status: NativeToolStatus }> {
  if (getNativeToolStatus().diagnosticsReady && !sourceDirectory) {
    return {
      success: true,
      message: "libimobiledevice est déjà disponible.",
      status: getNativeToolStatus(),
    };
  }
  if (!sourceDirectory) {
    return {
      success: false,
      message:
        "Sélectionnez d'abord un dossier Windows x64 extrait contenant les binaires officiels libimobiledevice.",
      status: getNativeToolStatus(),
    };
  }
  const result = importNativePayload(sourceDirectory);
  return { success: result.success, message: result.message, status: result.status };
}
