/**
 * NovaUnlock Desktop — Catalogue jailbreak (types)
 *
 * Ce module décrit des **faits documentaires** sur les méthodes de jailbreak
 * publiques. Il ne contient aucun binaire, aucune charge utile et aucun code
 * d'exploitation : seules des métadonnées vérifiables et des liens vers les
 * sources officielles sont stockés.
 */

export type ChipArchitecture = "32-bit" | "arm64" | "arm64e";

export interface ChipInfo {
  /** Identifiant court, ex. « A11 » ou « A12Z ». */
  id: string;
  label: string;
  architecture: ChipArchitecture;
}

export interface KnownDevice {
  /** Identifiant matériel iOS, ex. « iPhone10,3 » (ProductType). */
  identifier: string;
  name: string;
  /** Identifiant de puce (clé de `CHIPS`). */
  chip: string;
}

export type MethodKind =
  | "semi-untethered"
  | "semi-tethered"
  | "tethered"
  | "untethered"
  | "semi-jailbreak"
  | "bootstrap"
  | "installateur";

export type MethodStatus = "actif" | "maintenu" | "en-veille" | "abandonne" | "recherche";

/** Environnement requis pour exécuter la méthode. */
export type HostPlatform = "appareil" | "windows" | "macos" | "linux";

export interface ChipRule {
  /** Puces concernées (clés de `CHIPS`). */
  chips: string[];
  /** Version iOS minimale prise en charge, incluse (ex. « 15.0 »). */
  min: string;
  /** Version iOS maximale prise en charge, incluse ; `null` = pas de limite connue. */
  max: string | null;
  note?: string;
}

export interface MethodSource {
  label: string;
  url: string;
}

export interface JailbreakMethod {
  id: string;
  name: string;
  kind: MethodKind;
  status: MethodStatus;
  /** Méthode actuellement préconisée pour son périmètre. */
  recommended: boolean;
  summary: string;
  /** Dernière version publique connue et sa date. */
  lastRelease: string;
  exploit: string;
  persistence: string;
  hosts: HostPlatform[];
  /** État requis de l'appareil au moment de l'exécution. */
  deviceMode: string;
  requires: string[];
  /** Règles de compatibilité puce × version iOS. Vide = entrée d'inventaire. */
  rules: ChipRule[];
  steps: string[];
  risks: string[];
  sources: MethodSource[];
  /** Identifiant de la méthode qui remplace celle-ci, le cas échéant. */
  supersededBy?: string;
  /** Date de dernière vérification des informations (ISO). */
  verifiedAt: string;
  /** Source primaire utilisée pour la vérification. */
  verifiedFrom: string;
}

export type CompatVerdict =
  | "compatible"
  | "hors-plage"
  | "non-supporte"
  | "inconnu"
  | "hors-evaluation";

export interface MethodEvaluation {
  method: JailbreakMethod;
  verdict: CompatVerdict;
  reasons: string[];
  /** Règles matched ou proches, pour l'affichage. */
  rule: ChipRule | null;
  /** Avertissements liés à l'environnement d'exécution (Windows, DFU…). */
  hostWarnings: string[];
}

export interface DeviceProfileInput {
  modelIdentifier: string | null;
  iosVersion: string | null;
  /** Puce choisie manuellement si la détection automatique échoue. */
  chipOverride: string | null;
}

export type ChipSource = "auto" | "manuel" | "inconnu";

export interface CatalogueAnalysis {
  chip: ChipInfo | null;
  chipSource: ChipSource;
  deviceName: string | null;
  iosVersion: string | null;
  evaluations: MethodEvaluation[];
  counts: {
    compatible: number;
    horsPlage: number;
    nonSupporte: number;
    inconnu: number;
    horsEvaluation: number;
  };
}
