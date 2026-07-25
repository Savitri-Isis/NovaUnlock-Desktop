/**
 * NovaUnlock — USB Scanner Module (Windows)
 *
 * Architecture USB pour Windows :
 * 1. node-hid — Détection HID (Low-level USB HID devices)
 * 2. node-usb — Communication USB bulk (DFU, Recovery, Normal mode)
 * 3. libimobiledevice — Protocole Apple (iDevice API, AFC, AFC2, Plist)
 *
 * Sur Windows, libimobiledevice nécessite :
 * - WinUSB (installe automatiquement les drivers Apple Mobile Device)
 * - usbmuxd (daemon pour le multiplexage USB)
 * - Les binaires sont inclus dans native/libimobiledevice/
 */

import { execSync, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { EventEmitter } from "events";

// --- Apple USB Constants ---

const APPLE_VENDOR_ID = 0x05ac;
const DEVICE_IDS = {
  DFU: 0x1281,
  RECOVERY: 0x1282,
  NORMAL: 0x1290,
  NORMAL_2: 0x1297,
  NORMAL_3: 0x129c,
  KDFU: 0x1881,
} as const;

// --- Types ---

export interface USBDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  productName: string;
  serialNumber: string | null;
  manufacturer: string;
  mode: "normal" | "dfu" | "recovery" | "kdfu" | "unknown";
  connectionId: string;
}

export interface FlashProgress {
  success: boolean;
  progress: number;
  stage: string;
  speed: string;
}

// --- Helpers ---

function getModeFromProductId(productId: number): "normal" | "dfu" | "recovery" | "kdfu" | "unknown" {
  switch (productId) {
    case DEVICE_IDS.DFU: return "dfu";
    case DEVICE_IDS.RECOVERY: return "recovery";
    case DEVICE_IDS.NORMAL:
    case DEVICE_IDS.NORMAL_2:
    case DEVICE_IDS.NORMAL_3:
      return "normal";
    case DEVICE_IDS.KDFU: return "kdfu";
    default: return "unknown";
  }
}

function getNativePath(): string {
  return path.join(process.resourcesPath || __dirname, "../../native");
}

function isLibimobiledeviceInstalled(): boolean {
  const nativePath = getNativePath();
  const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
  return fs.existsSync(ideviceinfo);
}

// --- Scan Devices ---

export async function scanDevices(): Promise<USBDevice | null> {
  // Méthode 1 : Utiliser libimobiledevice si installé
  if (isLibimobiledeviceInstalled()) {
    return await scanWithLibimobiledevice();
  }

  // Méthode 2 : Utiliser node-hid pour la détection bas niveau
  return await scanWithNodeHid();
}

async function scanWithLibimobiledevice(): Promise<USBDevice | null> {
  try {
    const nativePath = getNativePath();
    const ideviceid = path.join(nativePath, "libimobiledevice", "idevice_id.exe");
    const result = execSync(`"${ideviceid}" -l`, { timeout: 5000, encoding: "utf-8" }).trim();

    if (!result) {
      return await scanWithNodeHid();
    }

    const udid = result.split("\n")[0];
    const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    const infoResult = execSync(`"${ideviceinfo}" -u "${udid}"`, { timeout: 5000, encoding: "utf-8" });

    const productType = infoResult.match(/ProductType: (.+)/)?.[1]?.trim() || "iPhone";
    const serialNumber = infoResult.match(/SerialNumber: (.+)/)?.[1]?.trim() || null;
    const deviceName = infoResult.match(/DeviceName: (.+)/)?.[1]?.trim() || "iPhone";
    const iosVersion = infoResult.match(/ProductVersion: (.+)/)?.[1]?.trim() || "Unknown";

    return {
      deviceId: 1,
      vendorId: APPLE_VENDOR_ID,
      productId: DEVICE_IDS.NORMAL,
      deviceName,
      productName: productType,
      serialNumber,
      manufacturer: "Apple Inc.",
      mode: "normal",
      connectionId: udid,
    };
  } catch {
    return await scanWithNodeHid();
  }
}

async function scanWithNodeHid(): Promise<USBDevice | null> {
  try {
    const HID = require("node-hid");
    const devices = HID.devices();
    const appleDevice = devices.find((d: any) => d.vendorId === APPLE_VENDOR_ID);

    if (!appleDevice) {
      // Fallback : utiliser node-usb pour détecter les appareils non-HID
      return await scanWithNodeUSB();
    }

    return {
      deviceId: appleDevice.deviceId,
      vendorId: appleDevice.vendorId,
      productId: appleDevice.productId,
      deviceName: appleDevice.product || "Apple Device",
      productName: appleDevice.product || "iPhone",
      serialNumber: appleDevice.serialNumber || null,
      manufacturer: appleDevice.manufacturer || "Apple Inc.",
      mode: getModeFromProductId(appleDevice.productId),
      connectionId: `${appleDevice.vendorId}-${appleDevice.productId}-${appleDevice.serialNumber || "unknown"}`,
    };
  } catch {
    return await scanWithNodeUSB();
  }
}

async function scanWithNodeUSB(): Promise<USBDevice | null> {
  try {
    const usb = require("node-usb");
    const devices = usb.getDeviceList();
    const appleDevice = devices.find((d: any) => d.deviceDescriptor.idVendor === APPLE_VENDOR_ID);

    if (!appleDevice) {
      return null;
    }

    return {
      deviceId: appleDevice.deviceDescriptor.bcdDevice,
      vendorId: appleDevice.deviceDescriptor.idVendor,
      productId: appleDevice.deviceDescriptor.idProduct,
      deviceName: "Apple Device",
      productName: "iPhone",
      serialNumber: null,
      manufacturer: "Apple Inc.",
      mode: getModeFromProductId(appleDevice.deviceDescriptor.idProduct),
      connectionId: `${appleDevice.deviceDescriptor.idVendor}-${appleDevice.deviceDescriptor.idProduct}`,
    };
  } catch {
    return null;
  }
}

// --- Connect / Disconnect ---

export async function connectDevice(deviceId: number): Promise<boolean> {
  if (isLibimobiledeviceInstalled()) {
    try {
      const nativePath = getNativePath();
      const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
      execSync(`"${ideviceinfo}"`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export async function disconnectDevice(deviceId: number): Promise<boolean> {
  return true;
}

// --- DFU Commands ---

export async function sendDFUCommand(command: string, args: string): Promise<{ success: boolean; response?: string }> {
  try {
    const nativePath = getNativePath();

    switch (command) {
      case "enter_dfu": {
        // Utiliser irecovery pour entrer en DFU
        const irecovery = path.join(nativePath, "libimobiledevice", "irecovery.exe");
        execSync(`"${irecovery}" -c "setenv auto-boot true"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "saveenv"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "reboot"`, { timeout: 10000 });
        return { success: true };
      }
      case "exit_dfu": {
        const irecovery = path.join(nativePath, "libimobiledevice", "irecovery.exe");
        execSync(`"${irecovery}" -c "setenv auto-boot true"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "saveenv"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "reboot"`, { timeout: 10000 });
        return { success: true };
      }
      case "flash": {
        // Le flash sera géré par flashFirmware
        return { success: true };
      }
      default:
        return { success: false, response: `Commande inconnue: ${command}` };
    }
  } catch (error: any) {
    return { success: false, response: error.message };
  }
}

// --- Recovery Commands ---

export async function sendRecoveryCommand(command: string): Promise<{ success: boolean; response?: string }> {
  try {
    const nativePath = getNativePath();
    const irecovery = path.join(nativePath, "libimobiledevice", "irecovery.exe");

    switch (command) {
      case "enter_recovery":
        execSync(`"${irecovery}" -c "setenv auto-boot false"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "saveenv"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "reboot"`, { timeout: 10000 });
        return { success: true };

      case "exit_recovery":
        execSync(`"${irecovery}" -c "setenv auto-boot true"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "saveenv"`, { timeout: 10000 });
        execSync(`"${irecovery}" -c "reboot"`, { timeout: 10000 });
        return { success: true };

      case "flash":
        return { success: true };

      default:
        return { success: false, response: `Commande inconnue: ${command}` };
    }
  } catch (error: any) {
    return { success: false, response: error.message };
  }
}

// --- Flash Firmware ---

export async function flashFirmware(filePath: string): Promise<FlashProgress> {
  return new Promise((resolve) => {
    const nativePath = getNativePath();
    const restore = path.join(nativePath, "libimobiledevice", "idevicerestore.exe");

    const child = spawn(`"${restore}"`, ["-e", `"${filePath}"`], {
      shell: true,
      windowsHide: true,
    });

    let progress = 0;
    let stage = "Initialisation...";
    let speed = "";

    child.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();

      // Parser la progression depuis la sortie de idevicerestore
      if (output.includes("Restoring")) {
        stage = "Restauration en cours...";
        const match = output.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
        }
      }
      if (output.includes("Flashing")) {
        stage = "Flash firmware...";
        const match = output.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
        }
      }
      if (output.includes("Verifying")) {
        stage = "Vérification...";
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/(\d+\.\d+)\s+MB\/s/);
      if (match) {
        speed = `${match[1]} MB/s`;
      }
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        progress: 100,
        stage: code === 0 ? "Terminé" : "Échec du flash",
        speed,
      });
    });

    // Timeout de sécurité
    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        resolve({
          success: false,
          progress,
          stage: "Timeout — opération annulée",
          speed,
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
    const result = execSync(`"${ideviceinfo}" -q com.apple.disk_usage -q com.apple.mobile.battery`, {
      timeout: 10000,
      encoding: "utf-8",
    });

    const batteryLevel = parseInt(result.match(/CurrentCapacity: (\d+)/)?.[1] || "0");
    const storageTotal = result.match(/TotalDiskCapacity: (\d+)/)?.[1] || "0";
    const storageFree = result.match(/TotalDataCapacity: (\d+)/)?.[1] || "0";
    const totalBytes = parseInt(storageTotal);
    const freeBytes = parseInt(storageFree);
    const usedBytes = totalBytes - freeBytes;

    const ideviceinfo2 = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    const infoResult = execSync(`"${ideviceinfo2}"`, { timeout: 10000, encoding: "utf-8" });

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
      jailbreakStatus: false,
      activationLockStatus: null,
      connectionType: "usb",
      ecid: null,
      ibootVersion: infoResult.match(/iBootVersion: (.+)/)?.[1]?.trim() || null,
      chipset: null,
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
    const result = execSync(`"${ideviceinfo}" -q com.apple.mobile.lockdown`, {
      timeout: 10000,
      encoding: "utf-8",
    });
    const ecid = result.match(/UniqueDeviceID: (.+)/)?.[1]?.trim() || null;
    return ecid;
  } catch {
    return null;
  }
}

// --- Activation Lock ---

export async function getActivationLockStatus(): Promise<{ locked: boolean; account: string | null }> {
  try {
    const nativePath = getNativePath();
    const ideviceactivation = path.join(nativePath, "libimobiledevice", "ideviceactivation.exe");
    const result = execSync(`"${ideviceactivation}" state`, {
      timeout: 10000,
      encoding: "utf-8",
    });

    const isActivated = !result.includes("Unactivated");
    return {
      locked: !isActivated,
      account: null,
    };
  } catch {
    return { locked: false, account: null };
  }
}

// --- Jailbreak Check ---

export async function checkJailbreakStatus(): Promise<boolean> {
  try {
    const nativePath = getNativePath();
    const ideviceinfo = path.join(nativePath, "libimobiledevice", "ideviceinfo.exe");
    const result = execSync(`"${ideviceinfo}" -q com.apple.mobile.iTunes`, {
      timeout: 10000,
      encoding: "utf-8",
    });
    // Vérifier la présence de fichiers jailbreak
    return result.includes("Cydia") || result.includes("Sileo");
  } catch {
    return false;
  }
}

// --- Install libimobiledevice ---

export async function installLibimobiledevice(): Promise<{ success: boolean; message: string }> {
  const nativePath = getNativePath();
  const libimobiledevicePath = path.join(nativePath, "libimobiledevice");

  if (!fs.existsSync(nativePath)) {
    fs.mkdirSync(nativePath, { recursive: true });
  }

  // Télécharger et extraire libimobiledevice pour Windows
  try {
    const axios = require("axios");
    const url = "https://github.com/libimobiledevice-win32/imobiledevice-runnning/releases/latest/download/imobiledevice-tools.zip";

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const zipPath = path.join(nativePath, "imobiledevice.zip");
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Extraire le ZIP (nécessite une dépendance)
    // Pour l'instant, on retourne les instructions
    return {
      success: true,
      message: "Téléchargé. Extrayez manuellement dans native/libimobiledevice/",
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Échec du téléchargement: ${error.message}\n\nTéléchargez manuellement depuis: https://github.com/libimobiledevice-win32`,
    };
  }
}
