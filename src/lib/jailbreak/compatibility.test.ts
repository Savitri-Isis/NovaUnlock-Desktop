import { describe, expect, it } from "vitest";
import {
  analyseCatalogue,
  compareIosVersionStrings,
  parseIosVersion,
  sortEvaluations,
} from "./compatibility";
import { JAILBREAK_METHODS, getMethod } from "./methods";
import type { MethodEvaluation } from "./types";

function evaluate(modelIdentifier: string | null, iosVersion: string | null, chipOverride: string | null = null) {
  return analyseCatalogue({ modelIdentifier, iosVersion, chipOverride }, JAILBREAK_METHODS);
}

function verdictFor(evaluations: MethodEvaluation[], id: string) {
  return evaluations.find((item) => item.method.id === id)?.verdict;
}

describe("Compatibilité du catalogue jailbreak", () => {
  it("analyse les versions iOS sous forme de triplets comparables", () => {
    expect(parseIosVersion("16.7.1")).toEqual([16, 7, 1]);
    expect(parseIosVersion("26.0")).toEqual([26, 0, 0]);
    expect(parseIosVersion("17.3")).toEqual([17, 3, 0]);
    expect(parseIosVersion("16.7.1 (20H30)")).toEqual([16, 7, 1]);
    expect(parseIosVersion(null)).toBeNull();
    expect(parseIosVersion("inconnue")).toBeNull();

    expect(compareIosVersionStrings("15.0", "15.0")).toBe(0);
    expect(compareIosVersionStrings("16.7.1", "17.0")).toBeLessThan(0);
    expect(compareIosVersionStrings("18.7.1", "18.7.0")).toBeGreaterThan(0);
  });

  it("déduit la puce et le nom de l'appareil depuis l'identifiant matériel", () => {
    const analysis = evaluate("iPhone10,3", "16.7.1");
    expect(analysis.chip?.id).toBe("A11");
    expect(analysis.deviceName).toBe("iPhone X");
    expect(analysis.chipSource).toBe("auto");
  });

  it("déclare Dopamine compatible sur un A11 sous iOS 16.7.1", () => {
    const analysis = evaluate("iPhone10,3", "16.7.1");
    expect(verdictFor(analysis.evaluations, "dopamine")).toBe("compatible");
    expect(verdictFor(analysis.evaluations, "palera1n")).toBe("compatible");
  });

  it("signale une version trop récente comme hors plage, avec la plage exacte", () => {
    const analysis = evaluate("iPhone13,2", "18.5");
    const dopamine = analysis.evaluations.find((item) => item.method.id === "dopamine");
    expect(dopamine?.verdict).toBe("hors-plage");
    expect(dopamine?.reasons.join(" ")).toMatch(/15\.0 – 17\.3\.1/);
    expect(dopamine?.reasons.join(" ")).toMatch(/downgrade/i);
  });

  it("couvre iOS 26.0.1 uniquement sur les puces A12/A13", () => {
    expect(verdictFor(evaluate("iPhone12,1", "26.0.1").evaluations, "dopamine")).toBe("compatible");
    expect(verdictFor(evaluate("iPhone13,2", "26.0.1").evaluations, "dopamine")).toBe("hors-plage");
  });

  it("ne prétend rien pour les puces trop récentes", () => {
    const analysis = evaluate("iPhone17,3", "18.5");
    expect(analysis.chip?.id).toBe("A18");
    expect(verdictFor(analysis.evaluations, "dopamine")).toBe("non-supporte");
    expect(analysis.counts.compatible).toBe(0);
  });

  it("respecte les bornes exactes de TrollStore", () => {
    expect(verdictFor(evaluate("iPhone10,3", "16.6.1").evaluations, "trollstore")).toBe("compatible");
    expect(verdictFor(evaluate("iPhone10,3", "16.7").evaluations, "trollstore")).toBe("hors-plage");
    expect(verdictFor(evaluate("iPhone10,3", "17.0").evaluations, "trollstore")).toBe("compatible");
    expect(verdictFor(evaluate("iPhone10,3", "17.0.1").evaluations, "trollstore")).toBe("hors-plage");
  });

  it("privilégie la puce choisie manuellement quand l'identifiant est inconnu", () => {
    const auto = evaluate("iPhone99,9", "16.7.1");
    expect(auto.chip).toBeNull();
    expect(auto.chipSource).toBe("inconnu");
    expect(verdictFor(auto.evaluations, "dopamine")).toBe("inconnu");

    const manual = evaluate("iPhone99,9", "16.7.1", "A11");
    expect(manual.chip?.id).toBe("A11");
    expect(manual.chipSource).toBe("manuel");
    expect(verdictFor(manual.evaluations, "dopamine")).toBe("compatible");
  });

  it("ne conclut rien sans version iOS", () => {
    const analysis = evaluate("iPhone10,3", null, "A11");
    expect(verdictFor(analysis.evaluations, "dopamine")).toBe("inconnu");
  });

  it("avertit que palera1n exige macOS ou Linux, jamais Windows", () => {
    const analysis = evaluate("iPhone10,3", "16.7.1");
    const palera1n = analysis.evaluations.find((item) => item.method.id === "palera1n");
    expect(palera1n?.hostWarnings.join(" ")).toMatch(/macOS ou Linux/);
    expect(palera1n?.hostWarnings.join(" ")).toMatch(/DFU/);

    const dopamine = analysis.evaluations.find((item) => item.method.id === "dopamine");
    expect(dopamine?.hostWarnings).toHaveLength(0);
  });

  it("marque les entrées d'inventaire comme hors évaluation", () => {
    const analysis = evaluate("iPhone10,3", "16.7.1");
    expect(verdictFor(analysis.evaluations, "historiques-inventaire")).toBe("hors-evaluation");
    expect(verdictFor(analysis.evaluations, "variantes-recentes")).toBe("hors-evaluation");
  });

  it("trie les méthodes compatibles en premier", () => {
    const analysis = evaluate("iPhone10,3", "16.7.1");
    const sorted = sortEvaluations(analysis.evaluations);
    expect(sorted[0].verdict).toBe("compatible");
    expect(sorted[sorted.length - 1].verdict).toBe("hors-evaluation");
  });

  it("fournit pour chaque méthode des sources https et une date de vérification", () => {
    for (const method of JAILBREAK_METHODS) {
      expect(method.sources.length).toBeGreaterThan(0);
      for (const source of method.sources) {
        expect(source.url.startsWith("https://")).toBe(true);
      }
      expect(method.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(method.summary.length).toBeGreaterThan(20);
    }
  });

  it("ne publie aucune étape pour les entrées d'inventaire", () => {
    expect(getMethod("historiques-inventaire")?.steps).toHaveLength(0);
    expect(getMethod("variantes-recentes")?.steps).toHaveLength(0);
    expect(getMethod("dopamine")?.steps.length).toBeGreaterThan(2);
  });

  it("référence des remplaçants cohérents", () => {
    const superseded = JAILBREAK_METHODS.filter((method) => method.supersededBy);
    expect(superseded.length).toBeGreaterThan(0);
    for (const method of superseded) {
      expect(getMethod(method.supersededBy as string)).not.toBeNull();
    }
  });
});
