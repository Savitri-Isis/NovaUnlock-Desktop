import { randomUUID } from "crypto";
import {
  executeMasterOperation,
  validateMasterExecutionRequest,
  type MasterExecutionProgress,
  type MasterExecutionRequest,
  type MasterExecutionResult,
} from "./master-executor";
import type { MasterTask } from "./master-service";

export type MasterOperationState = "queued" | "running" | "completed" | "failed" | "blocked";

export interface MasterOperationStatus {
  id: string;
  task: MasterTask;
  state: MasterOperationState;
  progress: number | null;
  stage: string;
  speed?: string;
  updatedAt: string;
  result?: MasterExecutionResult;
}

interface InternalOperation extends MasterOperationStatus {
  startedAt: number;
}

const operations = new Map<string, InternalOperation>();
let activeOperationId: string | null = null;
const MAX_RETAINED_OPERATIONS = 20;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function now(): string {
  return new Date().toISOString();
}

function publicStatus(operation: InternalOperation): MasterOperationStatus {
  return {
    id: operation.id,
    task: operation.task,
    state: operation.state,
    progress: operation.progress,
    stage: operation.stage,
    ...(operation.speed ? { speed: operation.speed } : {}),
    updatedAt: operation.updatedAt,
    ...(operation.result ? { result: operation.result } : {}),
  };
}

function pruneOperations(): void {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, operation] of operations) {
    if (operation.startedAt < cutoff && id !== activeOperationId) operations.delete(id);
  }
  while (operations.size > MAX_RETAINED_OPERATIONS) {
    const oldest = [...operations.entries()]
      .filter(([id]) => id !== activeOperationId)
      .sort(([, left], [, right]) => left.startedAt - right.startedAt)[0];
    if (!oldest) break;
    operations.delete(oldest[0]);
  }
}

function updateProgress(operation: InternalOperation, progress: MasterExecutionProgress): void {
  operation.progress = progress.progress;
  operation.stage = progress.stage.slice(0, 500);
  operation.speed = progress.speed?.slice(0, 100);
  operation.updatedAt = now();
}

/**
 * Starts one operation at a time. This avoids racing two backup/restore processes
 * against the same USB device and lets the renderer poll a non-sensitive status.
 */
export function startMasterOperation(rawRequest: unknown): MasterOperationStatus {
  if (activeOperationId) {
    throw new Error("Une opération maître est déjà en cours. Attendez sa fin avant d'en lancer une autre.");
  }

  const request: MasterExecutionRequest = validateMasterExecutionRequest(rawRequest);
  const id = randomUUID();
  const operation: InternalOperation = {
    id,
    task: request.task,
    state: "queued",
    progress: null,
    stage: "Opération mise en file d'attente...",
    updatedAt: now(),
    startedAt: Date.now(),
  };
  operations.set(id, operation);
  activeOperationId = id;
  pruneOperations();

  void (async () => {
    operation.state = "running";
    operation.stage = "Prévol final en cours...";
    operation.updatedAt = now();
    try {
      const result = await executeMasterOperation(request, (progress) => updateProgress(operation, progress));
      operation.result = result;
      operation.stage = result.stage;
      operation.progress = result.success ? 100 : operation.progress;
      operation.state = result.success ? "completed" : result.stage === "Opération bloquée" ? "blocked" : "failed";
    } catch (error: unknown) {
      operation.state = "failed";
      operation.stage = "Erreur d'exécution";
      operation.result = {
        success: false,
        task: request.task,
        dryRun: false,
        stage: "Erreur d'exécution",
        message: error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue.",
      };
    } finally {
      operation.updatedAt = now();
      if (activeOperationId === id) activeOperationId = null;
      pruneOperations();
    }
  })();

  return publicStatus(operation);
}

export function getMasterOperationStatus(id: unknown): MasterOperationStatus | null {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) {
    throw new Error("Identifiant d'opération invalide.");
  }
  const operation = operations.get(id);
  return operation ? publicStatus(operation) : null;
}
