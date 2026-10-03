/**
 * NovaUnlock Desktop — Zustand Store
 * Gestion centralisée de l'état de l'application desktop avec persistance non sensible.
 */

import { create } from "zustand";

export type DeviceMode = "normal" | "dfu" | "recovery" | "kdfu" | "unknown" | "disconnected";
export type JailbreakState = "yes" | "no" | "unknown" | "not-checked";

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
  jailbreakState?: JailbreakState;
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
  /** Identity of the USB endpoint currently selected in this session. */
  deviceId: number | null;
  connectionId: string | null;
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
  localPath?: string;
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

const STORAGE_KEY = "novaunlock:diagnostics:v1";

function loadPersistedLogs(): LogEntry[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.logs)) return [];
    return parsed.logs.slice(0, 50).map((item: any) => ({
      id: String(item.id || Date.now()),
      message: String(item.message || ""),
      type: ["info", "success", "warning", "error"].includes(item.type) ? item.type : "info",
      timestamp: new Date(item.timestamp || Date.now()),
    }));
  } catch {
    return [];
  }
}

function savePersistedLogs(logs: LogEntry[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logs: logs.slice(0, 50).map((l) => ({
          id: l.id,
          message: l.message,
          type: l.type,
          timestamp: l.timestamp.toISOString(),
        })),
      })
    );
  } catch {
    // Ignorer si localStorage est indisponible
  }
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
  jailbreakState: "not-checked",
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
  deviceId: null,
  connectionId: null,
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
  logs: loadPersistedLogs(),
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
    set((state) => {
      const nextLogs = [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date() },
        ...state.logs,
      ].slice(0, 200);
      savePersistedLogs(nextLogs);
      return { logs: nextLogs };
    }),

  clearLogs: () => {
    savePersistedLogs([]);
    set({ logs: [] });
  },

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
