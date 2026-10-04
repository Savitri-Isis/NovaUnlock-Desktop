// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/*
 * L'installateur Windows peut aussi être construit par GitHub Actions
 * (.github/workflows/build.yml), sans PC Windows. Ce workflow est donc une seconde
 * chaîne de livraison : il doit offrir les mêmes garanties que la chaîne locale
 * décrite dans README.md.
 *
 * Les vérifications ci-dessous portent sur le fichier versionné lui-même : outils
 * natifs compilés par le script du dépôt depuis les sources épinglées, aucun binaire
 * tiers téléchargé, cibles x64, et publication limitée à une étiquette de version.
 */
const { supportedNodeVersion } = require("../scripts/package-windows.cjs");

// Un checkout Windows (core.autocrlf=true) matérialise ces fichiers texte en CRLF.
// Plusieurs motifs ci-dessous contiennent des retours à la ligne littéraux : sans
// cette normalisation, ils échouent sur un runner Windows alors que le dépôt est
// inchangé. La lecture passe donc partout par le même point.
function readNormalized(...segments: string[]): string {
  return fs.readFileSync(path.resolve(...segments), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readNormalized(".github", "workflows", "build.yml");
const nativeBuilder = readNormalized("scripts", "build-native-msys2.sh");
const annotationPublisher = readNormalized("scripts", "publish-failure-annotation.sh");
const manifest = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
  version: string;
  engines: { node: string };
};

/** Bloc YAML d'un travail : de son nom jusqu'à la prochaine clé de premier niveau. */
function jobBlock(name: string): string {
  const lines = workflow.split(/\r?\n/);
  const start = lines.indexOf(`  ${name}:`);
  expect(start, `travail absent de .github/workflows/build.yml : ${name}`).toBeGreaterThan(-1);
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {0,2}\S/.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

/** Version la plus basse citée dans une plage semver (« >=22.22.2 <23 » → 22.22.2). */
function minimumVersion(range: string): string {
  const found = [...range.matchAll(/(\d+)\.(\d+)\.(\d+)/g)].map((match) => match.slice(1).map(Number));
  expect(found.length, `plage de versions illisible : ${range}`).toBeGreaterThan(0);
  const comparison = (a: number[], b: number[]) =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return found.reduce((lowest, candidate) => (comparison(candidate, lowest) < 0 ? candidate : lowest)).join(".");
}

function jobNames(): string[] {
  return workflow
    .slice(workflow.indexOf("\njobs:"))
    .split(/\r?\n/)
    .map((line) => /^ {2}([a-z][a-z0-9-]*):$/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name));
}

describe("Chaîne de construction GitHub Actions", () => {
  it("expose les trois travaux attendus et permet un lancement manuel", () => {
    expect(jobNames()).toEqual(["verifier", "outils-natifs", "installateur"]);
    expect(jobBlock("verifier")).toMatch(/runs-on: ubuntu-latest/);
    expect(jobBlock("outils-natifs")).toMatch(/runs-on: windows-latest/);
    expect(jobBlock("installateur")).toMatch(/runs-on: windows-latest/);
  });

  it("se déclenche sur main, sur une étiquette v*, sur demande et pour les demandes de fusion", () => {
    const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
    expect(triggers).toMatch(/^on:$/m);
    expect(triggers).toMatch(/^ {2}workflow_dispatch:$/m);
    expect(triggers).toMatch(/^ {2}pull_request:$/m);
    expect(triggers).toMatch(/^ {4}branches: \[main\]$/m);
    expect(triggers).toMatch(/^ {4}tags: \["v\*"\]$/m);
  });

  it("épingle chaque action à une version et ne suit jamais une branche mobile", () => {
    const references = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThanOrEqual(5);
    for (const reference of references) {
      expect(reference, `action non épinglée : ${reference}`).toMatch(
        /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+@v\d+(\.\d+\.\d+)?$/
      );
    }
    expect(references).toContain("actions/checkout@v7");
    expect(references).toContain("actions/setup-node@v7");
    expect(references).toContain("msys2/setup-msys2@v2");
  });

  it("n'installe et n'exécute aucun binaire tiers téléchargé par le workflow", () => {
    expect(workflow).not.toMatch(/\b(curl|wget|winget|choco|scoop)\b/i);
    expect(workflow).not.toMatch(/\b(iwr|Invoke-WebRequest|Start-BitsTransfer|bitsadmin|DownloadFile|Expand-Archive)\b/i);
    // Les seules sources de code sont le dépôt et les actions épinglées ci-dessus.
    expect(workflow).not.toMatch(/\bgit clone\b/);
  });

  it("compile les outils natifs avec le script versionné, jamais avec une liste parallèle", () => {
    const native = jobBlock("outils-natifs");
    expect(native).toMatch(/shell: "msys2 \{0\}"/);
    expect(native).toContain("bash scripts/build-native-msys2.sh");
    expect(native).toMatch(/msystem: UCRT64/);
    // La liste des paquets MSYS2 vit dans le script : les chaînes locale et CI
    // compilent donc avec exactement le même outillage.
    expect(native).not.toMatch(/^\s*install:/m);
    expect(native).toMatch(/update: true/);
  });

  it("rend la compilation CI non interactive sans changer l'usage local", () => {
    const native = jobBlock("outils-natifs");
    expect(native).toMatch(/NOVAUNLOCK_PACMAN_NOCONFIRM: "1"/);
    expect(nativeBuilder).toMatch(/\$\{CI:-\}/);
    expect(nativeBuilder).toMatch(/\$\{NOVAUNLOCK_PACMAN_NOCONFIRM:-\}/);
    // Par défaut pacman reste confirmé à la main : seul le drapeau conditionnel
    // ajoute --noconfirm pour un runner qui ne peut pas répondre.
    expect(nativeBuilder).toMatch(/pacman_flags=\(--needed\)/);
    expect(nativeBuilder).toMatch(/pacman_flags\+=\(--noconfirm\)/);
  });

  it("réutilise un payload compilé sans jamais mélanger deux versions épinglées", () => {
    const native = jobBlock("outils-natifs");
    // La clé de cache contient l'empreinte des sources épinglées et des correctifs :
    // toute modification de l'un ou de l'autre force une recompilation complète.
    expect(native).toMatch(/actions\/cache@v6/);
    expect(native).toMatch(
      /key: novaunlock-native-win-x64-\$\{\{ hashFiles\('scripts\/native-sources\.lock', 'scripts\/patches\/\*\.patch'\) \}\}/
    );
    // Aucune clé de repli : un cache approximatif ne doit jamais fournir des
    // binaires compilés depuis d'autres sources.
    expect(native).not.toMatch(/^\s*restore-keys:/m);
    // Seules la préparation de MSYS2 et la compilation dépendent du cache ; la
    // vérification du payload, elle, s'exécute aussi après une restauration.
    expect(native).toMatch(/if: steps\.cache-native\.outputs\.cache-hit != 'true'/);
    expect(native).toMatch(/node scripts\/verify-native\.cjs/);
  });

  it("réserve la compilation native aux envois, sauf demande de fusion étiquetée", () => {
    const native = jobBlock("outils-natifs");
    // Par défaut une demande de fusion ne compile pas ; l'étiquette explicite
    // « construction-native » est le seul levier qui l'autorise, pour reproduire un
    // échec de compilation sans fusionner d'abord sur main.
    expect(native).toMatch(
      /if: github\.event_name != 'pull_request' \|\| contains\(github\.event\.pull_request\.labels\.\*\.name, 'construction-native'\)/
    );
    expect(jobBlock("installateur")).toMatch(/needs: outils-natifs/);
  });

  it("conserve la sortie complète de la compilation et la rend lisible sur échec", () => {
    const native = jobBlock("outils-natifs");
    // Le script n'écrit des .log qu'à partir du premier autogen.sh : sans cette
    // capture, un échec antérieur (paquetage MSYS2, clonage) ne laisse aucune trace.
    expect(native).toMatch(/set -o pipefail/);
    expect(native).toMatch(
      /bash scripts\/build-native-msys2\.sh 2>&1 \| tee \.native-build\/compilation-native\.log/
    );
    // Les annotations sont exposées par l'API check-runs, contrairement aux journaux
    // bruts et aux artefacts : l'échec doit y être publié, et l'artefact ne doit
    // plus « ignorer » silencieusement un dossier vide.
    expect(native).toMatch(/publish-failure-annotation\.sh/);
    expect(native).toMatch(/if-no-files-found: warn/);
    expect(native).not.toMatch(/if-no-files-found: ignore/);
    expect(native).toMatch(/\.native-build\/logs\n\s*\.native-build\/compilation-native\.log/);
    // Un make parallèle noie l'erreur sous les avertissements des fichiers compilés
    // ensuite : elle doit être extraite du journal complet, et non de sa seule fin.
    expect(annotationPublisher).toMatch(/grep -nE "\$pattern" "\$log"/);
    expect(nativeBuilder).toMatch(/show_log_failure "\$build_log"/);
    expect(nativeBuilder).not.toMatch(/tail -n 80/);
  });

  it("conserve la sortie des tests Windows pour diagnostiquer un échec", () => {
    // Ces tests passent sur ubuntu et en local ; un échec uniquement Windows ne
    // se lit ni dans les journaux bruts ni dans les artefacts.
    const installer = jobBlock("installateur");
    expect(installer).toMatch(/npm test 2>&1 \| tee tests-windows\.log/);
    expect(installer).toMatch(/publish-failure-annotation\.sh/);
  });

  it("transmet le payload natif vérifié entre les deux travaux Windows", () => {
    const native = jobBlock("outils-natifs");
    const installer = jobBlock("installateur");
    expect(native).toMatch(/path: native\/libimobiledevice/);
    expect(installer).toMatch(/path: native\/libimobiledevice/);
    expect(native).toContain("node scripts/verify-native.cjs");
    expect(installer).toContain("node scripts/verify-native.cjs");
    expect(native).toMatch(/if-no-files-found: error/);
  });

  it("construit les .exe avec les commandes du dépôt, sans publication implicite", () => {
    const installer = jobBlock("installateur");
    expect(installer).toContain("npm ci --include=dev");
    expect(installer).toContain("npm run package:win");
    // electron-builder ne doit jamais publier de lui-même : la Release est créée
    // par l'étape explicite, après contrôle de l'étiquette.
    expect(installer).toContain("--publish never");
    expect(installer).toContain("CSC_IDENTITY_AUTO_DISCOVERY");
  });

  it("livre les .exe et leurs empreintes comme artefacts de l'exécution", () => {
    const installer = jobBlock("installateur");
    expect(installer).toMatch(/actions\/upload-artifact@v7/);
    expect(installer).toMatch(/path: \|\n\s+release\/\*\.exe\n\s+release\/SHA256SUMS\.txt/);
    expect(installer).toMatch(/sha256sum/);
  });

  it("ne publie une Release que pour une étiquette identique à la version du projet", () => {
    const installer = jobBlock("installateur");
    expect(installer).toMatch(/if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
    expect(installer).toContain("require('./package.json').version");
    expect(installer).toMatch(/gh release (create|upload)/);
    expect(installer).toMatch(/contents: write/);
    // Le workflow entier reste en lecture seule : seul ce travail écrit.
    expect(workflow.slice(0, workflow.indexOf("jobs:"))).toMatch(/permissions:\n {2}contents: read/);
  });

  it("utilise des outils x64 et une version de Node acceptée par l'assistant local", () => {
    const nodeRange = /NODE_VERSION: "([^"]+)"/.exec(workflow)?.[1];
    expect(nodeRange, "NODE_VERSION absent du workflow").toBeTruthy();
    expect(supportedNodeVersion(minimumVersion(nodeRange!))).toBe(true);
    expect(minimumVersion(nodeRange!)).toBe(minimumVersion(manifest.engines.node));

    const setupSteps = workflow.match(/uses: actions\/setup-node@v7\n(?:.*\n)*?(?=\n)/g) ?? [];
    expect(setupSteps.length).toBeGreaterThanOrEqual(2);
    for (const step of setupSteps) expect(step).toMatch(/architecture: x64/);
    for (const step of setupSteps) expect(step).toMatch(/check-latest: true/);
  });

});
