/**
 * NovaUnlock — Electron Main Process
 * Gère la fenêtre principale, la politique de sécurité et la validation IPC.
 */

import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import * as path from "path";
import {
  appendAudit,
  discoverBackups,
  downloadFirmware,
  evaluatePreflight,
  isDestructiveMasterTask,
  validateFirmwareUrl,
  validateMasterTask,
  type MasterTask,
} from "./master-service";
import { getNativeToolStatus, importNativePayload } from "./usb-scanner";
import { getMasterOperationStatus, startMasterOperation } from "./master-operation-manager";
import {
  getJailbreakOperationStatus,
  startJailbreakOperation,
} from "./jailbreak-operation-manager";
import { isAllowedExternalUrl } from "./external-links";

let mainWindow: BrowserWindow | null = null;

/** Do not disclose absolute user/runtime paths to the isolated renderer. */
function rendererNativeStatus() {
  const status = getNativeToolStatus();
  return { ...status, searchRoots: [] };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0A0A0F",
    show: false,
    titleBarStyle: "hiddenInset",
    titleBarOverlay: {
      color: "#0A0A0F",
      symbolColor: "#7B2FBE",
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // sandbox maintenu à false pour compatibilité du preload compilé CommonJS
      sandbox: false,
    },
  });

  // Charger le renderer
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers — Communication validée avec le preload

ipcMain.handle("usb:scan", async () => {
  const { scanDevices } = require(path.join(__dirname, "./usb-scanner"));
  return await scanDevices();
});

ipcMain.handle("usb:scan-all", async () => {
  const { scanAllDevices } = require(path.join(__dirname, "./usb-scanner"));
  return await scanAllDevices();
});

ipcMain.handle("usb:check-libimobiledevice", async () => {
  const { isLibimobiledeviceInstalled } = require(path.join(__dirname, "./usb-scanner"));
  return isLibimobiledeviceInstalled();
});

ipcMain.handle("usb:native-status", async () => rendererNativeStatus());

ipcMain.handle("usb:connect", async (_, deviceId: unknown, connectionId: unknown) => {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) {
    throw new Error("Identifiant de périphérique USB invalide.");
  }
  if (
    connectionId != null &&
    (typeof connectionId !== "string" || connectionId.length > 128 || !/^[A-Za-z0-9-]+$/.test(connectionId))
  ) {
    throw new Error("Identifiant de connexion USB invalide.");
  }
  const { connectDevice } = require(path.join(__dirname, "./usb-scanner"));
  return await connectDevice(deviceId, connectionId || undefined);
});

ipcMain.handle("usb:disconnect", async (_, deviceId: unknown) => {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) {
    throw new Error("Identifiant de périphérique USB invalide.");
  }
  const { disconnectDevice } = require(path.join(__dirname, "./usb-scanner"));
  return await disconnectDevice(deviceId);
});

ipcMain.handle("usb:send-dfu-command", async (_, command: unknown, args: unknown) => {
  if (typeof command !== "string" || command.trim().length === 0 || command.length > 64) {
    return { success: false, response: "Commande DFU invalide." };
  }
  const safeArgs = typeof args === "string" ? args.slice(0, 256) : "";
  const { sendDFUCommand } = require(path.join(__dirname, "./usb-scanner"));
  return await sendDFUCommand(command.trim(), safeArgs);
});

ipcMain.handle("usb:send-recovery-command", async (_, command: unknown) => {
  if (typeof command !== "string" || command.trim().length === 0 || command.length > 64) {
    return { success: false, response: "Commande Recovery invalide." };
  }
  const { sendRecoveryCommand } = require(path.join(__dirname, "./usb-scanner"));
  return await sendRecoveryCommand(command.trim());
});

ipcMain.handle("usb:flash-firmware", async (_event, filePath: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return {
      success: false,
      progress: 0,
      stage: "Chemin du fichier firmware invalide.",
      speed: "",
    };
  }

  // Legacy renderer channel deliberately cannot start a destructive child process.
  // A restoration is launched only by master:execute after its independently
  // checked preflight, explicit ownership attestation and typed confirmation.
  return {
    success: false,
    progress: 0,
    stage: "Restauration protégée : utilisez Application maîtresse pour le prévol et la confirmation officielle.",
    speed: "",
  };
});

ipcMain.handle("usb:get-device-info", async () => {
  const { getDeviceInfo } = require(path.join(__dirname, "./usb-scanner"));
  return await getDeviceInfo();
});

ipcMain.handle("usb:get-ecid", async () => {
  const { getECID } = require(path.join(__dirname, "./usb-scanner"));
  return await getECID();
});

ipcMain.handle("usb:get-activation-lock", async () => {
  const { getActivationLockStatus } = require(path.join(__dirname, "./usb-scanner"));
  return await getActivationLockStatus();
});

ipcMain.handle("usb:check-jailbreak", async () => {
  const { checkJailbreakStatus } = require(path.join(__dirname, "./usb-scanner"));
  return await checkJailbreakStatus();
});

let nativeImportInProgress = false;
ipcMain.handle("usb:install-libimobiledevice", async () => {
  // Prevent duplicate folder dialogs/imports, including navigation between screens.
  if (nativeImportInProgress) throw new Error("Une configuration des outils est déjà en cours.");
  nativeImportInProgress = true;
  try {
    const selected = await dialog.showOpenDialog({
      title: "Choisissez un paquet libimobiledevice Windows x64 extrait et de confiance",
      properties: ["openDirectory"],
      buttonLabel: "Configurer les outils",
    });

    if (selected.canceled || selected.filePaths.length === 0) {
      return {
        success: false,
        canceled: true,
        message: "Importation annulée : aucun dossier n'a été sélectionné.",
        status: rendererNativeStatus(),
      };
    }

    const imported = importNativePayload(selected.filePaths[0]);
    return { ...imported, status: rendererNativeStatus() };
  } finally {
    nativeImportInProgress = false;
  }
});

ipcMain.handle("master:backups", async () => discoverBackups());

ipcMain.handle("master:select-firmware", async () => {
  const selected = await dialog.showOpenDialog({
    title: "Sélectionnez un IPSW Apple signé",
    properties: ["openFile"],
    filters: [{ name: "Firmware IPSW", extensions: ["ipsw"] }],
    buttonLabel: "Utiliser ce firmware",
  });
  return selected.canceled || selected.filePaths.length === 0 ? null : selected.filePaths[0];
});

ipcMain.handle("master:download-firmware", async (_, url: unknown, buildId: unknown) => {
  validateFirmwareUrl(url);
  if (typeof buildId !== "string" || buildId.trim().length === 0) {
    throw new Error("Identifiant de build firmware invalide.");
  }
  return downloadFirmware(url as string, buildId);
});

ipcMain.handle("master:preflight", async (_, task: unknown, device: unknown) => {
  const validTask: MasterTask = validateMasterTask(task);
  const safeDevice =
    device && typeof device === "object"
      ? ({
          ...(device as {
            modelIdentifier?: string | null;
            serial?: string | null;
            mode?: string;
            activationLockStatus?: string | null;
          }),
        } as {
          modelIdentifier?: string | null;
          serial?: string | null;
          mode?: string;
          activationLockStatus?: string | null;
        })
      : {};

  // The renderer's cached status is useful for display only. Before a destructive
  // task, ask the native probe again and fail closed if it cannot explicitly verify
  // the lock state.
  if (isDestructiveMasterTask(validTask)) {
    const { getActivationLockStatus } = require(path.join(__dirname, "./usb-scanner"));
    const lock = await getActivationLockStatus();
    safeDevice.activationLockStatus = lock.state;
  }

  return evaluatePreflight(validTask, safeDevice, getNativeToolStatus());
});

ipcMain.handle("master:execute", async (_, request: unknown) => startMasterOperation(request));

ipcMain.handle("master:operation-status", async (_, operationId: unknown) =>
  getMasterOperationStatus(operationId)
);

ipcMain.handle("shell:open-external", async (_, url: unknown) => {
  if (typeof url !== "string" || !isAllowedExternalUrl(url)) {
    throw new Error("Lien externe non autorisé.");
  }
  await shell.openExternal(url);
  return { success: true };
});

ipcMain.handle("jailbreak:capabilities", async () => {
  const { resolveInstallerTool } = require(path.join(__dirname, "./jailbreak-executor"));
  const { getConnectedUdid } = require(path.join(__dirname, "./usb-scanner"));
  return {
    installReady: Boolean(resolveInstallerTool()),
    devicePaired: Boolean(getConnectedUdid()),
  };
});

ipcMain.handle("jailbreak:select-ipa", async () => {
  const selected = await dialog.showOpenDialog({
    title: "Sélectionnez l'IPA de jailbreak téléchargé depuis la source officielle",
    properties: ["openFile"],
    filters: [{ name: "Application IPA", extensions: ["ipa"] }],
    buttonLabel: "Utiliser cet IPA",
  });
  return selected.canceled || selected.filePaths.length === 0 ? null : selected.filePaths[0];
});

ipcMain.handle("jailbreak:apply", async (_, action: unknown) => startJailbreakOperation(action));

ipcMain.handle("jailbreak:apply-status", async (_, operationId: unknown) =>
  getJailbreakOperationStatus(operationId)
);

ipcMain.handle("master:audit", async (_, task: unknown, deviceId: unknown, event: unknown) => {
  const validTask: MasterTask = validateMasterTask(task);
  if (typeof deviceId !== "string" || typeof event !== "string") {
    throw new Error("Arguments d'audit invalides.");
  }
  appendAudit(validTask, deviceId, event);
  return { success: true };
});

// App lifecycle

app.whenReady().then(() => {
  // Content Security Policy (CSP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.ipsw.me https://*.ipsw.me https://*.apple.com https://*.cdn-apple.com http://localhost:* ws://localhost:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
        ],
      },
    });
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Sécurité : empêcher la navigation externe dans la fenêtre Electron
app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const isLocalDev = !app.isPackaged && navigationUrl.startsWith("http://localhost:5173");
    const isLocalFile = navigationUrl.startsWith("file://");
    if (!isLocalDev && !isLocalFile) {
      event.preventDefault();
      if (isAllowedExternalUrl(navigationUrl)) {
        shell.openExternal(navigationUrl).catch(() => {});
      }
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: "deny" };
  });
});
