/**
 * NovaUnlock — Preload Script
 * Expose les API IPC de manière sécurisée au renderer.
 */

import { contextBridge, ipcRenderer } from "electron";

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
  jailbreakState?: "yes" | "no" | "unknown" | "not-checked";
  activationLockStatus: string | null;
  connectionType: string | null;
  ecid: string | null;
  ibootVersion: string | null;
  chipset: string | null;
  boardConfig: string | null;
  basebandVersion: string | null;
}

export interface ActivationLockStatus {
  state?: "locked" | "unlocked" | "unknown" | "unavailable";
  locked: boolean | null;
  account: string | null;
  message?: string;
}

export type USBChannel = {
  scanDevices: () => Promise<DeviceInfo | null>;
  scanAllDevices?: () => Promise<DeviceInfo[]>;
  checkLibimobiledevice?: () => Promise<boolean>;
  connectDevice: (deviceId: number) => Promise<boolean>;
  disconnectDevice: (deviceId: number) => Promise<boolean>;
  sendDFUCommand: (command: string, args: string) => Promise<{ success: boolean; response?: string }>;
  sendRecoveryCommand: (command: string) => Promise<{ success: boolean; response?: string }>;
  flashFirmware: (filePath: string) => Promise<{ success: boolean; progress: number; stage: string; speed: string }>;
  getDeviceInfo: () => Promise<DeviceDetails | null>;
  getECID: () => Promise<string | null>;
  getActivationLockStatus: () => Promise<ActivationLockStatus>;
  checkJailbreakStatus: () => Promise<boolean>;
  installLibimobiledevice: () => Promise<{ success: boolean; message: string }>;
  listBackups: () => Promise<
    Array<{
      path: string;
      name: string;
      productType: string;
      iosVersion: string;
      encrypted: boolean;
      sizeMb: number;
      modifiedAt: string;
    }>
  >;
  downloadFirmware: (url: string, buildId: string) => Promise<string>;
  preflight: (
    task: string,
    device: {
      modelIdentifier?: string | null;
      serial?: string | null;
      mode?: string;
      activationLockStatus?: string | null;
    }
  ) => Promise<{
    task: string;
    ok: boolean;
    dryRun: true;
    blockers: string[];
    warnings: string[];
    steps: string[];
    activationLockNotice: string;
    backupCount: number;
    diskFreeGb: number;
  }>;
  appendAudit: (task: string, deviceId: string, event: string) => Promise<{ success: boolean }>;
};

contextBridge.exposeInMainWorld("novaunlock", {
  scanDevices: (): Promise<DeviceInfo | null> =>
    ipcRenderer.invoke("usb:scan"),

  scanAllDevices: (): Promise<DeviceInfo[]> =>
    ipcRenderer.invoke("usb:scan-all"),

  checkLibimobiledevice: (): Promise<boolean> =>
    ipcRenderer.invoke("usb:check-libimobiledevice"),

  connectDevice: (deviceId: number): Promise<boolean> =>
    ipcRenderer.invoke("usb:connect", deviceId),

  disconnectDevice: (deviceId: number): Promise<boolean> =>
    ipcRenderer.invoke("usb:disconnect", deviceId),

  sendDFUCommand: (command: string, args: string): Promise<{ success: boolean; response?: string }> =>
    ipcRenderer.invoke("usb:send-dfu-command", command, args),

  sendRecoveryCommand: (command: string): Promise<{ success: boolean; response?: string }> =>
    ipcRenderer.invoke("usb:send-recovery-command", command),

  flashFirmware: (filePath: string): Promise<{ success: boolean; progress: number; stage: string; speed: string }> =>
    ipcRenderer.invoke("usb:flash-firmware", filePath),

  getDeviceInfo: (): Promise<DeviceDetails | null> =>
    ipcRenderer.invoke("usb:get-device-info"),

  getECID: (): Promise<string | null> =>
    ipcRenderer.invoke("usb:get-ecid"),

  getActivationLockStatus: (): Promise<ActivationLockStatus> =>
    ipcRenderer.invoke("usb:get-activation-lock"),

  checkJailbreakStatus: (): Promise<boolean> =>
    ipcRenderer.invoke("usb:check-jailbreak"),

  installLibimobiledevice: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke("usb:install-libimobiledevice"),

  listBackups: () => ipcRenderer.invoke("master:backups"),
  downloadFirmware: (url: string, buildId: string) =>
    ipcRenderer.invoke("master:download-firmware", url, buildId),
  preflight: (
    task: string,
    device: {
      modelIdentifier?: string | null;
      serial?: string | null;
      mode?: string;
      activationLockStatus?: string | null;
    }
  ) => ipcRenderer.invoke("master:preflight", task, device),
  appendAudit: (task: string, deviceId: string, event: string) =>
    ipcRenderer.invoke("master:audit", task, deviceId, event),
});

export type ElectronAPI = USBChannel;
