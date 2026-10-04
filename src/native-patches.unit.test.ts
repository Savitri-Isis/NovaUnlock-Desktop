// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/*
 * The native toolchain is compiled from pinned upstream tags and receives a few
 * local Windows fixes. Those fixes are only trustworthy together: a patch whose
 * name no longer matches the lock file, or that the MSYS2 builder never applies,
 * would silently build a payload from unexpected sources.
 */
const patchesDirectory = path.resolve("scripts", "patches");
const buildScript = fs.readFileSync(path.resolve("scripts", "build-native-msys2.sh"), "utf8");

function lockedVersions(): Map<string, string> {
  const entries = fs
    .readFileSync(path.resolve("scripts", "native-sources.lock"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
  return new Map(entries.map(([project, version]) => [project, version]));
}

function patchNames(): string[] {
  return fs.readdirSync(patchesDirectory).filter((name) => name.endsWith(".patch")).sort();
}

describe("Correctifs locaux des sources natives", () => {
  const versions = lockedVersions();
  const names = patchNames();

  it("nomme chaque correctif avec un projet et une version épinglés", () => {
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const match = /^(?<project>[a-z0-9][a-z0-9-]*)-(?<version>\d+\.\d+\.\d+)-(?<suffix>[a-z0-9-]+)\.patch$/.exec(name);
      expect(match, `nom de correctif inattendu : ${name}`).not.toBeNull();
      const { project, version } = match!.groups as { project: string; version: string };
      expect(versions.get(project), `projet absent de native-sources.lock : ${name}`).toBe(version);
    }
  });

  it("se présente comme un correctif unifié appliqué à l'arbre amont", () => {
    for (const name of names) {
      const body = fs.readFileSync(path.join(patchesDirectory, name), "utf8");
      expect(body.startsWith("--- a/"), `en-tête amont manquant dans ${name}`).toBe(true);
      expect(/^\+\+\+ b\/\S+$/m.test(body), `destination amont manquante dans ${name}`).toBe(true);
      expect(/^@@ /m.test(body), `aucun bloc de modification dans ${name}`).toBe(true);
    }
  });

  it("est réellement appliqué par le constructeur MSYS2", () => {
    const referenced = /^\s*patch_suffixes=\(([^)]*)\)/m.exec(buildScript)?.[1] ?? "";
    const suffixes = referenced.split(/\s+/).filter(Boolean);
    expect(suffixes.length).toBeGreaterThan(0);
    for (const name of names) {
      const suffix = name.replace(/^[a-z0-9][a-z0-9-]*-\d+\.\d+\.\d+-/, "").replace(/\.patch$/, "");
      expect(suffixes, `${name} n'est pas appliqué par build-native-msys2.sh`).toContain(suffix);
    }
  });

  it("applique les correctifs avant autogénération, avec vérification préalable", () => {
    expect(buildScript).toMatch(/git -C "\$source_dir" apply --check "\$source_patch"/);
    expect(buildScript).toMatch(/git -C "\$source_dir" apply "\$source_patch"/);
    expect(buildScript.indexOf("apply --check")).toBeLessThan(buildScript.indexOf("autogen.sh"));
  });

  it("silencie l'avis detached HEAD dans les clones du constructeur", () => {
    // "-c" s'applique au seul clone concerné : la configuration Git de
    // l'utilisateur n'est jamais modifiée par le constructeur.
    expect(buildScript).toContain("git -c advice.detachedHead=false clone");
    expect(buildScript).not.toMatch(/git config .*advice\.detachedHead/);
  });
});
