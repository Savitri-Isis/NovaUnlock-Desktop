#!/usr/bin/env node
/* Fail early instead of producing an installer whose USB backend cannot start. */
const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(__dirname, "..", "native", "libimobiledevice");
const required = Object.freeze([
  "idevice_id.exe",
  "ideviceinfo.exe",
  "ideviceactivation.exe",
  "idevicebackup2.exe",
  "idevicerestore.exe",
  "irecovery.exe",
]);

/** Presence check only: it does not certify architecture, authenticity or DLL compatibility. */
function inspectNativeDirectory(location) {
  let files = [];
  try {
    files = fs.readdirSync(location, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => entry.name.toLowerCase());
  } catch {
    // The missing payload error below is clearer than an ENOENT stack trace.
  }
  const missing = required.filter((file) => !files.includes(file));
  const dlls = files.filter((file) => file.endsWith(".dll"));
  return { missing, dlls, complete: missing.length === 0 && dlls.length > 0 };
}

function verifyNative(location = directory) {
  const { missing, dlls, complete } = inspectNativeDirectory(location);
  if (!complete) {
    console.error("\nLe paquet Windows libimobiledevice est incomplet : l'installateur ne sera pas généré.");
    console.error(`Dossier vérifié : ${location}`);
    if (missing.length) console.error(`Exécutables manquants : ${missing.join(", ")}`);
    if (dlls.length === 0) console.error("DLL manquantes : copiez le paquet Windows x64 complet, pas uniquement les .exe.");
    console.error("\nDouble-cliquez sur Creer-installateur-Windows.cmd pour sélectionner un paquet extrait de confiance.");
    console.error('Ou utilisez : npm run prepare:native -- "C:\\chemin\\vers\\dossier-extrait"');
    return false;
  }
  console.log(`libimobiledevice vérifié : ${required.length} exécutables et ${dlls.length} DLL(s) seront inclus dans l'installateur.`);
  return true;
}

if (require.main === module) process.exitCode = verifyNative() ? 0 : 1;

module.exports = { required, inspectNativeDirectory, verifyNative };
