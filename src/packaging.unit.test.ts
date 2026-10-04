// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const { runPackaging, selectNativeDirectory, supportedNodeVersion } = require("../scripts/package-windows.cjs");
const { required, inspectNativeDirectory } = require("../scripts/verify-native.cjs");
const { describeNativeSource } = require("../scripts/prepare-native.cjs");
const roots: string[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-build-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "scripts"));
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.writeFileSync(path.join(root, "package-lock.json"), "{}");
  for (const script of ["prepare-native.cjs", "prepare-native-archive.cjs", "verify-native.cjs"]) {
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

describe("Sources natives Windows", () => {
  it("verrouille les projets amont sur des commits complets et uniques", () => {
    const lockPath = path.resolve("scripts/native-sources.lock");
    const entries = fs
      .readFileSync(lockPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/\s+/));
    const projects = entries.map(([project]) => project);
    const commits = entries.map(([, , commit]) => commit);

    expect(projects).toEqual([
      "libplist",
      "libimobiledevice-glue",
      "libtatsu",
      "libusbmuxd",
      "libimobiledevice",
      "libirecovery",
      "libideviceactivation",
      "idevicerestore",
    ]);
    expect(entries.every((entry) => entry.length === 3)).toBe(true);
    expect(commits.every((commit) => /^[0-9a-f]{40}$/.test(commit))).toBe(true);
    expect(new Set(commits).size).toBe(commits.length);
  });
});

describe("Dossier natif refusé puis corrigé", () => {
  function selection(root: string, wrong: string, correct: string) {
    const config = assistant(root);
    config.selectDirectory.mockReturnValueOnce(wrong).mockReturnValueOnce(correct);
    return config;
  }

  it("explique pourquoi un dossier est refusé, puis demande de nouveau au lieu d'arrêter", () => {
    const root = fixture();
    const wrong = path.join(root, "Téléchargements");
    fs.mkdirSync(wrong);
    fs.writeFileSync(path.join(wrong, "idevicebackup2.exe"), "test fixture, never executed");
    const correct = path.join(root, "paquet extrait", "bin");
    payload(correct);

    const config = selection(root, wrong, correct);
    expect(runPackaging(config)).toEqual({ canceled: false, outputDirectory: path.join(root, "release") });

    const messages = config.log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(config.selectDirectory).toHaveBeenCalledTimes(2);
    expect(messages).toContain("Outils de diagnostic manquants : ideviceinfo.exe et idevice_id.exe");
    expect(messages).toContain("idevicebackup2.exe");
    expect(messages).toContain("essai 2 sur 3");
    const prepare = config.exec.mock.calls.filter((call) => String(call[1][0]).endsWith("prepare-native.cjs"));
    expect(prepare).toHaveLength(1);
    expect(prepare[0][1]).toEqual([path.join(root, "scripts", "prepare-native.cjs"), correct, "--require-complete"]);
  });

  it("extrait localement l'archive détectée dans le dossier choisi, sans jamais l'exécuter", () => {
    const root = fixture();
    const wrong = path.join(root, "Téléchargements");
    const archive = path.join(wrong, "libimobiledevice-win-x64.zip");
    fs.mkdirSync(wrong);
    fs.writeFileSync(archive, "archive factice, jamais ouverte par le test");

    const config = assistant(root);
    config.selectDirectory.mockReturnValue(wrong);
    runPackaging(config);

    const staged = config.exec.mock.calls.find((call) => String(call[1][0]).endsWith("prepare-native-archive.cjs"));
    expect(staged?.[1]).toEqual([path.join(root, "scripts", "prepare-native-archive.cjs"), archive]);
    expect(config.selectDirectory).toHaveBeenCalledTimes(1);
    expect(config.exec.mock.calls.some((call) => call[1][0].endsWith("verify-native.cjs"))).toBe(true);
  });

  it("continue à demander un dossier si l'archive détectée est inutilisable", () => {
    const root = fixture();
    const wrong = path.join(root, "Téléchargements");
    const archive = path.join(wrong, "libimobiledevice-win-x64.zip");
    fs.mkdirSync(wrong);
    fs.writeFileSync(archive, "archive factice");
    const correct = path.join(root, "paquet", "win64");
    payload(correct);

    const config = selection(root, wrong, correct);
    config.exec.mockImplementation((command: string, args: string[] = []) =>
      String(args[0]).endsWith("prepare-native-archive.cjs") ? { status: 1 } : { status: 0, stdout: "", stderr: "" }
    );

    expect(runPackaging(config)).toEqual({ canceled: false, outputDirectory: path.join(root, "release") });
    expect(config.selectDirectory).toHaveBeenCalledTimes(2);
  });

  it("s'arrête clairement après trois dossiers inutilisables, sans npm ci ni Explorer", () => {
    const root = fixture();
    const empty = path.join(root, "vide");
    fs.mkdirSync(empty);
    const config = assistant(root);
    config.selectDirectory.mockReturnValue(empty);

    expect(() => runPackaging(config)).toThrow(/3 essais/);
    expect(config.selectDirectory).toHaveBeenCalledTimes(3);
    expect(config.exec).toHaveBeenCalledTimes(1); // npm --version only
    expect(config.exec.mock.calls.some((call) => call[0] === "explorer.exe")).toBe(false);
  });

  it("annule sans rien installer si le sélecteur est fermé pendant une nouvelle tentative", () => {
    const root = fixture();
    const empty = path.join(root, "vide");
    fs.mkdirSync(empty);
    const config = assistant(root);
    config.selectDirectory.mockReturnValueOnce(empty).mockReturnValueOnce(null);

    expect(runPackaging(config)).toEqual({ canceled: true });
    expect(config.exec).toHaveBeenCalledTimes(1);
  });
});

describe("Diagnostic du dossier natif choisi", () => {
  it("accepte un paquet complet, y compris imbriqué", () => {
    const root = fixture();
    const source = path.join(root, "archive", "libimobiledevice", "bin");
    payload(source);
    const report = describeNativeSource(path.dirname(path.dirname(source)));
    expect(report.kind).toBe("usable");
    expect(report.complete).toBe(true);
    expect(report.payload).toBe(source);
  });

  it("signale l'archive ZIP non extraite et interdit l'extraction d'un fichier choisi par erreur", () => {
    const root = fixture();
    const archive = path.join(root, "libimobiledevice-win-x64.zip");
    fs.writeFileSync(archive, "archive factice");
    const zipped = describeNativeSource(root);
    expect(zipped.kind).toBe("unusable");
    expect(zipped.archive).toBe(archive);
    expect(zipped.message).toContain("libimobiledevice-win-x64.zip");

    const file = describeNativeSource(archive);
    expect(file.kind).toBe("unknown");
    expect(file.message).toContain("Extrayez-la");
  });

  it("distingue un dossier introuvable d'un dossier sans paquet", () => {
    const root = fixture();
    const missing = describeNativeSource(path.join(root, "absent"));
    expect(missing.kind).toBe("unknown");
    expect(missing.message).toContain("Dossier introuvable");

    const empty = path.join(root, "vide");
    fs.mkdirSync(empty);
    const report = describeNativeSource(empty);
    expect(report.kind).toBe("unusable");
    expect(report.payload).toBeNull();
    expect(report.message).toContain("Aucun fichier .exe n'a été trouvé");
  });

  it("décrit un paquet incomplet sans DLL au lieu de copier des binaires inutilisables", () => {
    const root = fixture();
    const source = path.join(root, "paquet", "bin");
    payload(source, [...required]);
    const report = describeNativeSource(source);
    expect(report.complete).toBe(false);
    expect(report.payload).toBe(source);
    expect(report.message).toContain("Aucune DLL à côté de ces exécutables");
  });
});
