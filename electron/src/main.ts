/**
 * NovaUnlock — Electron Main Process
 * Gère la fenêtre principale, la politique de sécurité et la validation IPC.
 */

import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import * as path from "path";
import {
  appendAudit,
  discoverBackups,
  downloadFirmware,
  evaluatePreflight,
  validateFirmwareUrl,
  validateMasterTask,
  type MasterTask,
} from "./master-service";

let mainWindow: BrowserWindow | null = null;

const ALLOWED_EXTERNAL_HOSTS = new Set([
  "support.apple.com",
  "ipsw.me",
  "github.com",
]);

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
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

ipcMain.handle("usb:connect", async (_, deviceId: unknown) => {
  if (typeof deviceId !== "number" || !Number.isInteger(deviceId) || deviceId < 0) {
    throw new Error("Identifiant de périphérique USB invalide.");
  }
  const { connectDevice } = require(path.join(__dirname, "./usb-scanner"));
  return await connectDevice(deviceId);
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

ipcMain.handle("usb:flash-firmware", async (_, filePath: unknown) => {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return {
      success: false,
      progress: 0,
      stage: "Chemin du fichier firmware invalide.",
      speed: "",
    };
  }
  const { flashFirmware } = require(path.join(__dirname, "./usb-scanner"));
  return await flashFirmware(filePath);
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

ipcMain.handle("usb:install-libimobiledevice", async () => {
  const { installLibimobiledevice } = require(path.join(__dirname, "./usb-scanner"));
  return await installLibimobiledevice();
});

ipcMain.handle("master:backups", async () => discoverBackups());

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
      ? (device as {
          modelIdentifier?: string | null;
          serial?: string | null;
          mode?: string;
          activationLockStatus?: string | null;
        })
      : {};
  return evaluatePreflight(validTask, safeDevice);
});

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
