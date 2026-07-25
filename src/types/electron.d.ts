/**
 * NovaUnlock Desktop — Electron API Type Declarations
 */

export interface DeviceInfo {
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

export interface DeviceDetails {
  serial: string | null;
  model: string | null;
  modelIdentifier: string | null;
  imei: string | null;
  iosVersion: string | null;
  batteryLevel: number | null;
  batteryHealth: string | null;
  storageUsed: string | null;
  storageTotal: string | null;
  jailbreakStatus: boolean;
  activationLockStatus: string | null;
  connectionType: string | null;
  ecid: string | null;
  ibootVersion: string | null;
  chipset: string | null;
  boardConfig: string | null;
  basebandVersion: string | null;
}

export interface NovaUnlockAPI {
  scanDevices: () => Promise<DeviceInfo | null>;
  connectDevice: (deviceId: number) => Promise<boolean>;
  disconnectDevice: (deviceId: number) => Promise<boolean>;
  sendDFUCommand: (command: string, args: string) => Promise<{ success: boolean; response?: string }>;
  sendRecoveryCommand: (command: string) => Promise<{ success: boolean; response?: string }>;
  flashFirmware: (filePath: string) => Promise<{ success: boolean; progress: number; stage: string; speed: string }>;
  getDeviceInfo: () => Promise<DeviceDetails | null>;
  getECID: () => Promise<string | null>;
  getActivationLockStatus: () => Promise<{ locked: boolean; account: string | null }>;
  checkJailbreakStatus: () => Promise<boolean>;
  installLibimobiledevice: () => Promise<{ success: boolean; message: string }>;
}

declare global {
  interface Window {
    novaunlock: NovaUnlockAPI;
  }
}

export {};
