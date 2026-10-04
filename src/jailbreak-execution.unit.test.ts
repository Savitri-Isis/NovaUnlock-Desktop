import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  describeArtifact,
  formatBytes,
  hasZipMagic,
  validateJailbreakAction,
} from "../electron/src/jailbreak-plan";
import { executeJailbreakAction } from "../electron/src/jailbreak-executor";
import {
  AUTO_PRIORITY,
  buildJailbreakPlan,
  getAutomationSpec,
  isPlanConsistent,
  selectAutoMethod,
  toJailbreakAction,
  type PlanInput,
} from "./lib/jailbreak/execution";
import { analyseCatalogue } from "./lib/jailbreak/compatibility";
import { JAILBREAK_METHODS, getMethod } from "./lib/jailbreak/methods";
import type { JailbreakMethod, MethodEvaluation } from "./lib/jailbreak/types";

function makeZip(filePath: string, payload = "contenu"): string {
  // Conteneur ZIP minimal : signature locale + données arbitraires.
  const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  fs.writeFileSync(filePath, Buffer.concat([header, Buffer.from(payload)]));
  return filePath;
}

function evaluationFor(methodId: string, model: string, ios: string): MethodEvaluation {
  const analysis = analyseCatalogue(
    { modelIdentifier: model, iosVersion: ios, chipOverride: null },
    JAILBREAK_METHODS
  );
  const found = analysis.evaluations.find((item) => item.method.id === methodId);
  if (!found) throw new Error(`méthode absente : ${methodId}`);
  return found;
}

function planInput(overrides: Partial<PlanInput> = {}): PlanInput {
  const evaluation = evaluationFor("dopamine", "iPhone10,3", "16.7.1");
  return {
    method: evaluation.method,
    verdict: evaluation.verdict,
    chip: { id: "A11", label: "A11 Bionic", architecture: "arm64" },
    iosVersion: "16.7.1",
    installReady: true,
    devicePaired: true,
    artifactPath: null,
    ...overrides,
  };
}

describe("Validation d'une action de jailbreak (processus principal)", () => {
  it("accepte une installation IPA avec un chemin absolu .ipa", () => {
    const action = validateJailbreakAction({
      methodId: "dopamine",
      methodName: "Dopamine",
      kind: "install-ipa",
      sourceUrl: "https://ellekit.space/dopamine/",
      artifactPath: path.join(os.tmpdir(), "Dopamine.ipa"),
    });
    expect(action.kind).toBe("install-ipa");
    expect(action.artifactPath).toBe(path.resolve(os.tmpdir(), "Dopamine.ipa"));
  });

  it("refuse une source hors liste blanche", () => {
    expect(() =>
      validateJailbreakAction({
        methodId: "dopamine",
        methodName: "Dopamine",
        kind: "install-ipa",
        sourceUrl: "https://jailbreak-gratuit.example/dopamine.ipa",
        artifactPath: "/tmp/Dopamine.ipa",
      })
    ).toThrow(/liste des sites officiels/i);
  });

  it("refuse un chemin relatif, une extension non IPA et un identifiant douteux", () => {
    const base = {
      methodId: "dopamine",
      methodName: "Dopamine",
      kind: "install-ipa",
      sourceUrl: "https://github.com/opa334/Dopamine",
    };
    expect(() => validateJailbreakAction({ ...base, artifactPath: "Dopamine.ipa" })).toThrow(/absolu/i);
    expect(() => validateJailbreakAction({ ...base, artifactPath: "/tmp/payload.dmg" })).toThrow(/\.ipa/i);
    expect(() => validateJailbreakAction({ ...base, artifactPath: "/tmp/Dopamine.ipa", methodId: "../etc" })).toThrow(
      /Identifiant de méthode invalide/i
    );
  });

  it("refuse une action manuelle sans étape et borne les étapes", () => {
    const base = {
      methodId: "palera1n",
      methodName: "palera1n",
      kind: "manual",
      sourceUrl: "https://palera.in/",
    };
    expect(() => validateJailbreakAction({ ...base, manualSteps: [] })).toThrow(/au moins une étape/i);

    const action = validateJailbreakAction({
      ...base,
      manualSteps: Array.from({ length: 40 }, (_value, index) => `étape ${index} `.repeat(60)),
    });
    expect(action.manualSteps).toHaveLength(12);
    expect((action.manualSteps as string[])[0].length).toBeLessThanOrEqual(300);
  });

  it("refuse un objet vide ou de mauvais type", () => {
    expect(() => validateJailbreakAction(null)).toThrow(/invalide/i);
    expect(() => validateJailbreakAction({})).toThrow(/invalide/i);
    expect(() =>
      validateJailbreakAction({
        methodId: "dopamine",
        methodName: "Dopamine",
        kind: "execute-binaire",
        sourceUrl: "https://github.com/opa334/Dopamine",
      })
    ).toThrow(/Type d'action/i);
  });
});

describe("Inspection de l'artefact IPA", () => {
  it("détecte un conteneur ZIP et calcule l'empreinte SHA-256", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipa-"));
    const filePath = makeZip(path.join(directory, "Dopamine.ipa"), "x".repeat(2048));

    expect(hasZipMagic(filePath)).toBe(true);

    const description = describeArtifact(filePath);
    expect(description.fileName).toBe("Dopamine.ipa");
    expect(description.sizeBytes).toBeGreaterThan(2048);
    expect(description.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(description.looksLikeIpa).toBe(true);
    expect(description.warning).toBeNull();

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("signale un fichier qui n'est pas un conteneur ZIP", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipa-"));
    const filePath = path.join(directory, "faux.ipa");
    fs.writeFileSync(filePath, "ceci n'est pas un ipa");

    const description = describeArtifact(filePath);
    expect(description.looksLikeIpa).toBe(false);
    expect(description.warning).toMatch(/ZIP/i);

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("refuse un fichier vide ou absent", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipa-"));
    const empty = path.join(directory, "vide.ipa");
    fs.writeFileSync(empty, "");
    expect(() => describeArtifact(empty)).toThrow(/vide/i);
    expect(() => describeArtifact(path.join(directory, "absent.ipa"))).toThrow();

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("formate les tailles de façon lisible", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2.0 Ko");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 Mo");
  });
});

describe("Exécuteur : périmètre strict", () => {
  it("n'exécute aucun processus pour une action manuelle", async () => {
    const result = await executeJailbreakAction({
      methodId: "palera1n",
      methodName: "palera1n",
      kind: "manual",
      sourceUrl: "https://palera.in/",
      manualSteps: ["Placez l'appareil en DFU depuis macOS ou Linux."],
    });
    expect(result.success).toBe(true);
    expect(result.kind).toBe("manual");
    expect(result.message).toMatch(/ne peut pas être lancée depuis Windows/i);
  });

  it("refuse un fichier qui n'est pas un IPA avant tout appel natif", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipa-"));
    const filePath = path.join(directory, "faux.ipa");
    fs.writeFileSync(filePath, "pas un zip");

    const result = await executeJailbreakAction({
      methodId: "dopamine",
      methodName: "Dopamine",
      kind: "install-ipa",
      sourceUrl: "https://ellekit.space/dopamine/",
      artifactPath: filePath,
    });
    // Sur un poste sans paquet natif, l'outil est signalé manquant avant toute
    // installation ; dans tous les cas, aucune installation n'est annoncée.
    expect(result.success).toBe(false);
    expect(["Outil manquant", "Fichier refusé"]).toContain(result.stage);

    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe("Exécuteur : chemin d'installation IPA (outil et appareil simulés)", () => {
  function ipaFixture(): { directory: string; filePath: string } {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novaunlock-ipa-"));
    const filePath = makeZip(path.join(directory, "Dopamine.ipa"), "z".repeat(4096));
    return { directory, filePath };
  }

  const actionFor = (filePath: string) => ({
    methodId: "dopamine",
    methodName: "Dopamine",
    kind: "install-ipa" as const,
    sourceUrl: "https://ellekit.space/dopamine/",
    artifactPath: filePath,
  });

  it("appelle ideviceinstaller avec l'UDID et le chemin de l'IPA, puis relaie la progression", async () => {
    const { directory, filePath } = ipaFixture();
    const stages: number[] = [];
    const calls: Array<{ tool: string; args: string[] }> = [];

    const result = await executeJailbreakAction(
      actionFor(filePath),
      (progress) => stages.push(progress.progress),
      {
        resolveInstaller: () => "/chemin/natif/ideviceinstaller.exe",
        getUdid: () => "0000111122223333444455556666777788889999",
        runCommand: async (tool, args, _timeout, onData) => {
          calls.push({ tool, args });
          onData?.("Installing: 42%");
          onData?.("Installing: 100%");
          return { code: 0, output: "Install: Complete" };
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe("/chemin/natif/ideviceinstaller.exe");
    expect(calls[0].args).toEqual([
      "-u",
      "0000111122223333444455556666777788889999",
      "-i",
      filePath,
    ]);
    expect(result.success).toBe(true);
    expect(result.stage).toBe("Installation terminée");
    expect(result.artifact?.fileName).toBe("Dopamine.ipa");
    expect(result.artifact?.sha256).toBe(describeArtifact(filePath).sha256);
    expect(result.message).toMatch(/ouvrez l'application jailbreak/i);
    // La progression reste monotone et se termine à 100 %.
    expect(Math.min(...stages)).toBeGreaterThanOrEqual(0);
    expect(stages[stages.length - 1]).toBe(100);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("remonte l'échec de l'outil sans prétendre avoir installé quoi que ce soit", async () => {
    const { directory, filePath } = ipaFixture();
    const result = await executeJailbreakAction(actionFor(filePath), undefined, {
      resolveInstaller: () => "/chemin/natif/ideviceinstaller.exe",
      getUdid: () => "0000111122223333444455556666777788889999",
      runCommand: async () => ({ code: 1, output: "ERROR: device locked", error: "device locked" }),
    });

    expect(result.success).toBe(false);
    expect(result.stage).toBe("Échec de l'installation");
    expect(result.message).toMatch(/device locked/);
    expect(result.toolOutput).toContain("ERROR: device locked");

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("refuse d'installer si l'appareil n'est pas appairé, même avec l'outil présent", async () => {
    const { directory, filePath } = ipaFixture();
    let ran = false;
    const result = await executeJailbreakAction(actionFor(filePath), undefined, {
      resolveInstaller: () => "/chemin/natif/ideviceinstaller.exe",
      getUdid: () => null,
      runCommand: async () => {
        ran = true;
        return { code: 0, output: "" };
      },
    });

    expect(ran).toBe(false);
    expect(result.success).toBe(false);
    expect(result.stage).toBe("Appareil non appairé");

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("signale l'absence d'ideviceinstaller comme un blocage, pas comme un échec d'appareil", async () => {
    const { directory, filePath } = ipaFixture();
    const result = await executeJailbreakAction(actionFor(filePath), undefined, {
      resolveInstaller: () => null,
      getUdid: () => "0000111122223333444455556666777788889999",
      runCommand: async () => ({ code: 0, output: "" }),
    });

    expect(result.success).toBe(false);
    expect(result.stage).toBe("Outil manquant");
    expect(result.message).toMatch(/même paquet officiel/i);

    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe("Sélection automatique de la méthode adaptée", () => {
  it("retient Dopamine pour un iPhone X sous iOS 16.7.1", () => {
    const analysis = analyseCatalogue(
      { modelIdentifier: "iPhone10,3", iosVersion: "16.7.1", chipOverride: null },
      JAILBREAK_METHODS
    );
    expect(selectAutoMethod(analysis.evaluations)?.method.id).toBe("dopamine");
  });

  it("suit l'ordre de priorité quand plusieurs méthodes sont compatibles", () => {
    expect(AUTO_PRIORITY[0]).toBe("dopamine");
    const fake = (id: string): MethodEvaluation => ({
      method: getMethod(id) as JailbreakMethod,
      verdict: "compatible",
      reasons: [],
      rule: null,
      hostWarnings: [],
    });
    expect(selectAutoMethod([fake("palera1n"), fake("dopamine"), fake("trollstore")])?.method.id).toBe("dopamine");
  });

  it("ne retient rien quand aucune méthode n'est compatible", () => {
    const analysis = analyseCatalogue(
      { modelIdentifier: "iPhone17,3", iosVersion: "26.0", chipOverride: null },
      JAILBREAK_METHODS
    );
    expect(selectAutoMethod(analysis.evaluations)).toBeNull();
  });
});

describe("Plan d'application assistée", () => {
  it("est prêt à appliquer quand l'outil, l'appairage et l'IPA sont réunis", () => {
    const plan = buildJailbreakPlan(planInput({ artifactPath: "/tmp/Dopamine.ipa" }));
    expect(plan.outcome).toBe("pret-a-appliquer");
    expect(plan.kind).toBe("install-ipa");
    expect(plan.blockers).toHaveLength(0);
    expect(isPlanConsistent(plan)).toBe(true);
    expect(plan.steps.join(" ")).toMatch(/SHA-256/);
  });

  it("bloque sans outil, sans appairage ou sans IPA, avec un motif précis", () => {
    const withoutTool = buildJailbreakPlan(planInput({ installReady: false, artifactPath: "/tmp/x.ipa" }));
    expect(withoutTool.outcome).toBe("bloque");
    expect(withoutTool.blockers.join(" ")).toMatch(/ideviceinstaller\.exe/);

    const withoutDevice = buildJailbreakPlan(planInput({ devicePaired: false, artifactPath: "/tmp/x.ipa" }));
    expect(withoutDevice.blockers.join(" ")).toMatch(/appairé/i);

    const withoutArtifact = buildJailbreakPlan(planInput());
    expect(withoutArtifact.blockers.join(" ")).toMatch(/ne télécharge jamais/i);
  });

  it("bloque une méthode non compatible, même si l'outillage est prêt", () => {
    const evaluation = evaluationFor("dopamine", "iPhone13,2", "18.5");
    const plan = buildJailbreakPlan(
      planInput({ method: evaluation.method, verdict: evaluation.verdict, artifactPath: "/tmp/x.ipa" })
    );
    expect(plan.outcome).toBe("bloque");
    expect(plan.blockers.join(" ")).toMatch(/plage affichée/i);
  });

  it("propose les étapes manuelles sans prétendre les exécuter", () => {
    const evaluation = evaluationFor("palera1n", "iPhone10,3", "16.7.1");
    const plan = buildJailbreakPlan(
      planInput({
        method: evaluation.method,
        verdict: evaluation.verdict,
        installReady: false,
        devicePaired: false,
      })
    );
    expect(plan.outcome).toBe("action-manuelle");
    expect(plan.kind).toBe("manual");
    expect(plan.steps.join(" ")).toMatch(/macOS ou Linux/i);
    expect(plan.warnings.join(" ")).toMatch(/macOS ou Linux/i);
    expect(isPlanConsistent(plan)).toBe(true);
  });

  it("marque les entrées d'inventaire comme indisponibles", () => {
    const plan = buildJailbreakPlan(planInput({ method: getMethod("historiques-inventaire") as JailbreakMethod }));
    expect(plan.outcome).toBe("indisponible");
    expect(plan.steps).toHaveLength(0);
  });

  it("convertit un plan en action validable par le processus principal", () => {
    const plan = buildJailbreakPlan(planInput({ artifactPath: path.join(os.tmpdir(), "Dopamine.ipa") }));
    const action = toJailbreakAction(plan);
    expect(() => validateJailbreakAction(action)).not.toThrow();
    expect(action.kind).toBe("install-ipa");
  });

  it("refuse d'annoncer un plan prêt sans artefact (cohérence)", () => {
    const plan = buildJailbreakPlan(planInput({ artifactPath: "/tmp/Dopamine.ipa" }));
    expect(isPlanConsistent({ ...plan, artifactPath: null })).toBe(false);
  });

  it("couvre chaque méthode du catalogue par une capacité explicite", () => {
    for (const method of JAILBREAK_METHODS) {
      const spec = getAutomationSpec(method);
      expect(["installation-ipa", "manuelle", "indisponible"]).toContain(spec.capability);
      if (spec.capability === "installation-ipa") {
        expect(spec.requiredTool).toBe("installer");
      }
    }
  });
});
