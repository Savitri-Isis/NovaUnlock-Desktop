/**
 * NovaUnlock — Electron Main Process
 * Gère la fenêtre principale et la communication avec le preload.
 */

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { appendAudit, discoverBackups, downloadFirmware, evaluatePreflight, type MasterTask } from "./master-service";

let mainWindow: BrowserWindow | null = null;

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

// IPC Handlers — Communication avec le preload

ipcMain.handle("usb:scan", async () => {
  const { scanDevices } = require(path.join(__dirname, "./usb-scanner"));
  return await scanDevices();
});

ipcMain.handle("usb:connect", async (_, deviceId: number) => {
  const { connectDevice } = require(path.join(__dirname, "./usb-scanner"));
  return await connectDevice(deviceId);
});

ipcMain.handle("usb:disconnect", async (_, deviceId: number) => {
  const { disconnectDevice } = require(path.join(__dirname, "./usb-scanner"));
  return await disconnectDevice(deviceId);
});

ipcMain.handle("usb:send-dfu-command", async (_, command: string, args: string) => {
  const { sendDFUCommand } = require(path.join(__dirname, "./usb-scanner"));
  return await sendDFUCommand(command, args);
});

ipcMain.handle("usb:send-recovery-command", async (_, command: string) => {
  const { sendRecoveryCommand } = require(path.join(__dirname, "./usb-scanner"));
  return await sendRecoveryCommand(command);
});

ipcMain.handle("usb:flash-firmware", async (_, filePath: string) => {
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
ipcMain.handle("master:download-firmware", async (_, url: string, buildId: string) => downloadFirmware(url, buildId));
ipcMain.handle("master:preflight", async (_, task: MasterTask, device) => evaluatePreflight(task, device));
ipcMain.handle("master:audit", async (_, task: MasterTask, deviceId: string, event: string) => {
  appendAudit(task, deviceId, event);
  return { success: true };
});

// App lifecycle

app.whenReady().then(createWindow);

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

// Sécurité : empêcher la navigation externe
app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
});
