#!/usr/bin/env node
/*
 * Stage a user-supplied Windows x64 libimobiledevice ZIP.
 * The archive is never downloaded, executed, committed, or trusted implicitly.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnFile } = require("./spawn-native.cjs");

const repoRoot = path.resolve(__dirname, "..");
const archiveArg = process.argv[2];
const destination = path.join(repoRoot, "native", "libimobiledevice");
const required = [
  "idevice_id.exe",
  "ideviceinfo.exe",
  "ideviceactivation.exe",
  "idevicebackup2.exe",
  "idevicerestore.exe",
  "irecovery.exe",
];

function fail(message) {
  console.error(`\nErreur : ${message}`);
  console.error('\nUsage : npm run prepare:native:archive -- "C:\\chemin\\libimobiledevice-win-x64.zip"');
  process.exitCode = 1;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function findPayload(root) {
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    const names = new Set(fs.readdirSync(current, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name.toLowerCase()));
    if (required.every((name) => names.has(name)) && [...names].some((name) => name.endsWith(".dll"))) return current;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) queue.push(path.join(current, entry.name));
    }
  }
  return null;
}

function copyPayload(payload) {
  const files = fs.readdirSync(payload, { withFileTypes: true });
  const selected = files.filter((entry) => entry.isFile() && !entry.isSymbolicLink() && (/\.(exe|dll)$/i.test(entry.name) || /^(copying|license|licenses?|notice|readme)(\.[a-z0-9_-]+)?$/i.test(entry.name)));
  const missing = required.filter((name) => !selected.some((entry) => entry.name.toLowerCase() === name));
  const dlls = selected.filter((entry) => entry.name.toLowerCase().endsWith(".dll"));
  if (missing.length || dlls.length === 0) throw new Error(`Archive incomplète. Exécutables manquants : ${missing.join(", ") || "aucun"}. DLL présentes : ${dlls.length}.`);

  fs.mkdirSync(destination, { recursive: true });
  for (const entry of selected) fs.copyFileSync(path.join(payload, entry.name), path.join(destination, path.basename(entry.name)));

  const manifest = {
    format: 1,
    generatedAt: new Date().toISOString(),
    sourceArchive: path.basename(archiveArg),
    sourceArchiveSha256: sha256(archiveArg),
    note: "Présence et empreintes locales vérifiées ; authenticité, architecture et licence doivent être validées par l’utilisateur.",
    files: selected.map((entry) => ({ name: entry.name, sha256: sha256(path.join(destination, entry.name)) })),
  };
  fs.writeFileSync(path.join(destination, "NOVAUNLOCK-NATIVE-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Archive préparée : ${archiveArg}`);
  console.log(`Payload copié dans : ${destination}`);
  console.log(`Manifeste SHA-256 : ${path.join(destination, "NOVAUNLOCK-NATIVE-MANIFEST.json")}`);
}

async function main() {
  if (!archiveArg) return fail("aucune archive ZIP n’a été fournie.");
  const archive = path.resolve(archiveArg);
  if (!fs.existsSync(archive) || !fs.statSync(archive).isFile() || !archive.toLowerCase().endsWith(".zip")) return fail("l’archive doit être un fichier .zip existant.");

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-native-"));
  try {
    const result = await spawnFile(process.platform === "win32" ? "powershell.exe" : "unzip", process.platform === "win32"
      ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "& { Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force }", archive, temporary]
      : ["-q", archive, "-d", temporary]);
    if (result.code !== 0) throw new Error(`extraction impossible : ${result.error || result.output || `code ${result.code}`}`);
    const payload = findPayload(temporary);
    if (!payload) throw new Error("aucun dossier contenant les six exécutables requis et au moins une DLL n’a été trouvé.");
    copyPayload(payload);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\nÉchec : ${error.message}`);
  process.exitCode = 1;
});
