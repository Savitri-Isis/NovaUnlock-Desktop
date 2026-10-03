import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  DEVICE_IDS,
  getModeFromProductId,
  getNativePath,
  validateIpswPath,
  parseRestoreOutput,
  flashFirmware,
  connectDevice,
  disconnectDevice,
  getActivationLockStatus,
  checkJailbreakState,
  sendDFUCommand,
  sendRecoveryCommand,
  getNativeToolStatus,
  importNativePayload,
  NATIVE_TOOL_FILES,
} from "../electron/src/usb-scanner";
import {
  validateMasterTask,
  validateFirmwareUrl,
  getFreeDiskSpaceGb,
  hashDeviceId,
  parsePlistContent,
  discoverBackups,
  evaluatePreflight,
  appendAudit,
} from "../electron/src/master-service";
import { validateMasterExecutionRequest } from "../electron/src/master-executor";

describe("USB Scanner & Native Runner — Tests unitaires et sécurité", () => {
  it("identifie correctement le mode appareil via getModeFromProductId", () => {
    expect(getModeFromProductId(DEVICE_IDS.DFU)).toBe("dfu");
    expect(getModeFromProductId(DEVICE_IDS.RECOVERY)).toBe("recovery");
    expect(getModeFromProductId(DEVICE_IDS.NORMAL)).toBe("normal");
    expect(getModeFromProductId(DEVICE_IDS.NORMAL_2)).toBe("normal");
    expect(getModeFromProductId(DEVICE_IDS.NORMAL_3)).toBe("normal");
    expect(getModeFromProductId(DEVICE_IDS.KDFU)).toBe("kdfu");
    expect(getModeFromProductId(0x9999)).toBe("unknown");
  });

  it("résout getNativePath correctement en mode packagé et en développement", () => {
    const packagedPath = getNativePath({
      isPackaged: true,
      resourcesPath: "/opt/NovaUnlock/resources",
    });
    expect(packagedPath).toBe(path.join("/opt/NovaUnlock/resources", "native"));

    const devPath = getNativePath({
      isPackaged: false,
      appPath: "/workspace/NovaUnlock-Desktop",
    });
    expect(devPath).toBe(path.join("/workspace/NovaUnlock-Desktop", "native"));
  });

  it("importe un payload natif extrait sans exécuter de binaire et expose ses capacités", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-native-"));
    const source = path.join(tmpRoot, "archive", "bin");
    const destination = path.join(tmpRoot, "runtime-native");
    fs.mkdirSync(source, { recursive: true });

    for (const file of Object.values(NATIVE_TOOL_FILES)) {
      fs.writeFileSync(path.join(source, file), "fake executable payload");
    }
    fs.writeFileSync(path.join(source, "libimobiledevice.dll"), "fake dll payload");
    fs.writeFileSync(path.join(source, "LICENSE"), "license notice");

    try {
      expect(getNativeToolStatus([destination]).diagnosticsReady).toBe(false);
      const imported = importNativePayload(path.join(tmpRoot, "archive"), destination);
      expect(imported.success).toBe(true);
      expect(imported.status.diagnosticsReady).toBe(true);
      expect(imported.status.backupReady).toBe(true);
      expect(imported.status.restoreReady).toBe(true);
      expect(imported.status.activationCheckReady).toBe(true);
      expect(imported.status.hasDlls).toBe(true);
      expect(imported.importedFiles).toContain("idevicebackup2.exe");
      expect(fs.existsSync(path.join(destination, "libimobiledevice", "LICENSE"))).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("valide strictement les chemins IPSW (validateIpswPath)", () => {
    expect(() => validateIpswPath("")).toThrow(/invalide/i);
    expect(() => validateIpswPath(null)).toThrow(/invalide/i);
    expect(() => validateIpswPath("/tmp/test\0.ipsw")).toThrow(/interdits/i);
    expect(() => validateIpswPath("/tmp/firmware.zip")).toThrow(/\.ipsw/i);
    expect(() => validateIpswPath("/tmp/introuvable_12345.ipsw")).toThrow(/introuvable/i);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipsw-"));
    const validIpsw = path.join(tmpDir, "iPhone14,5_17.4_Restore.ipsw");
    fs.writeFileSync(validIpsw, "dummy-ipsw-header");
    try {
      expect(validateIpswPath(validIpsw)).toBe(path.resolve(validIpsw));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("parse la progression et la vitesse d'idevicerestore (parseRestoreOutput)", () => {
    let state = { progress: 0, stage: "Initialisation...", speed: "" };

    state = parseRestoreOutput("Extracting filesystem from IPSW... 25%", state);
    expect(state.stage).toBe("Extraction du firmware...");
    expect(state.progress).toBe(25);

    state = parseRestoreOutput("Restoring image... 68% (42.5 MB/s)", state);
    expect(state.stage).toBe("Restauration en cours...");
    expect(state.progress).toBe(68);
    expect(state.speed).toBe("42.5 MB/s");

    state = parseRestoreOutput("Verifying restore...", state);
    expect(state.stage).toBe("Vérification...");
    expect(state.progress).toBe(68);
  });

  it("n'affiche pas 100% de progression lorsque flashFirmware échoue ou manque de binaire", async () => {
    const invalidResult = await flashFirmware("firmware_invalide.txt");
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.progress).toBe(0);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-flash-"));
    const validIpsw = path.join(tmpDir, "test.ipsw");
    fs.writeFileSync(validIpsw, "dummy");
    try {
      const missingBinaryResult = await flashFirmware(validIpsw);
      expect(missingBinaryResult.success).toBe(false);
      expect(missingBinaryResult.progress).toBe(0);
      expect(missingBinaryResult.stage).toMatch(/introuvable/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("ne simule pas un succès de connexion si aucun appareil ni binaire n'est présent", async () => {
    expect(await connectDevice(-1)).toBe(false);
    expect(await connectDevice(99999)).toBe(false);
    expect(await disconnectDevice(-1)).toBe(false);
    expect(await disconnectDevice(1)).toBe(true);
  });

  it("retourne un état Activation Lock fail-closed (unavailable/unknown) et jamais locked: false en cas d'erreur", async () => {
    const status = await getActivationLockStatus();
    expect(["unavailable", "unknown"]).toContain(status.state);
    expect(status.locked).toBeNull();
  });

  it("retourne 'not-checked' pour le jailbreak lorsque ideviceinfo est absent", async () => {
    const jbState = await checkJailbreakState();
    expect(jbState).toBe("not-checked");
  });

  it("rejette les commandes DFU et Recovery inconnues ou sans binaire", async () => {
    const unknownDfu = await sendDFUCommand("drop_table", "");
    expect(unknownDfu.success).toBe(false);

    const missingDfuBinary = await sendDFUCommand("enter_dfu", "");
    expect(missingDfuBinary.success).toBe(false);

    const unknownRec = await sendRecoveryCommand("invalid_cmd");
    expect(unknownRec.success).toBe(false);
  });
});

describe("Master Service — Validation, Plist, Disque et Prévol", () => {
  it("valide les tâches maître (validateMasterTask)", () => {
    expect(validateMasterTask("inspect")).toBe("inspect");
    expect(validateMasterTask("screenpass")).toBe("screenpass");
    expect(() => validateMasterTask("exploit")).toThrow(/invalide/i);
    expect(() => validateMasterTask(123)).toThrow(/invalide/i);
  });

  it("restreint les téléchargements firmware aux domaines officiels HTTPS (validateFirmwareUrl)", () => {
    const appleUrl = validateFirmwareUrl(
      "https://updates.cdn-apple.com/2024/ios/012-34567/iPhone14,5_Restore.ipsw"
    );
    expect(appleUrl.hostname).toBe("updates.cdn-apple.com");

    const ipswUrl = validateFirmwareUrl("https://api.ipsw.me/v4/ipsw/download/iPhone14,5/21E219");
    expect(ipswUrl.hostname).toBe("api.ipsw.me");

    expect(() =>
      validateFirmwareUrl("http://updates.cdn-apple.com/firmware.ipsw")
    ).toThrow(/HTTPS/i);
    expect(() =>
      validateFirmwareUrl("https://malicious.example.com/iPhone_Restore.ipsw")
    ).toThrow(/Domaine non autorisé/i);
  });

  it("calcule l'espace disque libre réel en Go via statfsSync (getFreeDiskSpaceGb)", () => {
    const diskFree = getFreeDiskSpaceGb(os.homedir());
    expect(typeof diskFree).toBe("number");
    expect(diskFree).toBeGreaterThanOrEqual(0);
  });

  it("génère un hash d'audit déterministe de 24 caractères (hashDeviceId)", () => {
    const h1 = hashDeviceId("F2LXYZ123456");
    const h2 = hashDeviceId("F2LXYZ123456");
    expect(h1).toHaveLength(24);
    expect(h1).toBe(h2);
    expect(h1).not.toContain("F2LXYZ123456");
  });

  it("parse correctement les fichiers plist XML et bplist00 et détecte IsEncrypted", () => {
    const xmlUnencrypted = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Device Name</key>
  <string>iPhone de Marie</string>
  <key>Product Type</key>
  <string>iPhone14,5</string>
  <key>Product Version</key>
  <string>17.4.1</string>
  <key>IsEncrypted</key>
  <false/>
</dict>
</plist>`;

    const parsedUnencrypted = parsePlistContent(xmlUnencrypted);
    expect(parsedUnencrypted.name).toBe("iPhone de Marie");
    expect(parsedUnencrypted.productType).toBe("iPhone14,5");
    expect(parsedUnencrypted.iosVersion).toBe("17.4.1");
    expect(parsedUnencrypted.isEncrypted).toBe(false);
    expect(parsedUnencrypted.isBinary).toBe(false);

    const binaryBuf = Buffer.from("bplist00...iPhone15,2...", "ascii");
    const parsedBinary = parsePlistContent(binaryBuf);
    expect(parsedBinary.isBinary).toBe(true);
    expect(parsedBinary.productType).toBe("iPhone15,2");

    // Test discoverBackups sur un dossier temporaire contenant Info.plist et Manifest.plist non chiffré
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-backups-"));
    const backupDir = path.join(tmpRoot, "00008110-00123456789ABCDE");
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, "Info.plist"), xmlUnencrypted);
    fs.writeFileSync(path.join(backupDir, "Manifest.plist"), xmlUnencrypted);

    try {
      const backups = discoverBackups([tmpRoot]);
      expect(backups).toHaveLength(1);
      expect(backups[0].name).toBe("iPhone de Marie");
      expect(backups[0].encrypted).toBe(false);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("évalue le prévol en tenant compte du statut Activation Lock inconnu et de l'appareil", () => {
    const blocked = evaluatePreflight("screenpass", {
      serial: null,
      mode: "normal",
      activationLockStatus: "unknown",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockers).toContain("Aucun appareil identifié.");
    expect(blocked.warnings.some((w) => /Activation Lock inconnu/i.test(w))).toBe(true);

    const ready = evaluatePreflight("inspect", {
      serial: "DNP123456789",
      modelIdentifier: "iPhone14,5",
      mode: "normal",
      activationLockStatus: "unlocked",
    });
    expect(ready.ok).toBe(true);
    expect(ready.blockers).toHaveLength(0);
  });

  it("bloque une restauration tant que l'Activation Lock n'est pas explicitement déverrouillé", () => {
    const nativeStatus = {
      diagnosticsReady: true,
      backupReady: true,
      restoreReady: true,
      activationCheckReady: true,
      complete: true,
      hasDlls: true,
      searchRoots: [],
      tools: {
        deviceId: true,
        deviceInfo: true,
        activation: true,
        backup: true,
        restore: true,
        recovery: true,
        enterRecovery: true,
      },
      missing: [],
      source: "bundled" as const,
    };

    const unknownLock = evaluatePreflight(
      "factory-reset",
      { serial: "DNP123456789", mode: "dfu", activationLockStatus: "unknown" },
      nativeStatus
    );
    expect(unknownLock.canExecute).toBe(false);
    expect(unknownLock.blockers.join(" ")).toMatch(/Activation Lock/);

    const unlocked = evaluatePreflight(
      "factory-reset",
      { serial: "DNP123456789", mode: "recovery", activationLockStatus: "unlocked" },
      nativeStatus
    );
    expect(unlocked.canExecute).toBe(true);
    expect(unlocked.requirements.typedConfirmation).toBe(true);
    expect(unlocked.requirements.firmwareFile).toBe(true);
  });

  it("valide et borne les requêtes d'exécution maître sans accepter de tâche inconnue", () => {
    const request = validateMasterExecutionRequest({
      task: "backup",
      device: { serial: "DNP123456789", mode: "normal" },
      confirmation: { backupPassword: "un-secret-de-sauvegarde" },
    });
    expect(request.task).toBe("backup");
    expect(request.confirmation?.backupPassword).toBe("un-secret-de-sauvegarde");
    expect(() => validateMasterExecutionRequest({ task: "bypass", device: {} })).toThrow(/invalide/i);
    expect(() =>
      validateMasterExecutionRequest({
        task: "backup",
        device: { serial: "x\0y" },
      })
    ).toThrow(/invalide/i);
  });

  it("valide les entrées de appendAudit", () => {
    expect(() => appendAudit("inspect", "", "preflight")).toThrow(/invalide/i);
    expect(() => appendAudit("inspect", "SN123", "")).toThrow(/invalide/i);
  });
});
