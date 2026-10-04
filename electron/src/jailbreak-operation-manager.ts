/**
 * NovaUnlock — Suivi des opérations de jailbreak
 *
 * Une seule opération à la fois, comme pour les opérations maître : cela évite
 * de lancer deux installations concurrentes sur le même appareil USB. L'état
 * exposé au renderer ne contient aucun chemin absolu.
 */

import { randomUUID } from "crypto";
import {
  executeJailbreakAction,
  type JailbreakExecutionResult,
  type JailbreakProgress,
} from "./jailbreak-executor";
import { validateJailbreakAction } from "./jailbreak-plan";
import { appendAudit } from "./master-service";
import { getConnectedUdid } from "./usb-scanner";

export type JailbreakOperationState = "queued" | "running" | "completed" | "failed" | "blocked";

export interface JailbreakOperationStatus {
  id: string;
  methodId: string;
  methodName: string;
  state: JailbreakOperationState;
  progress: number | null;
  stage: string;
  speed?: string;
  updatedAt: string;
  result?: JailbreakExecutionResult;
}

interface InternalOperation extends JailbreakOperationStatus {
  startedAt: number;
}

const operations = new Map<string, InternalOperation>();
let activeOperationId: string | null = null;
const MAX_RETAINED_OPERATIONS = 10;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function now(): string {
  return new Date().toISOString();
}

function publicStatus(operation: InternalOperation): JailbreakOperationStatus {
  return {
    id: operation.id,
    methodId: operation.methodId,
    methodName: operation.methodName,
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

/** Journalise de façon hachée l'avancement d'une opération, sans donnée sensible. */
function audit(methodId: string, event: string): void {
  try {
    appendAudit("inspect", getConnectedUdid() || "unknown", `jailbreak ${methodId} ${event}`);
  } catch {
    // Le journal ne doit jamais faire échouer une opération.
  }
}

export function startJailbreakOperation(rawAction: unknown): JailbreakOperationStatus {
  if (activeOperationId) {
    throw new Error("Une opération de jailbreak est déjà en cours. Attendez sa fin.");
  }

  const action = validateJailbreakAction(rawAction);
  const id = randomUUID();
  const operation: InternalOperation = {
    id,
    methodId: action.methodId,
    methodName: action.methodName,
    state: "queued",
    progress: null,
    stage: "Opération mise en file d'attente…",
    updatedAt: now(),
    startedAt: Date.now(),
  };
  operations.set(id, operation);
  activeOperationId = id;
  pruneOperations();
  audit(action.methodId, "demarrage");

  void (async () => {
    operation.state = "running";
    operation.stage = "Préparation de l'action…";
    operation.updatedAt = now();
    try {
      const result = await executeJailbreakAction(action, (progress: JailbreakProgress) => {
        operation.progress = progress.progress;
        operation.stage = progress.stage.slice(0, 500);
        operation.speed = progress.speed?.slice(0, 100);
        operation.updatedAt = now();
      });
      operation.result = result;
      operation.stage = result.stage;
      operation.progress = result.success ? 100 : operation.progress;
      operation.state = result.success ? "completed" : result.stage === "Outil manquant" ? "blocked" : "failed";
      audit(action.methodId, result.success ? "termine" : "echec");
    } catch (error: unknown) {
      operation.state = "failed";
      operation.stage = "Erreur d'exécution";
      operation.result = {
        success: false,
        methodId: action.methodId,
        methodName: action.methodName,
        kind: action.kind,
        stage: "Erreur d'exécution",
        message: error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue.",
      };
      audit(action.methodId, "echec");
    } finally {
      operation.updatedAt = now();
      if (activeOperationId === id) activeOperationId = null;
      pruneOperations();
    }
  })();

  return publicStatus(operation);
}

export function getJailbreakOperationStatus(id: unknown): JailbreakOperationStatus | null {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) {
    throw new Error("Identifiant d'opération invalide.");
  }
  const operation = operations.get(id);
  return operation ? publicStatus(operation) : null;
}
