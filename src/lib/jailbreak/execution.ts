/**
 * NovaUnlock Desktop — Sélection automatique et application assistée
 *
 * Le système retient, à partir des informations réellement reçues de l'appareil
 * (identifiant matériel → puce, version iOS), la méthode de jailbreak adaptée,
 * puis décrit précisément ce qui peut être fait depuis Windows :
 *
 *  - `installation-ipa` : NovaUnlock installe sur l'appareil l'IPA que
 *    l'utilisateur a téléchargé depuis la source officielle, via
 *    `ideviceinstaller` du paquet natif vérifié ;
 *  - `manuelle` : la méthode ne peut pas être lancée depuis Windows (outil
 *    macOS/Linux, installeur sur l'appareil, navigateur…) — les étapes sont
 *    affichées, aucune commande n'est exécutée ;
 *  - `indisponible` : entrée d'inventaire ou outil non fiable.
 *
 * Aucune décision n'est prise si la compatibilité n'est pas établie : un plan
 * « bloqué » explique alors ce qui manque.
 */

import type {
  ChipInfo,
  CompatVerdict,
  JailbreakMethod,
  MethodEvaluation,
} from "./types";

export type AutomationCapability = "installation-ipa" | "manuelle" | "indisponible";

export interface AutomationSpec {
  methodId: string;
  capability: AutomationCapability;
  /** Outil natif requis pour l'application assistée. */
  requiredTool?: "installer";
  /** Étapes à présenter quand la méthode reste manuelle. */
  manualSteps: string[];
  /** Précision affichée avec la décision. */
  note?: string;
}

const BACKUP_STEP = "Sauvegardez l'appareil (Finder, iTunes ou iCloud) avant toute modification.";
const RUN_ON_DEVICE_STEP =
  "Une fois l'application installée, ouvrez-la sur l'appareil et lancez la procédure « Jailbreak » qu'elle propose.";

export const AUTOMATION_SPECS: AutomationSpec[] = [
  {
    methodId: "dopamine",
    capability: "installation-ipa",
    requiredTool: "installer",
    note: "NovaUnlock installe l'IPA ; la procédure d'exploitation se lance ensuite sur l'appareil.",
    manualSteps: [BACKUP_STEP, RUN_ON_DEVICE_STEP, "Relancez l'application après chaque redémarrage de l'appareil."],
  },
  {
    methodId: "trollstore",
    capability: "manuelle",
    note: "TrollStore s'installe depuis l'appareil : aucune commande Windows ne peut le poser.",
    manualSteps: [
      BACKUP_STEP,
      "Ouvrez le guide officiel et choisissez l'installeur correspondant exactement à la version iOS détectée.",
      "Suivez l'installeur sur ou depuis l'appareil, puis activez le helper de persistance proposé.",
      "TrollStore sert ensuite à installer Dopamine ou un bootstrap sans certificat.",
    ],
  },
  {
    methodId: "roothide-bootstrap",
    capability: "manuelle",
    note: "Le bootstrap s'installe depuis l'appareil via TrollStore.",
    manualSteps: [
      BACKUP_STEP,
      "Vérifiez que TrollStore est déjà installé sur l'appareil.",
      "Installez le paquet .tipa du bootstrap, puis ouvrez-le et lancez l'installation.",
      "Ajoutez les dépôts de votre choix dans Sileo ou Zebra.",
    ],
  },
  {
    methodId: "xinaa15",
    capability: "installation-ipa",
    requiredTool: "installer",
    note: "L'IPA doit être signé (compte développeur) pour s'installer sur un appareil non jailbreaké.",
    manualSteps: [BACKUP_STEP, RUN_ON_DEVICE_STEP],
  },
  {
    methodId: "serotonin",
    capability: "manuelle",
    note: "Semi-jailbreak installé depuis l'appareil via TrollStore.",
    manualSteps: [
      BACKUP_STEP,
      "Installez TrollStore puis le bootstrap roothide sur l'appareil.",
      "Ouvrez le paquet Serotonin dans TrollStore et lancez l'opération.",
    ],
  },
  {
    methodId: "palera1n",
    capability: "manuelle",
    note: "palera1n s'exécute uniquement depuis macOS ou Linux : rien ne peut être lancé depuis ce PC Windows.",
    manualSteps: [
      BACKUP_STEP,
      "Depuis un poste macOS ou Linux, téléchargez palera1n sur palera.in et vérifiez la version.",
      "Placez l'appareil en DFU lorsque l'outil le demande, puis laissez l'exploit checkm8 démarrer.",
      "Sur A11 : désactivez le code d'accès en état jailbreaké (effacement requis sur iOS 16).",
    ],
  },
  {
    methodId: "checkra1n",
    capability: "manuelle",
    note: "checkra1n s'exécute uniquement depuis macOS ou Linux.",
    manualSteps: [
      BACKUP_STEP,
      "Depuis un poste macOS ou Linux, lancez checkra1n et suivez la mise en DFU guidée.",
      "Ouvrez l'application checkra1n sur l'appareil pour terminer l'installation de Cydia.",
    ],
  },
  {
    methodId: "pangu9",
    capability: "manuelle",
    note: "Outil Windows d'une autre époque : NovaUnlock ne l'exécutera jamais à votre place.",
    manualSteps: [
      BACKUP_STEP,
      "Un iPhone bloqué sur iOS 9 n'a aujourd'hui qu'un intérêt patrimonial ou de recherche.",
      "N'utilisez jamais un installeur en ligne promettant un jailbreak sans ordinateur.",
    ],
  },
  {
    methodId: "home-depot",
    capability: "manuelle",
    note: "Installation depuis Safari sur l'appareil.",
    manualSteps: [
      BACKUP_STEP,
      "Sur l'appareil, ouvrez l'installeur correspondant à iOS 9.1–9.3.4 et lancez l'installation.",
      "Après chaque redémarrage, relancez la page ou l'application.",
    ],
  },
  {
    methodId: "fugu15",
    capability: "indisponible",
    note: "Outil de recherche sans gestionnaire de paquets : à réserver aux développeurs. Utilisez Dopamine.",
    manualSteps: [],
  },
  {
    methodId: "variantes-recentes",
    capability: "indisponible",
    note: "Outils complémentaires non documentés : vérifiez chaque source avant usage.",
    manualSteps: [],
  },
  {
    methodId: "historiques-inventaire",
    capability: "indisponible",
    note: "Entrée d'inventaire : aucune action proposée.",
    manualSteps: [],
  },
];

/** Valeur par défaut pour les méthodes IPA historiques (unc0ver, Taurine, …). */
const DEFAULT_IPA_SPEC: AutomationSpec = {
  methodId: "*",
  capability: "installation-ipa",
  requiredTool: "installer",
  note: "L'installation nécessite un certificat valide pris en charge par iOS (le compte gratuit expire en 7 jours).",
  manualSteps: [BACKUP_STEP, RUN_ON_DEVICE_STEP, "Resignez l'application avant expiration du certificat."],
};

/** Ordre de préférence quand plusieurs méthodes sont compatibles. */
export const AUTO_PRIORITY: string[] = [
  "dopamine",
  "xinaa15",
  "unc0ver",
  "taurine",
  "odyssey",
  "chimera",
  "electra",
  "meridian",
  "yalu",
  "h3lix",
  "phoenix",
  "palera1n",
  "checkra1n",
  "pangu9",
  "home-depot",
  "serotonin",
  "roothide-bootstrap",
  "fugu15",
];

export function getAutomationSpec(method: JailbreakMethod): AutomationSpec {
  const explicit = AUTOMATION_SPECS.find((spec) => spec.methodId === method.id);
  if (explicit) return explicit;
  if (method.kind === "installateur" || method.kind === "bootstrap" || method.kind === "semi-jailbreak") {
    return {
      methodId: method.id,
      capability: "manuelle",
      manualSteps: [BACKUP_STEP, ...method.steps.slice(0, 3)],
      note: "Cette méthode s'installe depuis l'appareil.",
    };
  }
  return { ...DEFAULT_IPA_SPEC, methodId: method.id };
}

export interface PlanInput {
  method: JailbreakMethod;
  verdict: CompatVerdict;
  chip: ChipInfo | null;
  iosVersion: string | null;
  /** ideviceinstaller.exe est présent dans le paquet natif. */
  installReady: boolean;
  /** Un appareil est appairé et peut recevoir une installation. */
  devicePaired: boolean;
  /** IPA choisi par l'utilisateur, s'il y en a un. */
  artifactPath: string | null;
}

export type PlanOutcome = "pret-a-appliquer" | "action-manuelle" | "bloque" | "indisponible";

export interface JailbreakPlan {
  methodId: string;
  methodName: string;
  outcome: PlanOutcome;
  kind: "install-ipa" | "manual";
  sourceUrl: string;
  artifactPath: string | null;
  steps: string[];
  blockers: string[];
  warnings: string[];
}

/**
 * Sélectionne la méthode adaptée à l'appareil : la première méthode compatible
 * selon `AUTO_PRIORITY`, sinon la meilleure évaluation disponible.
 */
export function selectAutoMethod(evaluations: MethodEvaluation[]): MethodEvaluation | null {
  const compatible = evaluations.filter((evaluation) => evaluation.verdict === "compatible");
  if (compatible.length === 0) return null;
  for (const id of AUTO_PRIORITY) {
    const match = compatible.find((evaluation) => evaluation.method.id === id);
    if (match) return match;
  }
  return compatible[0];
}

/** Construit le plan d'application assistée correspondant à l'appareil analysé. */
export function buildJailbreakPlan(input: PlanInput): JailbreakPlan {
  const spec = getAutomationSpec(input.method);
  const warnings: string[] = [
    "Jailbreaker un appareil annule sa garantie logicielle, peut perturber l'autonomie et certaines applications.",
  ];
  const blockers: string[] = [];
  const steps: string[] = [];
  const sourceUrl = input.method.sources[0]?.url ?? "";

  if (input.verdict !== "compatible") {
    blockers.push(
      input.verdict === "hors-plage"
        ? "La version iOS installée n'est pas couverte par cette méthode : vérifiez la plage affichée."
        : input.verdict === "non-supporte"
          ? "La puce de cet appareil n'est pas prise en charge par cette méthode."
          : "Compatibilité non établie : connectez l'appareil ou renseignez sa puce et sa version iOS."
    );
  }

  if (spec.note) warnings.push(spec.note);

  if (spec.capability === "indisponible") {
    return {
      methodId: input.method.id,
      methodName: input.method.name,
      outcome: "indisponible",
      kind: "manual",
      sourceUrl,
      artifactPath: null,
      steps: [],
      blockers,
      warnings,
    };
  }

  if (spec.capability === "manuelle") {
    steps.push(...spec.manualSteps);
    if (input.method.hosts.includes("windows")) {
      warnings.push("Cette méthode était distribuée pour Windows : vérifiez la provenance avant tout usage.");
    }
    return {
      methodId: input.method.id,
      methodName: input.method.name,
      outcome: blockers.length > 0 ? "bloque" : "action-manuelle",
      kind: "manual",
      sourceUrl,
      artifactPath: null,
      steps,
      blockers,
      warnings,
    };
  }

  // capability === "installation-ipa"
  if (!input.installReady) {
    blockers.push(
      "ideviceinstaller.exe est absent du paquet libimobiledevice configuré : ajoutez-le depuis le même paquet officiel (Paramètres → Assistant de configuration)."
    );
  }
  if (!input.devicePaired) {
    blockers.push("Aucun appareil appairé : connectez-le, déverrouillez-le et acceptez « Faire confiance ».");
  }
  if (!input.artifactPath) {
    blockers.push(
      `Téléchargez l'IPA depuis la source officielle de ${input.method.name} puis sélectionnez-le dans le plan. NovaUnlock ne télécharge jamais ces fichiers à votre place.`
    );
  }

  steps.push(
    BACKUP_STEP,
    "Téléchargez l'IPA depuis la source officielle vérifiée, sans passer par un site miroir.",
    "Sélectionnez l'IPA : son empreinte SHA-256 est calculée et affichée avant l'installation.",
    "Lancez l'installation : NovaUnlock vérifie que l'appareil est appairé, puis exécute ideviceinstaller.",
    RUN_ON_DEVICE_STEP
  );

  return {
    methodId: input.method.id,
    methodName: input.method.name,
    outcome: blockers.length > 0 ? "bloque" : "pret-a-appliquer",
    kind: "install-ipa",
    sourceUrl,
    artifactPath: input.artifactPath,
    steps,
    blockers,
    warnings,
  };
}

/** Convertit le plan validé en action transmise au processus principal. */
export function toJailbreakAction(plan: JailbreakPlan) {
  if (plan.kind === "install-ipa") {
    return {
      methodId: plan.methodId,
      methodName: plan.methodName,
      kind: "install-ipa" as const,
      sourceUrl: plan.sourceUrl,
      artifactPath: plan.artifactPath ?? undefined,
    };
  }
  return {
    methodId: plan.methodId,
    methodName: plan.methodName,
    kind: "manual" as const,
    sourceUrl: plan.sourceUrl,
    manualSteps: plan.steps,
  };
}

/** Vérifie que l'action générée passe la validation du processus principal. */
export function isPlanConsistent(plan: JailbreakPlan): boolean {
  if (!plan.sourceUrl.startsWith("https://")) return false;
  if (plan.outcome === "pret-a-appliquer") {
    return plan.kind === "install-ipa" && Boolean(plan.artifactPath) && plan.blockers.length === 0;
  }
  if (plan.outcome === "action-manuelle") {
    return plan.kind === "manual" && plan.steps.length > 0 && plan.blockers.length === 0;
  }
  return true;
}
