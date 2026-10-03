#!/usr/bin/env node
/*
 * Stage an already-downloaded Windows x64 libimobiledevice payload for electron-builder.
 * The source is user supplied; this script never downloads or commits executables/DLLs.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const destination = path.join(repoRoot, "native", "libimobiledevice");
const sourceArg = process.argv[2] || process.env.NOVAUNLOCK_NATIVE_DIR;
const required = [
  "idevice_id.exe",
  "ideviceinfo.exe",
  "ideviceactivation.exe",
  "idevicebackup2.exe",
  "idevicerestore.exe",
  "irecovery.exe",
];

function usage(message) {
  if (message) console.error(`\nErreur : ${message}`);
  console.error("\nUsage : NOVAUNLOCK_NATIVE_DIR=C:\\chemin\\vers\\payload npm run prepare:native");
  console.error("   ou : npm run prepare:native -- C:\\chemin\\vers\\payload");
  process.exitCode = 1;
}

function directories(root, max = 2000) {
  const pending = [root];
  const found = [];
  while (pending.length && found.length < max) {
    const current = pending.shift();
    found.push(current);
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(path.join(current, entry.name));
    }
  }
  return found;
}

function score(dir) {
  try {
    const names = new Set(fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name.toLowerCase()));
    return required.filter((name) => names.has(name)).length;
  } catch {
    return -1;
  }
}

if (!sourceArg) {
  usage("le dossier source n'a pas été fourni.");
  return;
}

const sourceRoot = path.resolve(sourceArg);
if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
  usage(`dossier source introuvable : ${sourceRoot}`);
  return;
}

let payload = null;
let bestScore = -1;
for (const dir of directories(sourceRoot)) {
  const currentScore = score(dir);
  if (currentScore > bestScore) {
    bestScore = currentScore;
    payload = dir;
  }
}

if (!payload || bestScore < 2) {
  usage("le dossier ne contient pas ideviceinfo.exe et idevice_id.exe.");
  return;
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
