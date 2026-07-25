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
  activationLockStatus: string | null;
  connectionType: string | null;
  ecid: string | null;
  ibootVersion: string | null;
  chipset: string | null;
  boardConfig: string | null;
  basebandVersion: string | null;
}

export type USBChannel = {
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
};

contextBridge.exposeInMainWorld("novaunlock", {
  scanDevices: (): Promise<DeviceInfo | null> =>
    ipcRenderer.invoke("usb:scan"),

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

  getActivationLockStatus: (): Promise<{ locked: boolean; account: string | null }> =>
    ipcRenderer.invoke("usb:get-activation-lock"),

  checkJailbreakStatus: (): Promise<boolean> =>
    ipcRenderer.invoke("usb:check-jailbreak"),

  installLibimobiledevice: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke("usb:install-libimobiledevice"),
});

// Type declarations pour le renderer
export type ElectronAPI = typeof window["novaunlock"];
