/**
 * NovaUnlock — USB Scanner Module (Windows)
 *
 * Architecture USB pour Windows :
 * 1. node-hid — Détection HID (Low-level USB HID devices)
 * 2. usb — Communication USB bulk (DFU, Recovery, Normal mode)
 * 3. libimobiledevice — Protocole Apple (iDevice API, AFC, AFC2, Plist)
 *
 * Sur Windows, libimobiledevice nécessite :
 * - WinUSB (installe automatiquement les drivers Apple Mobile Device)
 * - usbmuxd (daemon pour le multiplexage USB)
 * - Les binaires sont inclus dans native/libimobiledevice/
 */

import { execFileSync, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

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

export interface ActivationLockStatusResult {
  state: ActivationLockState;
  locked: boolean | null;
  account: string | null;
  message?: string;
}

const connectedDeviceIds = new Set<number>();

// --- Helpers ---

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

export function getNativePath(envOverride?: {
  isPackaged?: boolean;
  resourcesPath?: string;
  appPath?: string;
}): string {
  if (envOverride && typeof envOverride.isPackaged === "boolean") {
    if (envOverride.isPackaged && envOverride.resourcesPath) {
      return path.join(envOverride.resourcesPath, "native");
    }
    if (!envOverride.isPackaged && envOverride.appPath) {
      return path.join(envOverride.appPath, "native");
    }
  }

  try {
    const electron = require("electron");
    const app = electron?.app;
    if (app && typeof app.isPackaged === "boolean") {
      if (app.isPackaged) {
        const resPath =
          (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || __dirname;
        return path.join(resPath, "native");
      }
      return path.join(app.getAppPath(), "native");
    }
  } catch {
    // Exécution hors processus principal Electron (ex: tests unitaires)
  }

  return path.resolve(__dirname, "../../native");
}

export function isLibimobiledeviceInstalled(nativeDir = getNativePath()): boolean {
  const ideviceinfo = path.join(nativeDir, "libimobiledevice", "ideviceinfo.exe");
  return fs.existsSync(ideviceinfo);
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

  if (/Preparing|Préparation/i.test(output)) {
    stage = "Préparation...";
  }
  if (/Extracting|Extraction/i.test(output)) {
    stage = "Extraction du firmware...";
  }
  if (/Restoring|Restauration/i.test(output)) {
    stage = "Restauration en cours...";
  }
  if (/Flashing|Flash/i.test(output)) {
    stage = "Flash firmware...";
  }
  if (/Verifying|Vérification/i.test(output)) {
    stage = "Vérification...";
  }

  const pctMatches = [...output.matchAll(/(\d{1,3})%/g)];
  if (pctMatches.length > 0) {
    const parsed = parseInt(pctMatches[pctMatches.length - 1][1], 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      progress = parsed;
    }
  }

  const speedMatch = output.match(/(\d+(?:\.\d+)?)\s*MB\/s/i);
  if (speedMatch) {
    speed = `${speedMatch[1]} MB/s`;
  }

  return { progress, stage, speed };
}

// --- Scan Devices ---

export async function scanAllDevices(): Promise<USBDevice[]> {
  if (isLibimobiledeviceInstalled()) {
    const libDevices = await scanAllWithLibimobiledevice();
    if (libDevices.length > 0) {
      return libDevices;
    }
  }

  const hidDevices = await scanAllWithNodeHid();
  if (hidDevices.length > 0) {
    return hidDevices;
  }

  return await scanAllWithNodeUSB();
}

export async function scanDevices(): Promise<USBDevice | null> {
  const devices = await scanAllDevices();
  return devices[0] ?? null;
}

async function scanAllWithLibimobiledevice(): Promise<USBDevice[]> {
  try {
    const nativePath = getNativePath();
    const ideviceid = path.join(nativePath, "libimobiledevice", "idevice_id.exe");
    if (!fs.existsSync(ideviceid)) {
      return [];
    }

    const result = execFileSync(ideviceid, ["-l"], {
      timeout: 5000,
      encoding: "utf-8",
      windowsHide: true,
    }).trim();

    if (!result) {
      return [];
    }

    const udids = result
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);

    const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    const devices: USBDevice[] = [];

    udids.forEach((udid, index) => {
      try {
        const infoResult = execFileSync(ideviceinfo, ["-u", udid], {
          timeout: 5000,
          encoding: "utf-8",
          windowsHide: true,
        });

        const productType = infoResult.match(/ProductType: (.+)/)?.[1]?.trim() || "iPhone";
        const serialNumber = infoResult.match(/SerialNumber: (.+)/)?.[1]?.trim() || null;
        const deviceName = infoResult.match(/DeviceName: (.+)/)?.[1]?.trim() || "iPhone";

        devices.push({
          deviceId: index + 1,
          vendorId: APPLE_VENDOR_ID,
          productId: DEVICE_IDS.NORMAL,
          deviceName,
          productName: productType,
          serialNumber,
          manufacturer: "Apple Inc.",
          mode: "normal",
          connectionId: udid,
        });
      } catch {
        // Ignorer un appareil qui ne répond pas et continuer le scan
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
    const appleDevices = devices.filter((d: any) => d.vendorId === APPLE_VENDOR_ID);

    return appleDevices.map((appleDevice: any, idx: number) => ({
      deviceId: typeof appleDevice.deviceId === "number" ? appleDevice.deviceId : idx + 1,
      vendorId: appleDevice.vendorId,
      productId: appleDevice.productId,
      deviceName: appleDevice.product || "Apple Device",
      productName: appleDevice.product || "iPhone",
      serialNumber: appleDevice.serialNumber || null,
      manufacturer: appleDevice.manufacturer || "Apple Inc.",
      mode: getModeFromProductId(appleDevice.productId),
      connectionId: `${appleDevice.vendorId}-${appleDevice.productId}-${appleDevice.serialNumber || idx + 1}`,
    }));
  } catch {
    return [];
  }
}

async function scanAllWithNodeUSB(): Promise<USBDevice[]> {
  try {
    const { usb } = require("usb");
    const devices = await usb.getDevices();
    const appleDevices = devices.filter((d: any) => d.vendorId === APPLE_VENDOR_ID);

    return appleDevices.map((appleDevice: any, idx: number) => ({
      deviceId: typeof appleDevice.address === "number" ? appleDevice.address : idx + 1,
      vendorId: appleDevice.vendorId,
      productId: appleDevice.productId,
      deviceName: appleDevice.productName || "Apple Device",
      productName: appleDevice.productName || "iPhone",
      serialNumber: appleDevice.serialNumber || null,
      manufacturer: appleDevice.manufacturerName || "Apple Inc.",
      mode: getModeFromProductId(appleDevice.productId),
      connectionId: `${appleDevice.vendorId}-${appleDevice.productId}-${appleDevice.serialNumber || appleDevice.address || idx + 1}`,
    }));
  } catch {
    return [];
  }
}

// --- Connect / Disconnect ---

export async function connectDevice(deviceId: number): Promise<boolean> {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) {
    return false;
  }

  if (isLibimobiledeviceInstalled()) {
    try {
      const nativePath = getNativePath();
      const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
      const output = execFileSync(ideviceinfo, [], {
        timeout: 5000,
        encoding: "utf-8",
        windowsHide: true,
      }).trim();
      if (!output || /ERROR|No device found/i.test(output)) {
        return false;
      }
      connectedDeviceIds.add(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  // Sans libimobiledevice, vérifier qu'un périphérique USB Apple réel correspond au deviceId
  const detectedDevices = await scanAllDevices();
  const matchingDevice = detectedDevices.find((d) => d.deviceId === deviceId);
  if (!matchingDevice) {
    return false;
  }

  connectedDeviceIds.add(deviceId);
  return true;
}

export async function disconnectDevice(deviceId: number): Promise<boolean> {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) {
    return false;
  }
  connectedDeviceIds.delete(deviceId);
  return true;
}

// --- DFU Commands ---

export async function sendDFUCommand(
  command: string,
  _args: string
): Promise<{ success: boolean; response?: string }> {
  if (typeof command !== "string" || !["enter_dfu", "exit_dfu", "flash"].includes(command)) {
    return { success: false, response: `Commande inconnue: ${String(command)}` };
  }

  if (command === "flash") {
    return { success: true };
  }

  const nativePath = getNativePath();
  const irecovery = path.join(nativePath, "libimobiledevice", "irecovery.exe");
  if (!fs.existsSync(irecovery)) {
    return {
      success: false,
      response: "Binaire irecovery.exe introuvable dans native/libimobiledevice/",
    };
  }

  try {
    execFileSync(irecovery, ["-c", "setenv auto-boot true"], { timeout: 10000, windowsHide: true });
    execFileSync(irecovery, ["-c", "saveenv"], { timeout: 10000, windowsHide: true });
    execFileSync(irecovery, ["-c", "reboot"], { timeout: 10000, windowsHide: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, response: error.message };
  }
}

// --- Recovery Commands ---

export async function sendRecoveryCommand(
  command: string
): Promise<{ success: boolean; response?: string }> {
  if (typeof command !== "string" || !["enter_recovery", "exit_recovery", "flash"].includes(command)) {
    return { success: false, response: `Commande inconnue: ${String(command)}` };
  }

  if (command === "flash") {
    return { success: true };
  }

  const nativePath = getNativePath();
  const irecovery = path.join(nativePath, "libimobiledevice", "irecovery.exe");
  if (!fs.existsSync(irecovery)) {
    return {
      success: false,
      response: "Binaire irecovery.exe introuvable dans native/libimobiledevice/",
    };
  }

  try {
    const autoBootValue = command === "enter_recovery" ? "false" : "true";
    execFileSync(irecovery, ["-c", `setenv auto-boot ${autoBootValue}`], {
      timeout: 10000,
      windowsHide: true,
    });
    execFileSync(irecovery, ["-c", "saveenv"], { timeout: 10000, windowsHide: true });
    execFileSync(irecovery, ["-c", "reboot"], { timeout: 10000, windowsHide: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, response: error.message };
  }
}

// --- Flash Firmware ---

export async function flashFirmware(filePath: string): Promise<FlashProgress> {
  let resolvedFirmwarePath: string;
  try {
    resolvedFirmwarePath = validateIpswPath(filePath);
  } catch (error: any) {
    return {
      success: false,
      progress: 0,
      stage: error.message || "Chemin firmware invalide",
      speed: "",
    };
  }

  const nativePath = getNativePath();
  const restore = path.join(nativePath, "libimobiledevice", "idevicerestore.exe");

  if (!fs.existsSync(restore)) {
    return {
      success: false,
      progress: 0,
      stage: "Binaire idevicerestore.exe introuvable dans native/libimobiledevice/",
      speed: "",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let state = {
      progress: 0,
      stage: "Initialisation...",
      speed: "",
    };

    const child = spawn(restore, ["-e", resolvedFirmwarePath], {
      shell: false,
      windowsHide: true,
    });

    const finalize = (result: FlashProgress) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.removeAllListeners();
      resolve(result);
    };

    child.stdout?.on("data", (data: Buffer) => {
      state = parseRestoreOutput(data.toString(), state);
    });

    child.stderr?.on("data", (data: Buffer) => {
      state = parseRestoreOutput(data.toString(), state);
    });

    child.on("error", (err: Error) => {
      finalize({
        success: false,
        progress: state.progress,
        stage: `Erreur d'exécution: ${err.message}`,
        speed: state.speed,
      });
    });

    child.on("close", (code) => {
      const ok = code === 0;
      finalize({
        success: ok,
        progress: ok ? 100 : state.progress,
        stage: ok ? "Terminé" : `Échec du flash (code ${code ?? "inconnu"})`,
        speed: state.speed,
      });
    });

    const timeoutId = setTimeout(() => {
      if (!settled) {
        if (!child.killed) {
          child.kill();
        }
        finalize({
          success: false,
          progress: state.progress,
          stage: "Timeout — opération annulée",
          speed: state.speed,
        });
      }
    }, 1800000); // 30 minutes max
  });
}

// --- Device Info ---

export async function getDeviceInfo(): Promise<any | null> {
  try {
    const nativePath = getNativePath();
    const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    if (!fs.existsSync(ideviceinfo)) {
      return null;
    }

    const result = execFileSync(
      ideviceinfo,
      ["-q", "com.apple.disk_usage", "-q", "com.apple.mobile.battery"],
      {
        timeout: 10000,
        encoding: "utf-8",
        windowsHide: true,
      }
    );

    const batteryLevel = parseInt(result.match(/CurrentCapacity: (\d+)/)?.[1] || "0", 10);
    const storageTotal = result.match(/TotalDiskCapacity: (\d+)/)?.[1] || "0";
    const storageFree = result.match(/TotalDataCapacity: (\d+)/)?.[1] || "0";
    const totalBytes = parseInt(storageTotal, 10);
    const freeBytes = parseInt(storageFree, 10);
    const usedBytes = Math.max(0, totalBytes - freeBytes);

    const infoResult = execFileSync(ideviceinfo, [], {
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
    });

    const activation = await getActivationLockStatus();
    const jbStatus = await checkJailbreakState();
    const ecid = await getECID();

    return {
      serial: infoResult.match(/SerialNumber: (.+)/)?.[1]?.trim() || null,
      model: infoResult.match(/ProductName: (.+)/)?.[1]?.trim() || null,
      modelIdentifier: infoResult.match(/ProductType: (.+)/)?.[1]?.trim() || null,
      imei: infoResult.match(/InternationalMobileEquipmentIdentity: (.+)/)?.[1]?.trim() || null,
      iosVersion: infoResult.match(/ProductVersion: (.+)/)?.[1]?.trim() || null,
      batteryLevel,
      batteryHealth: null,
      storageUsed: `${(usedBytes / 1073741824).toFixed(1)} GB`,
      storageTotal: `${(totalBytes / 1073741824).toFixed(0)} GB`,
      jailbreakStatus: jbStatus === "yes",
      jailbreakState: jbStatus,
      activationLockStatus: activation.state,
      connectionType: "usb",
      ecid,
      ibootVersion: infoResult.match(/iBootVersion: (.+)/)?.[1]?.trim() || null,
      chipset: infoResult.match(/HardwarePlatform: (.+)/)?.[1]?.trim() || null,
      boardConfig: infoResult.match(/BoardId: (.+)/)?.[1]?.trim() || null,
      basebandVersion: infoResult.match(/BasebandVersion: (.+)/)?.[1]?.trim() || null,
    };
  } catch {
    return null;
  }
}

// --- ECID ---

export async function getECID(): Promise<string | null> {
  try {
    const nativePath = getNativePath();
    const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    if (!fs.existsSync(ideviceinfo)) {
      return null;
    }

    const result = execFileSync(ideviceinfo, ["-q", "com.apple.mobile.lockdown"], {
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
    });
    const ecid = result.match(/UniqueDeviceID: (.+)/)?.[1]?.trim() || null;
    return ecid;
  } catch {
    return null;
  }
}

// --- Activation Lock (Fail-Closed) ---

export async function getActivationLockStatus(): Promise<ActivationLockStatusResult> {
  const nativePath = getNativePath();
  const ideviceactivation = path.join(nativePath, "libimobiledevice", "ideviceactivation.exe");

  if (!fs.existsSync(ideviceactivation)) {
    return {
      state: "unavailable",
      locked: null,
      account: null,
      message: "Statut inconnu — opération sensible bloquée (binaire ideviceactivation absent)",
    };
  }

  try {
    const result = execFileSync(ideviceactivation, ["state"], {
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
    });

    if (/Unactivated|ActivationLock/i.test(result)) {
      return {
        state: "locked",
        locked: true,
        account: null,
        message: "Verrouillage d'activation actif ou appareil non activé",
      };
    }

    if (/Activated/i.test(result)) {
      return {
        state: "unlocked",
        locked: false,
        account: null,
      };
    }

    return {
      state: "unknown",
      locked: null,
      account: null,
      message: "Statut inconnu — opération sensible bloquée",
    };
  } catch {
    return {
      state: "unknown",
      locked: null,
      account: null,
      message: "Statut inconnu — opération sensible bloquée",
    };
  }
}

// --- Jailbreak Check ---

export async function checkJailbreakState(): Promise<JailbreakState> {
  const nativePath = getNativePath();
  const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");

  if (!fs.existsSync(ideviceinfo)) {
    return "not-checked";
  }

  try {
    const result = execFileSync(ideviceinfo, ["-q", "com.apple.mobile.iTunes"], {
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
    });
    return /Cydia|Sileo|Zebra/i.test(result) ? "yes" : "no";
  } catch {
    return "unknown";
  }
}

export async function checkJailbreakStatus(): Promise<boolean> {
  return (await checkJailbreakState()) === "yes";
}

// --- Install libimobiledevice ---

export async function installLibimobiledevice(): Promise<{ success: boolean; message: string }> {
  const nativePath = getNativePath();
  const libimobiledevicePath = path.join(nativePath, "libimobiledevice");

  if (isLibimobiledeviceInstalled(nativePath)) {
    return {
      success: true,
      message: `libimobiledevice est déjà présent dans ${libimobiledevicePath}`,
    };
  }

  if (!fs.existsSync(libimobiledevicePath)) {
    fs.mkdirSync(libimobiledevicePath, { recursive: true });
  }

  try {
    const axios = require("axios");
    const url =
      "https://github.com/libimobiledevice-win32/imobiledevice-net/releases/latest/download/libimobiledevice.1.2.1-r1122-win-x64.zip";

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 30000,
    });

    const zipPath = path.join(nativePath, "imobiledevice.zip");
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(undefined));
      writer.on("error", reject);
    });

    return {
      success: false,
      message:
        "Archive téléchargée dans native/imobiledevice.zip. Extrayez les binaires (.exe et .dll) dans native/libimobiledevice/ pour activer le backend natif.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Backend natif absent (${error.message}). Placez les binaires officiels (ideviceinfo.exe, irecovery.exe, idevicerestore.exe, idevice_id.exe, ideviceactivation.exe) dans native/libimobiledevice/.`,
    };
  }
}
