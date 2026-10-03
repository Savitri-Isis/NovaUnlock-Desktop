/**
 * Gestion des binaires libimobiledevice distribués séparément.
 *
 * Les binaires ne sont jamais téléchargés ou exécutés à l'insu de l'utilisateur.
 * Un paquet Windows peut les inclure dans resources/native, tandis qu'une importation
 * faite depuis l'interface est installée dans le répertoire utilisateur afin de ne
 * pas modifier Program Files ni le dossier de l'application.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const NATIVE_TOOL_FILES = {
  deviceId: "idevice_id.exe",
  deviceInfo: "ideviceinfo.exe",
  activation: "ideviceactivation.exe",
  backup: "idevicebackup2.exe",
  restore: "idevicerestore.exe",
  recovery: "irecovery.exe",
  enterRecovery: "ideviceenterrecovery.exe",
} as const;

export type NativeToolName = keyof typeof NATIVE_TOOL_FILES;

/** ideviceenterrecovery is useful but optional: button sequences remain a supported fallback. */
const REQUIRED_NATIVE_TOOLS: readonly NativeToolName[] = [
  "deviceId",
  "deviceInfo",
  "activation",
  "backup",
  "restore",
  "recovery",
] as const;

export interface NativePathEnvironment {
  isPackaged?: boolean;
  resourcesPath?: string;
  appPath?: string;
  userDataPath?: string;
}

export interface NativeToolStatus {
  /** True when the read-only diagnostic tools are available. */
  diagnosticsReady: boolean;
  /** True when idevicebackup2 is available. */
  backupReady: boolean;
  /** True when an official IPSW restore can be started. */
  restoreReady: boolean;
  /** True when the fail-closed Activation Lock probe is available. */
  activationCheckReady: boolean;
  /** All required tools are present (ideviceenterrecovery remains optional). */
  complete: boolean;
  /** The payload contains DLLs in addition to executables. */
  hasDlls: boolean;
  /** Paths used for lookup, ordered by precedence. */
  searchRoots: string[];
  /** Individual availability, useful for an actionable UI. */
  tools: Record<NativeToolName, boolean>;
  /** Tool files which are not available. */
  missing: string[];
  /** Non-sensitive description of the selected source(s). */
  source: "runtime" | "bundled" | "mixed" | "none";
}

export interface NativeImportResult {
  success: boolean;
  message: string;
  importedFiles: string[];
  status: NativeToolStatus;
}

function getElectronApp(): {
  isPackaged?: boolean;
  getAppPath?: () => string;
  getPath?: (name: string) => string;
} | null {
  try {
    // require est volontaire : ce module est aussi testé hors Electron.
    const electron = require("electron");
    return electron?.app || null;
  } catch {
    return null;
  }
}

/**
 * Emplacement livré par electron-builder (ou le dossier native du checkout en dev).
 * Cette fonction est exportée à travers usb-scanner pour préserver l'API existante.
 */
export function getBundledNativePath(envOverride?: NativePathEnvironment): string {
  if (envOverride && typeof envOverride.isPackaged === "boolean") {
    if (envOverride.isPackaged && envOverride.resourcesPath) {
      return path.join(envOverride.resourcesPath, "native");
    }
    if (!envOverride.isPackaged && envOverride.appPath) {
      return path.join(envOverride.appPath, "native");
    }
  }

  const app = getElectronApp();
  try {
    if (app && typeof app.isPackaged === "boolean") {
      if (app.isPackaged) {
        const resourcesPath =
          (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || __dirname;
        return path.join(resourcesPath, "native");
      }
      if (typeof app.getAppPath === "function") {
        return path.join(app.getAppPath(), "native");
      }
    }
  } catch {
    // L'application Electron n'est pas encore initialisée.
  }

  return path.resolve(__dirname, "../../native");
}

/**
 * Emplacement inscriptible utilisé pour les binaires importés après installation.
 * NOVAUNLOCK_NATIVE_RUNTIME_DIR est réservé aux administrateurs et aux tests.
 */
export function getRuntimeNativePath(envOverride?: NativePathEnvironment): string {
  const fromEnvironment = process.env.NOVAUNLOCK_NATIVE_RUNTIME_DIR;
  if (fromEnvironment && fromEnvironment.trim()) {
    return path.resolve(fromEnvironment.trim());
  }

  if (envOverride?.userDataPath) {
    return path.join(envOverride.userDataPath, "native");
  }

  const app = getElectronApp();
  try {
    if (app && typeof app.getPath === "function") {
      return path.join(app.getPath("userData"), "native");
    }
  } catch {
    // Repli hors Electron ci-dessous.
  }

  return path.join(os.homedir(), ".novaunlock", "native");
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((item) => path.resolve(item)))];
}

/** Runtime first lets a user repair a packaged installation without admin rights. */
export function getNativeSearchRoots(envOverride?: NativePathEnvironment): string[] {
  return uniquePaths([getRuntimeNativePath(envOverride), getBundledNativePath(envOverride)]);
}

function toolDirectory(nativeRoot: string): string {
  return path.join(nativeRoot, "libimobiledevice");
}

function rootKind(root: string, envOverride?: NativePathEnvironment): "runtime" | "bundled" {
  return path.resolve(root) === path.resolve(getRuntimeNativePath(envOverride)) ? "runtime" : "bundled";
}

/** Resolve one known binary without ever accepting a renderer-provided executable path. */
export function resolveNativeTool(
  tool: NativeToolName,
  roots: string[] = getNativeSearchRoots()
): string | null {
  const fileName = NATIVE_TOOL_FILES[tool];
  for (const root of uniquePaths(roots)) {
    const candidate = path.join(toolDirectory(root), fileName);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // A payload may be replaced while capabilities are refreshed; try next root.
    }
  }
  return null;
}

export function getNativeToolStatus(roots: string[] = getNativeSearchRoots()): NativeToolStatus {
  const normalizedRoots = uniquePaths(roots);
  const tools = {} as Record<NativeToolName, boolean>;
  const usedRoots = new Set<"runtime" | "bundled">();

  (Object.keys(NATIVE_TOOL_FILES) as NativeToolName[]).forEach((tool) => {
    const executable = resolveNativeTool(tool, normalizedRoots);
    tools[tool] = Boolean(executable);
    if (executable) {
      const root = normalizedRoots.find(
        (item) => path.resolve(executable).startsWith(`${path.resolve(toolDirectory(item))}${path.sep}`)
      );
      if (root) usedRoots.add(rootKind(root));
    }
  });

  const hasDlls = normalizedRoots.some((root) => {
    const directory = toolDirectory(root);
    try {
      return fs.readdirSync(directory, { withFileTypes: true }).some(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".dll")
      );
    } catch {
      return false;
    }
  });

  const missing = (Object.keys(NATIVE_TOOL_FILES) as NativeToolName[])
    .filter((tool) => !tools[tool])
    .map((tool) => NATIVE_TOOL_FILES[tool]);

  const source: NativeToolStatus["source"] =
    usedRoots.size === 0
      ? "none"
      : usedRoots.size > 1
      ? "mixed"
      : usedRoots.has("runtime")
      ? "runtime"
      : "bundled";

  return {
    diagnosticsReady: tools.deviceId && tools.deviceInfo,
    backupReady: tools.backup,
    restoreReady: tools.restore && tools.recovery,
    activationCheckReady: tools.activation,
    complete: REQUIRED_NATIVE_TOOLS.every((tool) => tools[tool]),
    hasDlls,
    searchRoots: normalizedRoots,
    tools,
    missing,
    source,
  };
}

function readDirectories(root: string, maxDirectories = 2_000): string[] {
  const pending = [root];
  const directories: string[] = [];

  while (pending.length > 0 && directories.length < maxDirectories) {
    const current = pending.shift()!;
    directories.push(current);
    try {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          pending.push(path.join(current, entry.name));
        }
      }
    } catch {
      // A directory which cannot be read simply cannot be a usable payload source.
    }
  }

  return directories;
}

function payloadScore(directory: string): number {
  try {
    const files = new Set(
      fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name.toLowerCase())
    );
    return Object.values(NATIVE_TOOL_FILES).filter((name) => files.has(name.toLowerCase())).length;
  } catch {
    return -1;
  }
}

/** Find the directory inside an extracted archive which holds the executables. */
export function findNativePayloadDirectory(sourceDirectory: string): string | null {
  if (typeof sourceDirectory !== "string" || !sourceDirectory.trim()) return null;
  const source = path.resolve(sourceDirectory);
  try {
    if (!fs.statSync(source).isDirectory()) return null;
  } catch {
    return null;
  }

  let best: { directory: string; score: number } | null = null;
  for (const directory of readDirectories(source)) {
    const score = payloadScore(directory);
    if (!best || score > best.score) {
      best = { directory, score };
    }
  }

  // idevice_id and ideviceinfo are the minimum viable diagnostic payload.
  return best && best.score >= 2 ? best.directory : null;
}

function allowedPayloadFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".exe") ||
    lower.endsWith(".dll") ||
    /^(copying|license|licenses?|notice|readme)(\.[a-z0-9_-]+)?$/i.test(fileName)
  );
}

/**
 * Copy an already-extracted, user-selected official payload into a writable runtime
 * directory. Only executables, DLLs and license notices are copied; no archive is
 * executed and no network download occurs here.
 */
export function importNativePayload(
  sourceDirectory: string,
  destinationRoot: string = getRuntimeNativePath()
): NativeImportResult {
  const payloadDirectory = findNativePayloadDirectory(sourceDirectory);
  const destination = path.resolve(destinationRoot);
  const destinationDirectory = toolDirectory(destination);

  if (!payloadDirectory) {
    return {
      success: false,
      message:
        "Aucun paquet libimobiledevice valide trouvé. Sélectionnez le dossier extrait qui contient ideviceinfo.exe et idevice_id.exe.",
      importedFiles: [],
      status: getNativeToolStatus([destination]),
    };
  }

  if (path.resolve(payloadDirectory) === path.resolve(destinationDirectory)) {
    const status = getNativeToolStatus([destination]);
    return {
      success: status.diagnosticsReady,
      message: status.diagnosticsReady
        ? "Les binaires libimobiledevice sont déjà disponibles dans le répertoire utilisateur."
        : "Le dossier sélectionné ne contient pas les outils de diagnostic requis.",
      importedFiles: [],
      status,
    };
  }

  try {
    fs.mkdirSync(destinationDirectory, { recursive: true });
    const importedFiles: string[] = [];
    for (const entry of fs.readdirSync(payloadDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !allowedPayloadFile(entry.name)) continue;
      const source = path.join(payloadDirectory, entry.name);
      const target = path.join(destinationDirectory, path.basename(entry.name));
      fs.copyFileSync(source, target);
      importedFiles.push(entry.name);
    }

    const status = getNativeToolStatus([destination]);
    if (!status.diagnosticsReady) {
      return {
        success: false,
        message:
          "L'importation est incomplète : ideviceinfo.exe et idevice_id.exe sont requis. Vérifiez que vous avez choisi le dossier Windows x64 extrait.",
        importedFiles,
        status,
      };
    }

    const unavailable = [
      !status.backupReady ? "sauvegarde (idevicebackup2.exe)" : "",
      !status.restoreReady ? "restauration (idevicerestore.exe / irecovery.exe)" : "",
      !status.activationCheckReady ? "contrôle Activation Lock (ideviceactivation.exe)" : "",
    ].filter(Boolean);

    return {
      success: true,
      message:
        unavailable.length > 0
          ? `Binaires de diagnostic importés. Fonctionnalités encore indisponibles : ${unavailable.join(", ")}.`
          : "Binaires libimobiledevice importés et prêts à être vérifiés.",
      importedFiles,
      status,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "erreur de copie inconnue";
    return {
      success: false,
      message: `Impossible d'importer les binaires : ${message}`,
      importedFiles: [],
      status: getNativeToolStatus([destination]),
    };
  }
}
