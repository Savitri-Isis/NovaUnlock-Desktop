/** NovaUnlock Desktop — déclaration du bridge Electron isolé. */

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

export interface NativeToolStatus {
  diagnosticsReady: boolean;
  backupReady: boolean;
  restoreReady: boolean;
  activationCheckReady: boolean;
  complete: boolean;
  hasDlls: boolean;
  searchRoots: string[];
  tools: Record<string, boolean>;
  missing: string[];
  source: "runtime" | "bundled" | "mixed" | "none";
}

export interface MasterPreflightResult {
  task: string;
  ok: boolean;
  dryRun: true;
  canExecute: boolean;
  blockers: string[];
  warnings: string[];
  steps: string[];
  activationLockNotice: string;
  backupCount: number;
  diskFreeGb: number;
  requirements: {
    ownerAttestation: boolean;
    typedConfirmation: boolean;
    backupPassword: boolean;
    firmwareFile: boolean;
    requiredMode: "normal" | "dfu-or-recovery" | null;
  };
  capabilities?: Pick<
    NativeToolStatus,
    "diagnosticsReady" | "backupReady" | "restoreReady" | "activationCheckReady"
  >;
}

export interface MasterExecutionRequest {
  task: string;
  device: {
    modelIdentifier?: string | null;
    serial?: string | null;
    mode?: string;
    activationLockStatus?: string | null;
  };
  confirmation?: {
    ownerAttested?: boolean;
    typedConfirmation?: string;
    backupPassword?: string;
  };
  firmwarePath?: string;
}

export interface MasterOperationStatus {
  id: string;
  task: string;
  state: "queued" | "running" | "completed" | "failed" | "blocked";
  progress: number | null;
  stage: string;
  speed?: string;
  updatedAt: string;
  result?: {
    success: boolean;
    task: string;
    dryRun: false;
    stage: string;
    message: string;
    backup?: { path: string; encrypted: boolean };
    report?: {
      serial: string | null;
      model: string | null;
      modelIdentifier: string | null;
      iosVersion: string | null;
      batteryLevel: number | null;
      activationLockStatus: string | null;
    };
  };
}

export interface NovaUnlockAPI {
  scanDevices: () => Promise<DeviceInfo | null>;
  scanAllDevices?: () => Promise<DeviceInfo[]>;
  checkLibimobiledevice?: () => Promise<boolean>;
  getNativeToolStatus?: () => Promise<NativeToolStatus>;
  connectDevice: (deviceId: number, connectionId?: string) => Promise<boolean>;
  disconnectDevice: (deviceId: number) => Promise<boolean>;
  sendDFUCommand: (command: string, args: string) => Promise<{ success: boolean; response?: string }>;
  sendRecoveryCommand: (command: string) => Promise<{ success: boolean; response?: string }>;
  flashFirmware: (filePath: string) => Promise<{ success: boolean; progress: number; stage: string; speed: string }>;
  getDeviceInfo: () => Promise<DeviceDetails | null>;
  getECID: () => Promise<string | null>;
  getActivationLockStatus: () => Promise<ActivationLockStatus>;
  checkJailbreakStatus: () => Promise<boolean>;
  installLibimobiledevice: () => Promise<{ success: boolean; canceled?: boolean; message: string; status: NativeToolStatus }>;
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
  selectFirmwareFile: () => Promise<string | null>;
  downloadFirmware: (url: string, buildId: string) => Promise<string>;
  preflight: (task: string, device: MasterExecutionRequest["device"]) => Promise<MasterPreflightResult>;
  executeMaster: (request: MasterExecutionRequest) => Promise<MasterOperationStatus>;
  getMasterOperationStatus: (operationId: string) => Promise<MasterOperationStatus | null>;
  appendAudit: (task: string, deviceId: string, event: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    novaunlock: NovaUnlockAPI;
  }
}

export {};
