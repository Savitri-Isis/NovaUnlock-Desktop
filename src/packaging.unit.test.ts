// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const { runPackaging, selectNativeDirectory, supportedNodeVersion } = require("../scripts/package-windows.cjs");
const { required, inspectNativeDirectory } = require("../scripts/verify-native.cjs");
const roots: string[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-build-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "scripts"));
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.writeFileSync(path.join(root, "package-lock.json"), "{}");
  for (const script of ["prepare-native.cjs", "verify-native.cjs"]) {
    fs.copyFileSync(path.resolve("scripts", script), path.join(root, "scripts", script));
  }
  return root;
}

function payload(directory: string, files: string[] = [...required, "imobiledevice.dll"]) {
  fs.mkdirSync(directory, { recursive: true });
  for (const file of files) fs.writeFileSync(path.join(directory, file), "test fixture, never executed");
}

function assistant(root = fixture()) {
  return {
    root,
    platform: "win32",
    arch: "x64",
    nodeVersion: "22.22.2",
    env: {},
    exec: vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" }),
    selectDirectory: vi.fn().mockReturnValue("C:\\Paquets validés & licences\\bin"),
    log: vi.fn(),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Assistant de packaging Windows", () => {
  it.each(["22.22.2", "22.23.0", "24.15.0", "24.16.0", "26.0.0"])("accepte Node %s", (version) => {
    expect(supportedNodeVersion(version)).toBe(true);
  });

  it.each(["18.20.0", "20.19.0", "22.22.1", "24.14.9", "25.0.0"])("refuse Node %s incompatible avec les dépendances verrouillées", (version) => {
    expect(supportedNodeVersion(version)).toBe(false);
  });

  it.each([{ platform: "linux" }, { arch: "ia32" }, { nodeVersion: "18.0.0" }])("refuse un environnement incompatible avant toute commande : %j", (overrides) => {
    const config = { ...assistant(), ...overrides };
    expect(() => runPackaging(config)).toThrow();
    expect(config.exec).not.toHaveBeenCalled();
  });

  it("annule avant la copie, npm ci et le packaging si le sélecteur est fermé", () => {
    const config = assistant();
    config.selectDirectory.mockReturnValue(null);
    expect(runPackaging(config)).toEqual({ canceled: true });
    expect(config.exec).toHaveBeenCalledTimes(1); // npm --version only
    expect(config.exec.mock.calls[0][1]).toContain("npm.cmd --version");
  });

  it("enchaîne les étapes et passe le chemin utilisateur comme argument, jamais comme commande shell", () => {
    const config = assistant();
    const result = runPackaging(config);
    const calls = config.exec.mock.calls;
    expect(calls.map((call) => call[1])).toEqual([
      ["/d", "/s", "/c", "npm.cmd --version"],
      [path.join(config.root, "scripts", "prepare-native.cjs"), "C:\\Paquets validés & licences\\bin", "--require-complete"],
      [path.join(config.root, "scripts", "verify-native.cjs")],
      ["/d", "/s", "/c", "npm.cmd ci --include=dev"],
      ["/d", "/s", "/c", "npm.cmd run package:win"],
      [path.join(config.root, "release")],
    ]);
    for (const call of calls) expect(call[2]).toMatchObject({ cwd: config.root, shell: false });
    expect(result).toEqual({ canceled: false, outputDirectory: path.join(config.root, "release") });
  });

  it("réutilise un paquet déjà complet sans redemander un dossier", () => {
    const config = assistant();
    payload(path.join(config.root, "native", "libimobiledevice"));
    runPackaging(config);
    expect(config.selectDirectory).not.toHaveBeenCalled();
    expect(config.exec.mock.calls.some((call) => call[1][0].endsWith("prepare-native.cjs"))).toBe(false);
    expect(config.exec.mock.calls.some((call) => call[1][0].endsWith("verify-native.cjs"))).toBe(true);
  });

  it("respecte NOVAUNLOCK_NATIVE_DIR même si le dossier de destination est complet", () => {
    const config = assistant();
    payload(path.join(config.root, "native", "libimobiledevice"));
    runPackaging({ ...config, env: { NOVAUNLOCK_NATIVE_DIR: "C:\\nouveau paquet" } });
    expect(config.selectDirectory).not.toHaveBeenCalled();
    expect(config.exec.mock.calls[1][1]).toContain("C:\\nouveau paquet");
  });

  it.each([0, 1, 2, 3, 4])("s'arrête à l'étape en échec (%s) sans lancer la suivante ni Explorer", (index) => {
    const config = assistant();
    let calls = 0;
    config.exec.mockImplementation(() => ({ status: calls++ === index ? 17 : 0 }));
    expect(() => runPackaging(config)).toThrow(/code 17/);
    expect(config.exec).toHaveBeenCalledTimes(index + 1);
    expect(config.exec.mock.calls.some((call) => call[0] === "explorer.exe")).toBe(false);
  });

  it("traite une erreur de démarrage ou une interruption comme un échec", () => {
    for (const result of [{ error: new Error("ENOENT") }, { status: null, signal: "SIGTERM" }]) {
      const config = assistant();
      config.exec.mockReturnValue(result);
      expect(() => runPackaging(config)).toThrow(/échec/);
      expect(config.exec).toHaveBeenCalledTimes(1);
    }
  });

  it("refuse un projet incomplet avant npm ci", () => {
    const config = assistant();
    fs.unlinkSync(path.join(config.root, "package-lock.json"));
    expect(() => runPackaging(config)).toThrow(/package-lock.json/);
    expect(config.exec).not.toHaveBeenCalled();
  });
});

describe("Sélecteur Windows", () => {
  it("retourne les chemins Unicode littéralement et ne modifie pas la politique PowerShell", () => {
    const exec = vi.fn().mockReturnValue({ status: 0, stdout: "C:\\outils é & $(texte)\\bin", stderr: "" });
    expect(selectNativeDirectory(exec)).toBe("C:\\outils é & $(texte)\\bin");
    const [, args, options] = exec.mock.calls[0];
    expect(args).toContain("-STA");
    expect(args).not.toContain("-ExecutionPolicy");
    expect(options.shell).toBe(false);
    expect(Buffer.from(args.at(-1), "base64").toString("utf16le")).not.toContain("C:\\outils");
  });
  it("distingue une annulation d'un échec PowerShell", () => {
    expect(selectNativeDirectory(() => ({ status: 0, stdout: "" }))).toBeNull();
    expect(() => selectNativeDirectory(() => ({ status: 1, stderr: "Access denied" }))).toThrow(/sélecteur/);
  });
});

describe("Préparation native avant construction", () => {
  it("ignore les répertoires dont le nom ressemble à un exécutable ou une DLL", () => {
    const root = fixture();
    for (const name of [...required, "fake.dll"]) fs.mkdirSync(path.join(root, name));
    const status = inspectNativeDirectory(root);
    expect(status.complete).toBe(false);
    expect(status.missing).toEqual(required);
    expect(status.dlls).toEqual([]);
  });

  it("refuse une source incomplète avant de toucher à une ancienne installation complète", () => {
    const root = fixture();
    const source = path.join(root, "archive", "bin");
    payload(source, ["idevice_id.exe", "ideviceinfo.exe"]);
    const destination = path.join(root, "native", "libimobiledevice");
    payload(destination);
    fs.writeFileSync(path.join(destination, "ideviceinfo.exe"), "original");
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "prepare-native.cjs"), source, "--require-complete"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DLL manquantes");
    expect(fs.readFileSync(path.join(destination, "ideviceinfo.exe"), "utf8")).toBe("original");
  });

  it("trouve un paquet imbriqué complet, copie ses licences mais pas les scripts, et peut être relancé", () => {
    const root = fixture();
    const source = path.join(root, "archive é & outils", "bin");
    payload(source, [...required, "native.dll", "LICENSE", "ne-pas-copier.ps1"]);
    const script = path.join(root, "scripts", "prepare-native.cjs");
    const destination = path.join(root, "native", "libimobiledevice");
    const prepare = spawnSync(process.execPath, [script, path.dirname(source), "--require-complete"], { encoding: "utf8" });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(inspectNativeDirectory(destination).complete).toBe(true);
    expect(fs.existsSync(path.join(destination, "LICENSE"))).toBe(true);
    expect(fs.existsSync(path.join(destination, "ne-pas-copier.ps1"))).toBe(false);
    expect(spawnSync(process.execPath, [script, destination, "--require-complete"]).status).toBe(0);
  });

  it("n'accepte pas deux utilitaires quelconques à la place des outils de diagnostic", () => {
    const root = fixture();
    const source = path.join(root, "archive");
    payload(source, ["idevicebackup2.exe", "irecovery.exe", "native.dll"]);
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "prepare-native.cjs"), source], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ideviceinfo.exe et idevice_id.exe");
    expect(fs.existsSync(path.join(root, "native"))).toBe(false);
  });
});
