/**
 * NovaUnlock Desktop — Zustand Store
 * Gestion centralisée de l'état de l'application desktop.
 */

import { create } from "zustand";

export type DeviceMode = "normal" | "dfu" | "recovery" | "kdfu" | "unknown" | "disconnected";

export interface DeviceInfo {
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

export interface Connection {
  isConnected: boolean;
  currentMode: DeviceMode;
  isSearching: boolean;
  lastConnectedAt: Date | null;
}

export interface DFUProgress {
  isFlashing: boolean;
  progress: number;
  stage: string;
  speed: string;
}

export interface FirmwareDownloadProgress {
  isDownloading: boolean;
  progress: number;
  speed: string;
  totalSize: string;
  downloadedSize: string;
}

export interface FirmwareInfo {
  version: string;
  buildid: string;
  url: string;
  filesize: string;
  released: string;
  signed: boolean;
}

export interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
}

interface DeviceState {
  deviceInfo: DeviceInfo;
  connection: Connection;
  dfuProgress: DFUProgress;
  firmwareDownloadProgress: FirmwareDownloadProgress;
  availableFirmwares: FirmwareInfo[];
  selectedFirmware: FirmwareInfo | null;
  logs: LogEntry[];
  isLibimobiledeviceInstalled: boolean;

  setDeviceInfo: (info: Partial<DeviceInfo>) => void;
  setConnection: (conn: Partial<Connection>) => void;
  setDfuProgress: (progress: Partial<DFUProgress>) => void;
  setFirmwareDownloadProgress: (progress: Partial<FirmwareDownloadProgress>) => void;
  setAvailableFirmwares: (firmwares: FirmwareInfo[]) => void;
  setSelectedFirmware: (firmware: FirmwareInfo | null) => void;
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setLibimobiledeviceInstalled: (installed: boolean) => void;
  resetAll: () => void;
}

const defaultDeviceInfo: DeviceInfo = {
  serial: null,
  model: null,
  modelIdentifier: null,
  imei: null,
  iosVersion: null,
  batteryLevel: null,
  batteryHealth: null,
  storageUsed: null,
  storageTotal: null,
  jailbreakStatus: false,
  activationLockStatus: null,
  connectionType: null,
  ecid: null,
  ibootVersion: null,
  chipset: null,
  boardConfig: null,
  basebandVersion: null,
};

const defaultConnection: Connection = {
  isConnected: false,
  currentMode: "disconnected",
  isSearching: false,
  lastConnectedAt: null,
};

const defaultDfuProgress: DFUProgress = {
  isFlashing: false,
  progress: 0,
  stage: "",
  speed: "",
};

const defaultFirmwareDownloadProgress: FirmwareDownloadProgress = {
  isDownloading: false,
  progress: 0,
  speed: "",
  totalSize: "",
  downloadedSize: "",
};

export const useDeviceStore = create<DeviceState>((set) => ({
  deviceInfo: defaultDeviceInfo,
  connection: defaultConnection,
  dfuProgress: defaultDfuProgress,
  firmwareDownloadProgress: defaultFirmwareDownloadProgress,
  availableFirmwares: [],
  selectedFirmware: null,
  logs: [],
  isLibimobiledeviceInstalled: false,

  setDeviceInfo: (info) =>
    set((state) => ({
      deviceInfo: { ...state.deviceInfo, ...info },
    })),

  setConnection: (conn) =>
    set((state) => ({
      connection: { ...state.connection, ...conn },
    })),

  setDfuProgress: (progress) =>
    set((state) => ({
      dfuProgress: { ...state.dfuProgress, ...progress },
    })),

  setFirmwareDownloadProgress: (progress) =>
    set((state) => ({
      firmwareDownloadProgress: { ...state.firmwareDownloadProgress, ...progress },
    })),

  setAvailableFirmwares: (firmwares) =>
    set({ availableFirmwares: firmwares }),

  setSelectedFirmware: (firmware) =>
    set({ selectedFirmware: firmware }),

  addLog: (entry) =>
    set((state) => ({
      logs: [
        { ...entry, id: Date.now().toString(), timestamp: new Date() },
        ...state.logs,
      ].slice(0, 200),
    })),

  clearLogs: () => set({ logs: [] }),

  setLibimobiledeviceInstalled: (installed) =>
    set({ isLibimobiledeviceInstalled: installed }),

  resetAll: () =>
    set({
      deviceInfo: defaultDeviceInfo,
      connection: defaultConnection,
      dfuProgress: defaultDfuProgress,
      firmwareDownloadProgress: defaultFirmwareDownloadProgress,
      availableFirmwares: [],
      selectedFirmware: null,
    }),
}));
