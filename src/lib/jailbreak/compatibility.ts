/**
 * NovaUnlock Desktop — Moteur de compatibilité du catalogue jailbreak
 *
 * Le moteur ne fait que comparer des métadonnées publiques (puce × version iOS)
 * à ce que l'appareil détecté rapporte. Il ne lance aucune opération, ne
 * télécharge rien et n'exécute aucun outil tiers.
 */

import { resolveChip } from "./chips";
import type {
  CatalogueAnalysis,
  ChipInfo,
  ChipRule,
  CompatVerdict,
  DeviceProfileInput,
  JailbreakMethod,
  MethodEvaluation,
} from "./types";

const VERSION_PATTERN = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

/** Convertit « 17.3.1 » en triplet comparable. `null` si illisible. */
export function parseIosVersion(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  const match = String(raw).trim().match(VERSION_PATTERN);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

export function compareIosVersions(a: number[], b: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** Compare deux chaînes de version iOS (« 15.0 » < « 17.3.2 »). */
export function compareIosVersionStrings(a: string, b: string): number {
  return compareIosVersions(parseIosVersion(a) ?? [0, 0, 0], parseIosVersion(b) ?? [0, 0, 0]);
}

export function formatRange(rule: ChipRule): string {
  return rule.max ? `${rule.min} – ${rule.max}` : `${rule.min} et plus`;
}

function ruleMatchesChip(rule: ChipRule, chip: ChipInfo): boolean {
  return rule.chips.includes(chip.id);
}

function evaluateMethod(
  method: JailbreakMethod,
  chip: ChipInfo | null,
  ios: number[] | null
): MethodEvaluation {
  const hostWarnings: string[] = [];
  const desktopHosts = method.hosts.filter((host) => host !== "appareil");
  if (desktopHosts.length > 0 && !desktopHosts.includes("windows")) {
    hostWarnings.push(
      `Cette méthode s'exécute depuis ${desktopHosts
        .map((host) => (host === "macos" ? "macOS" : "Linux"))
        .join(" ou ")} — pas depuis Windows, donc pas depuis ce PC.`
    );
  }
  if (method.deviceMode.toLowerCase().includes("dfu")) {
    hostWarnings.push("L'appareil doit être passé en mode DFU depuis un ordinateur compatible.");
  }
  if (method.recommended === false && method.supersededBy) {
    hostWarnings.push("Remplacée par une méthode plus récente ; à n'utiliser que pour un cas historique précis.");
  }

  if (method.rules.length === 0) {
    return {
      method,
      verdict: "hors-evaluation",
      reasons: ["Entrée d'inventaire : compatibilité détaillée sur la source de référence."],
      rule: null,
      hostWarnings,
    };
  }

  if (!chip || !ios) {
    const missing = [!chip ? "la puce" : null, !ios ? "la version iOS" : null].filter(Boolean).join(" et ");
    return {
      method,
      verdict: "inconnu",
      reasons: [`Impossible de conclure sans ${missing}.`],
      rule: null,
      hostWarnings,
    };
  }

  const chipRules = method.rules.filter((rule) => ruleMatchesChip(rule, chip));
  if (chipRules.length === 0) {
    return {
      method,
      verdict: "non-supporte",
      reasons: [`La puce ${chip.label} n'apparaît dans aucune règle de cette méthode.`],
      rule: null,
      hostWarnings,
    };
  }

  for (const rule of chipRules) {
    const min = parseIosVersion(rule.min) ?? [0, 0, 0];
    const max = rule.max ? parseIosVersion(rule.max) : null;
    const afterMin = compareIosVersions(ios, min) >= 0;
    const beforeMax = max ? compareIosVersions(ios, max) <= 0 : true;
    if (afterMin && beforeMax) {
      const reasons = [`Puce ${chip.label} prise en charge en ${formatRange(rule)}.`];
      if (rule.note) reasons.push(rule.note);
      return { method, verdict: "compatible", reasons, rule, hostWarnings };
    }
  }

  const closest = chipRules[0];
  const tooRecent = closest.max ? compareIosVersions(ios, parseIosVersion(closest.max) ?? [0, 0, 0]) > 0 : false;
  const reasons = [
    tooRecent
      ? `Puce ${chip.label} prise en charge, mais seulement en ${formatRange(closest)} : la version installée est plus récente.`
      : `Puce ${chip.label} prise en charge, mais seulement en ${formatRange(closest)} : la version installée est plus ancienne.`,
  ];
  if (tooRecent) {
    reasons.push("Aucun downgrade officiel n'existe sans blobs SHSH : vérifiez la source avant d'espérer cette méthode.");
  } else {
    reasons.push("Une méthode plus adaptée existe probablement pour cette version plus ancienne (voir la liste).");
  }
  if (closest.note) reasons.push(closest.note);
  return { method, verdict: "hors-plage", reasons, rule: closest, hostWarnings };
}

/** Analyse un appareil face à tout le catalogue. */
export function analyseCatalogue(
  input: DeviceProfileInput,
  methods: JailbreakMethod[]
): CatalogueAnalysis {
  const { chip, source, device } = resolveChip(input.modelIdentifier, input.chipOverride);
  const ios = parseIosVersion(input.iosVersion);

  const evaluations = methods.map((method) => evaluateMethod(method, chip, ios));

  const counts = {
    compatible: evaluations.filter((item) => item.verdict === "compatible").length,
    horsPlage: evaluations.filter((item) => item.verdict === "hors-plage").length,
    nonSupporte: evaluations.filter((item) => item.verdict === "non-supporte").length,
    inconnu: evaluations.filter((item) => item.verdict === "inconnu").length,
    horsEvaluation: evaluations.filter((item) => item.verdict === "hors-evaluation").length,
  };

  return {
    chip,
    chipSource: source,
    deviceName: device?.name ?? null,
    iosVersion: input.iosVersion,
    evaluations,
    counts,
  };
}

const VERDICT_ORDER: Record<CompatVerdict, number> = {
  compatible: 0,
  "hors-plage": 1,
  inconnu: 2,
  "non-supporte": 3,
  "hors-evaluation": 4,
};

/** Trie les évaluations : compatibles d'abord, puis par statut de méthode. */
export function sortEvaluations(evaluations: MethodEvaluation[]): MethodEvaluation[] {
  const statusOrder: Record<JailbreakMethod["status"], number> = {
    actif: 0,
    maintenu: 1,
    recherche: 2,
    "en-veille": 3,
    abandonne: 4,
  };
  return [...evaluations].sort((a, b) => {
    const verdict = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
    if (verdict !== 0) return verdict;
    const status = statusOrder[a.method.status] - statusOrder[b.method.status];
    if (status !== 0) return status;
    return a.method.name.localeCompare(b.method.name, "fr");
  });
}
