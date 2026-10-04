#!/usr/bin/env node
/*
 * Stage an already-downloaded Windows x64 libimobiledevice payload for electron-builder.
 * The source is user supplied; this script never downloads or commits executables/DLLs.
 *
 * A rejected source is explained instead of only rejected: users who pick the wrong
 * folder (the package is still a .zip, only the .exe files were copied, the project
 * folder itself was chosen, ...) must be able to correct the choice from the message.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const destination = path.join(repoRoot, "native", "libimobiledevice");
const { required, inspectNativeDirectory, verifyNative } = require("./verify-native.cjs");

// An extracted package is shallow. The bound only protects against huge user folders
// such as a home directory that was selected instead of the extracted package.
const MAX_SCANNED_DIRECTORIES = 2000;
// Only plausibly named archives are reported or offered for extraction, never any .zip.
const PAYLOAD_ARCHIVE_NAME = /(libimobiledevice|idevice|irecovery|imobiledevice|ios|iphone|ipad|apple)/i;
const PREFERRED_ARCHIVE_NAME = /(libimobiledevice|idevice|irecovery|imobiledevice)/i;
// NovaUnlock cannot list a device without these two tools, so they define a usable payload.
const DIAGNOSTIC_TOOLS = ["idevice_id.exe", "ideviceinfo.exe"];
const PICK_HINT =
  "Choisissez le dossier qui contient les fichiers .exe et .dll extraits (souvent un sous-dossier nommé bin ou win64).";

const USAGE_LINES = [
  '\nUsage : npm run prepare:native -- "C:\\chemin\\vers\\payload"',
  "   ou : double-cliquez sur Creer-installateur-Windows.cmd",
];

function printUsage() {
  for (const line of USAGE_LINES) console.error(line);
}

/**
 * Walk the selected folder once and remember what it contains. Nothing is executed.
 * Archives are collected to explain the common "the package is still a .zip" mistake.
 */
function scanSource(root) {
  const pending = [root];
  const directories = [];
  const archives = [];
  const exeNames = new Set();
  const dllDirectories = new Set();
  let exeCount = 0;
  let dllCount = 0;

  while (pending.length && directories.length < MAX_SCANNED_DIRECTORIES) {
    const current = pending.shift();
    directories.push(current);
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    let hasDll = false;
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        pending.push(path.join(current, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const name = entry.name.toLowerCase();
      if (name.endsWith(".exe")) {
        exeCount += 1;
        exeNames.add(name);
      } else if (name.endsWith(".dll")) {
        dllCount += 1;
        hasDll = true;
      } else if (name.endsWith(".zip") && PAYLOAD_ARCHIVE_NAME.test(entry.name)) {
        archives.push(path.join(current, entry.name));
      }
    }
    if (hasDll) dllDirectories.add(current);
  }

  return { directories, archives, exeNames, exeCount, dllCount, dllDirectories, limited: directories.length >= MAX_SCANNED_DIRECTORIES };
}

/** Score a directory the same way the staging and the app-side import do. */
function payloadScore(directory) {
  try {
    const names = new Set(
      fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
        .map((entry) => entry.name.toLowerCase())
    );
    // Two arbitrary utilities are not a usable diagnostic payload.
    if (!DIAGNOSTIC_TOOLS.every((tool) => names.has(tool))) return -1;
    const dllBonus = [...names].some((name) => name.endsWith(".dll")) ? 0.5 : 0;
    return required.filter((name) => names.has(name)).length + dllBonus;
  } catch {
    return -1;
  }
}

function foundExcerpt(names, limit = 4) {
  const list = [...names].sort();
  return list.length > limit ? `${list.slice(0, limit).join(", ")}…` : list.join(", ");
}

function inspectedSummary(report) {
  const parts = [`${report.scanned} sous-dossier(s)`, `${report.exeCount} fichier(s) .exe`, `${report.dllCount} fichier(s) .dll`];
  return `${report.source} — ${parts.join(", ")}${report.limited ? " (exploration limitée)" : ""}`;
}

/**
 * Explain why a user-selected path can or cannot be staged, without copying anything.
 * Shared by the command line error and by the guided assistant, so both stay in sync.
 */
function describeNativeSource(sourceArg) {
  const source = path.resolve(String(sourceArg));
  const report = {
    source,
    // "usable" (complete payload found), "unusable" (folders were inspected),
    // "unknown" (missing path, file, or unreadable selection).
    kind: "unknown",
    complete: false,
    payload: null,
    missing: [...required],
    dlls: [],
    archive: null,
    archives: [],
    scanned: 0,
    exeCount: 0,
    dllCount: 0,
    limited: false,
    message: "",
  };

  let stats = null;
  try {
    stats = fs.statSync(source);
  } catch {
    report.message = `Dossier introuvable : ${source}\n${PICK_HINT}`;
    return report;
  }

  if (!stats.isDirectory()) {
    report.message = source.toLowerCase().endsWith(".zip")
      ? `Vous avez choisi une archive ZIP, pas son contenu extrait : ${source}\n` +
        "Extrayez-la (clic droit → « Extraire tout… ») puis choisissez le dossier extrait, ou préparez-la directement :\n" +
        `  npm run prepare:native:archive -- "${source}"`
      : `Vous avez choisi un fichier, pas un dossier : ${source}\n${PICK_HINT}`;
    return report;
  }

  const scan = scanSource(source);
  report.scanned = scan.directories.length;
  report.archives = scan.archives;
  const rootArchives = scan.archives.filter((archive) => path.dirname(archive) === source);
  report.archive =
    rootArchives.find((archive) => PREFERRED_ARCHIVE_NAME.test(path.basename(archive))) || rootArchives[0] || null;
  report.exeCount = scan.exeCount;
  report.dllCount = scan.dllCount;
  report.limited = scan.limited;

  let payload = null;
  let bestScore = -1;
  for (const directory of scan.directories) {
    const currentScore = payloadScore(directory);
    if (currentScore > bestScore) {
      bestScore = currentScore;
      payload = directory;
    }
  }

  const lines = [];
  const archiveHint = () => {
    const hinted = report.archives.filter((archive) => archive !== report.archive);
    if (report.archive) lines.push(`Archive ZIP présente dans ce dossier : ${report.archive}`);
    if (hinted.length) lines.push(`Autre(s) archive(s) ZIP détectée(s) : ${hinted.slice(0, 3).join(", ")}`);
  };
  const projectHint = () => {
    if (source === repoRoot || source === destination) {
      lines.push("Ce dossier est celui du projet NovaUnlock (dossier de destination des outils), pas le paquet à extraire.");
    }
  };

  if (!payload) {
    // Nothing usable anywhere: name the missing tools users search for, then what was seen.
    report.kind = "unusable";
    lines.push("Le dossier choisi ne contient pas les fichiers extraits d'un paquet libimobiledevice Windows x64.");
    lines.push(`Dossier examiné : ${inspectedSummary(report)}`);
    lines.push(`Outils de diagnostic manquants : ideviceinfo.exe et idevice_id.exe.`);
    if (scan.exeNames.size) {
      lines.push(`Extrait des exécutables trouvés : ${foundExcerpt(scan.exeNames)}.`);
    } else {
      lines.push("Aucun fichier .exe n'a été trouvé : le dossier ne contient pas de paquet extrait.");
    }
    archiveHint();
    projectHint();
    lines.push(PICK_HINT);
    report.message = lines.join("\n");
    return report;
  }

  const status = inspectNativeDirectory(payload);
  report.payload = payload;
  report.missing = status.missing;
  report.dlls = status.dlls;
  report.complete = status.complete;

  if (status.complete) {
    report.kind = "usable";
    report.message = `Paquet complet détecté : ${payload}`;
    return report;
  }

  // A payload folder exists but cannot be used as is: say exactly what is missing.
  report.kind = "unusable";
  lines.push("Un dossier ressemble à un paquet libimobiledevice, mais il est incomplet.");
  lines.push(`Dossier examiné : ${inspectedSummary(report)}`);
  lines.push(`Dossier candidat : ${payload}`);
  if (status.missing.length) lines.push(`Exécutables manquants : ${status.missing.join(", ")}.`);
  if (!status.dlls.length) {
    lines.push("Aucune DLL à côté de ces exécutables : un paquet complet inclut les DLL d'exécution avec les .exe.");
    const dllDirectories = [...scan.dllDirectories].filter((directory) => directory !== payload).slice(0, 3);
    if (dllDirectories.length) {
      lines.push(`Des DLL se trouvent ailleurs : ${dllDirectories.join(", ")} — copiez-les dans le dossier des .exe, puis réessayez.`);
    }
  }
  archiveHint();
  projectHint();
  lines.push(PICK_HINT);
  report.message = lines.join("\n");
  return report;
}

function stage(payload, { requireComplete = false } = {}) {
  // The guided build validates the SOURCE before touching the current payload.
  // Otherwise stale destination files could hide an incomplete replacement archive.
  if (requireComplete && !verifyNative(payload)) {
    return 1;
  }

  if (path.resolve(payload) === path.resolve(destination)) {
    return verifyNative(destination) ? 0 : 1;
  }

  fs.mkdirSync(destination, { recursive: true });
  const copied = [];
  for (const entry of fs.readdirSync(payload, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) continue;
    const allowed = /\.(exe|dll)$/i.test(entry.name) || /^(copying|license|licenses?|notice|readme)(\.[a-z0-9_-]+)?$/i.test(entry.name);
    if (!allowed) continue;
    fs.copyFileSync(path.join(payload, entry.name), path.join(destination, path.basename(entry.name)));
    copied.push(entry.name);
  }

  const missing = required.filter((name) => !fs.existsSync(path.join(destination, name)));
  const dlls = copied.filter((name) => name.toLowerCase().endsWith(".dll"));
  console.log(`Payload source : ${payload}`);
  console.log(`${copied.length} fichier(s) copié(s) dans ${destination}`);
  if (missing.length) {
    console.warn(`Attention — fonctionnalités indisponibles, binaires manquants : ${missing.join(", ")}`);
  }
  if (!dlls.length && !fs.readdirSync(destination).some((name) => name.toLowerCase().endsWith(".dll"))) {
    console.warn("Attention — aucune DLL n'a été trouvée. Le paquet Windows x64 est probablement incomplet.");
  }
  return 0;
}

function main(argv = process.argv.slice(2), environment = process.env) {
  const sourceArg = argv[0] || environment.NOVAUNLOCK_NATIVE_DIR;
  if (!sourceArg) {
    console.error("\nErreur : le dossier source n'a pas été fourni.");
    printUsage();
    return 1;
  }

  const sourceRoot = path.resolve(sourceArg);
  const report = describeNativeSource(sourceRoot);
  if (report.kind === "unknown") {
    console.error(`\n${report.message}`);
    printUsage();
    return 1;
  }
  if (!report.payload) {
    console.error("\nErreur : le dossier choisi ne contient pas les outils de diagnostic extraits.");
    console.error(report.message);
    printUsage();
    return 1;
  }
  // Explain an incomplete candidate before copying anything, so the folder can be fixed
  // instead of staging a payload whose missing DLLs only surface later.
  if (!report.complete) console.error(`\n${report.message}`);
  return stage(report.payload, { requireComplete: argv.includes("--require-complete") });
}

if (require.main === module) process.exitCode = main();

module.exports = { describeNativeSource, scanSource, payloadScore, main, MAX_SCANNED_DIRECTORIES };
