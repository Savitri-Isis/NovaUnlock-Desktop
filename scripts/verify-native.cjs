#!/usr/bin/env node
/* Fail early instead of producing an installer whose USB backend cannot start. */
const fs = require("fs");
const path = require("path");

const directory = path.resolve(__dirname, "..", "native", "libimobiledevice");
const required = [
  "idevice_id.exe",
  "ideviceinfo.exe",
  "ideviceactivation.exe",
  "idevicebackup2.exe",
  "idevicerestore.exe",
  "irecovery.exe",
];

const missing = required.filter((file) => !fs.existsSync(path.join(directory, file)));
let dlls = [];
try {
  dlls = fs.readdirSync(directory).filter((file) => file.toLowerCase().endsWith(".dll"));
} catch {
  // The missing payload error below is clearer than an ENOENT stack trace.
}

if (missing.length || dlls.length === 0) {
  console.error("\nLe paquet Windows libimobiledevice est incomplet : l'installateur ne sera pas généré.");
  console.error(`Dossier attendu : ${directory}`);
  if (missing.length) console.error(`Exécutables manquants : ${missing.join(", ")}`);
  if (dlls.length === 0) console.error("DLL manquantes : copiez le paquet Windows x64 complet, pas uniquement les .exe.");
  console.error("\nÉtapes :");
  console.error("  1. Téléchargez et extrayez une distribution Windows x64 officielle de libimobiledevice.");
  console.error("  2. Lancez : NOVAUNLOCK_NATIVE_DIR=<dossier-extrait> npm run prepare:native");
  console.error("  3. Relancez la commande de packaging.");
  process.exit(1);
}

console.log(`libimobiledevice vérifié : ${required.length} exécutables et ${dlls.length} DLL(s) seront inclus dans l'installateur.`);
