/**
 * Confirmed master operations.
 *
 * This module is intentionally separate from the preflight service: a successful
 * preflight does not mutate an iPhone. Every write requires a second IPC request,
 * explicit user attestation, and server-side checks in the Electron main process.
 */

import {
  appendAudit,
  evaluatePreflight,
  isDestructiveMasterTask,
  type MasterDeviceContext,
  type MasterTask,
  validateMasterTask,
} from "./master-service";
import {
  createDeviceBackup,
  flashFirmware,
  getActivationLockStatus,
  getDeviceInfo,
  getNativeToolStatus,
  validateIpswPath,
} from "./usb-scanner";

export const DESTRUCTIVE_CONFIRMATION_TEXT = "EFFACER";

export interface MasterExecutionRequest {
  task: MasterTask;
  device: MasterDeviceContext;
  confirmation?: {
    ownerAttested?: boolean;
    typedConfirmation?: string;
    backupPassword?: string;
  };
  firmwarePath?: string;
}

export interface MasterExecutionProgress {
  progress: number | null;
  stage: string;
  speed?: string;
}

export interface MasterExecutionResult {
  success: boolean;
  task: MasterTask;
  dryRun: false;
  stage: string;
  message: string;
  backup?: {
    path: string;
    encrypted: boolean;
  };
  report?: {
    serial: string | null;
    model: string | null;
    modelIdentifier: string | null;
    iosVersion: string | null;
    batteryLevel: number | null;
    activationLockStatus: string | null;
  };
}

function validOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength || value.includes("\0")) {
    throw new Error("Paramètre texte invalide.");
  }
  return value.trim() || undefined;
}

function validateDevice(value: unknown): MasterDeviceContext {
  if (!value || typeof value !== "object") return {};
  const device = value as Record<string, unknown>;
  return {
    modelIdentifier: validOptionalString(device.modelIdentifier, 80) || null,
    serial: validOptionalString(device.serial, 256) || null,
    mode: validOptionalString(device.mode, 32),
    activationLockStatus: validOptionalString(device.activationLockStatus, 32) || null,
  };
}

/** Validates IPC input without persisting sensitive confirmation/password values. */
export function validateMasterExecutionRequest(value: unknown): MasterExecutionRequest {
  if (!value || typeof value !== "object") throw new Error("Requête d'opération maître invalide.");
  const raw = value as Record<string, unknown>;
  const confirmation = raw.confirmation && typeof raw.confirmation === "object"
    ? (raw.confirmation as Record<string, unknown>)
    : undefined;
  const backupPassword = confirmation ? validOptionalString(confirmation.backupPassword, 256) : undefined;
  const typedConfirmation = confirmation
    ? validOptionalString(confirmation.typedConfirmation, 64)
    : undefined;

  return {
    task: validateMasterTask(raw.task),
    device: validateDevice(raw.device),
    confirmation: confirmation
      ? {
          ownerAttested: confirmation.ownerAttested === true,
          typedConfirmation,
          backupPassword,
        }
      : undefined,
    firmwarePath: validOptionalString(raw.firmwarePath, 4096),
  };
}

function auditSafely(task: MasterTask, deviceId: string | null | undefined, event: string): void {
  try {
    appendAudit(task, deviceId || "unknown-device", event);
  } catch {
    // An audit storage fault must be visible in the result but must not orphan a USB child process.
  }
}

function blockedResult(task: MasterTask, message: string): MasterExecutionResult {
  return { success: false, task, dryRun: false, stage: "Opération bloquée", message };
}

function genericFailure(task: MasterTask, stage: string, message: string): MasterExecutionResult {
  return { success: false, task, dryRun: false, stage, message };
}

/**
 * Runs exactly one confirmed operation. It never handles iCloud, SIM or passcode
 * bypasses: destructive tasks perform an official erase/restore only.
 */
export async function executeMasterOperation(
  request: MasterExecutionRequest,
  onProgress?: (progress: MasterExecutionProgress) => void
): Promise<MasterExecutionResult> {
  const nativeStatus = getNativeToolStatus();
  let checkedDevice: MasterDeviceContext = { ...request.device };

  // Renderer state is not trusted for the lock decision. Query again at execution
  // time and fail closed if the native probe cannot explicitly verify the status.
  if (isDestructiveMasterTask(request.task)) {
    const lock = await getActivationLockStatus();
    checkedDevice = { ...checkedDevice, activationLockStatus: lock.state };
  }

  const preflight = evaluatePreflight(request.task, checkedDevice, nativeStatus);
  if (!preflight.canExecute) {
    auditSafely(request.task, checkedDevice.serial, "operation-blocked-preflight");
    return blockedResult(request.task, preflight.blockers[0] || "Le prévol n'autorise pas cette opération.");
  }

  if (isDestructiveMasterTask(request.task)) {
    if (request.confirmation?.ownerAttested !== true) {
      return blockedResult(
        request.task,
        "L'attestation de propriété est obligatoire avant une restauration officielle."
      );
    }
    if (request.confirmation.typedConfirmation?.toLocaleUpperCase("fr-FR") !== DESTRUCTIVE_CONFIRMATION_TEXT) {
      return blockedResult(
        request.task,
        `Saisissez exactement « ${DESTRUCTIVE_CONFIRMATION_TEXT} » pour confirmer l'effacement.`
      );
    }
    if (!request.firmwarePath) {
      return blockedResult(request.task, "Sélectionnez un fichier IPSW signé avant de continuer.");
    }
    try {
      validateIpswPath(request.firmwarePath);
    } catch (error: unknown) {
      return blockedResult(
        request.task,
        error instanceof Error ? error.message : "Fichier IPSW invalide."
      );
    }
  }

  if (request.task === "backup") {
    const password = request.confirmation?.backupPassword;
    if (!password || password.length < 8) {
      return blockedResult(
        request.task,
        "Un mot de passe de sauvegarde d'au moins 8 caractères est requis pour créer une sauvegarde chiffrée."
      );
    }

    auditSafely(request.task, checkedDevice.serial, "backup-started");
    const backup = await createDeviceBackup({
      password,
      onProgress: (progress) => onProgress?.({ progress: progress.progress, stage: progress.stage }),
    });
    if (!backup.success) {
      auditSafely(request.task, checkedDevice.serial, "backup-failed");
      return genericFailure(request.task, backup.stage, backup.message);
    }

    auditSafely(request.task, checkedDevice.serial, "backup-completed");
    return {
      success: true,
      task: request.task,
      dryRun: false,
      stage: backup.stage,
      message: backup.message,
      backup: { path: backup.path, encrypted: backup.encrypted },
    };
  }

  if (request.task === "inspect") {
    onProgress?.({ progress: null, stage: "Lecture des informations appareil..." });
    auditSafely(request.task, checkedDevice.serial, "inspect-started");
    const info = await getDeviceInfo();
    if (!info) {
      auditSafely(request.task, checkedDevice.serial, "inspect-failed");
      return genericFailure(
        request.task,
        "Diagnostic indisponible",
        "Impossible de lire l'appareil. Vérifiez la confiance USB et libimobiledevice."
      );
    }
    auditSafely(request.task, info.serial || checkedDevice.serial, "inspect-completed");
    return {
      success: true,
      task: request.task,
      dryRun: false,
      stage: "Diagnostic terminé",
      message: "Rapport de diagnostic lecture seule généré.",
      report: {
        serial: info.serial,
        model: info.model,
        modelIdentifier: info.modelIdentifier,
        iosVersion: info.iosVersion,
        batteryLevel: info.batteryLevel,
        activationLockStatus: info.activationLockStatus,
      },
    };
  }

  if (isDestructiveMasterTask(request.task)) {
    auditSafely(request.task, checkedDevice.serial, "official-restore-started");
    onProgress?.({ progress: 0, stage: "Préparation de la restauration officielle..." });
    const restored = await flashFirmware(request.firmwarePath!, (progress) =>
      onProgress?.({ progress: progress.progress, stage: progress.stage, speed: progress.speed })
    );
    if (!restored.success) {
      auditSafely(request.task, checkedDevice.serial, "official-restore-failed");
      return genericFailure(request.task, restored.stage, "La restauration officielle n'a pas abouti.");
    }
    auditSafely(request.task, checkedDevice.serial, "official-restore-completed");
    return {
      success: true,
      task: request.task,
      dryRun: false,
      stage: "Restauration terminée",
      message:
        "La restauration officielle est terminée. L'appareil doit être réactivé par son propriétaire ; NovaUnlock ne contourne jamais Activation Lock.",
    };
  }

  // These two routes are informational by design. Returning an explicit failure is
  // preferable to pretending a SIM, iCloud or Screen Time modification happened.
  return blockedResult(
    request.task,
    "Cette assistance est informative uniquement : aucune modification ou opération de contournement n'est disponible."
  );
}
