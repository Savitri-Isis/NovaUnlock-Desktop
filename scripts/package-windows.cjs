#!/usr/bin/env node
/*
 * First-build assistant. Uses only Node built-ins, so it also works before npm ci.
 * Native tools are user supplied; no third-party executable is downloaded here.
 * No renderer IPC can run this developer-only packaging workflow.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inspectNativeDirectory } = require("./verify-native.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
// Keep in sync with package.json engines (including the locked test dependencies).
function supportedNodeVersion(version) {
  const [major, minor, patch] = version.replace(/^v/, "").split(".").map(Number);
  return (
    (major === 22 && (minor > 22 || (minor === 22 && patch >= 2))) ||
    (major === 24 && minor >= 15) ||
    major >= 26
  );
}

// Static script: paths selected by the user are returned as data, never evaluated.
const FOLDER_PICKER = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$picker = New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description = 'Choisissez le dossier extrait de libimobiledevice Windows x64, provenant d une source de confiance, avec ses DLL et licences.'
$picker.ShowNewFolderButton = $false
try {
  if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write($picker.SelectedPath)
  }
} finally {
  $picker.Dispose()
}
`;

function selectNativeDirectory(exec = spawnSync) {
  const result = exec(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-STA", "-EncodedCommand", Buffer.from(FOLDER_PICKER, "utf16le").toString("base64")],
    { encoding: "utf8", windowsHide: true, shell: false }
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      "Impossible d'ouvrir le sélecteur de dossier Windows. " +
        "Vérifiez que PowerShell est disponible et autorisé sur ce PC. " +
        (result.error?.message || result.stderr?.trim() || "")
    );
  }
  return result.stdout?.trim() || null;
}

function runPackaging({
  root = REPO_ROOT,
  platform = process.platform,
  arch = process.arch,
  nodeVersion = process.versions.node,
  env = process.env,
  exec = spawnSync,
  selectDirectory = () => selectNativeDirectory(exec),
  log = console.log,
} = {}) {
  if (platform !== "win32" || arch !== "x64") {
    throw new Error("Cet assistant nécessite Windows et Node.js x64. Aucun packaging n'a été lancé.");
  }
  if (!supportedNodeVersion(nodeVersion)) {
    throw new Error(
      "Installez une version LTS x64 compatible de Node.js depuis https://nodejs.org " +
        "(22.22.2+ dans la branche 22, ou 24.15.0+ dans la branche 24), puis relancez l'assistant."
    );
  }
  for (const file of ["package.json", "package-lock.json", "scripts/prepare-native.cjs", "scripts/verify-native.cjs"]) {
    if (!fs.existsSync(path.join(root, file))) {
      throw new Error(`Projet incomplet : ${file} est absent. Conservez l'assistant dans le dossier du projet complet.`);
    }
  }

  const options = { cwd: root, env, stdio: "inherit", shell: false };
  const cmd = env.ComSpec || "cmd.exe";
  const node = (script, args = []) => exec(process.execPath, [path.join(root, "scripts", script), ...args], options);
  // All npm commands below are fixed strings. Never interpolate a path or user input
  // into cmd.exe; use node(script, [path]) for the user-selected directory instead.
  const npm = (command) => exec(cmd, ["/d", "/s", "/c", `npm.cmd ${command}`], options);
  const step = (label, run) => {
    log(`\n${label}`);
    const result = run();
    if (result.error || result.status !== 0) {
      throw new Error(`${label} — échec${result.error ? ` : ${result.error.message}` : ` (code ${result.status ?? "interruption"})`}. Consultez les messages ci-dessus. Les étapes suivantes n'ont pas été lancées.`);
    }
  };

  log("NovaUnlock — Création guidée de l'installateur Windows\nGardez cette fenêtre ouverte jusqu'à la fin. Internet est nécessaire pour les dépendances de compilation.");
  step("[1/5] Vérification de npm", () => npm("--version"));

  let source = env.NOVAUNLOCK_NATIVE_DIR?.trim();
  if (!source && !inspectNativeDirectory(path.join(root, "native", "libimobiledevice")).complete) {
    log("\nChoisissez le paquet libimobiledevice Windows x64 déjà extrait. Aucun outil natif n'est téléchargé par cet assistant.");
    source = selectDirectory();
    if (!source) {
      log("\nOpération annulée. Aucune dépendance n'a été installée et aucun packaging n'a été lancé.");
      return { canceled: true };
    }
  }

  if (source) {
    step("[2/5] Préparation des outils natifs", () => node("prepare-native.cjs", [source, "--require-complete"]));
  } else {
    log("\n[2/5] Réutilisation des outils déjà présents dans native/libimobiledevice.");
  }
  step("[3/5] Vérification des fichiers natifs attendus", () => node("verify-native.cjs"));
  step("[4/5] Installation des dépendances verrouillées (npm ci)", () => npm("ci --include=dev"));
  step("[5/5] Compilation et création de l'installateur", () => npm("run package:win"));

  const outputDirectory = path.join(root, "release");
  log(`\nTerminé. Les fichiers générés se trouvent dans :\n${outputDirectory}`);
  // Opening Explorer is a convenience, not a build step: its exit code can be 1
  // even when it successfully opens a folder in an existing Explorer process.
  exec("explorer.exe", [outputDirectory], { cwd: root, env, shell: false });
  return { canceled: false, outputDirectory };
}

if (require.main === module) {
  try {
    runPackaging();
  } catch (error) {
    console.error(`\nAssistant arrêté : ${error.message}\nCorrigez l'erreur, puis relancez Creer-installateur-Windows.cmd.`);
    process.exitCode = 1;
  }
}

module.exports = { runPackaging, selectNativeDirectory, supportedNodeVersion };
