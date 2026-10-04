/**
 * NovaUnlock Desktop — Puce et appareils connus
 *
 * Table de correspondance identifiant matériel iOS (ProductType) → puce.
 * Elle sert uniquement à proposer la bonne compatibilité : si un identifiant
 * n'est pas reconnu, l'utilisateur choisit sa puce manuellement et aucune
 * conclusion n'est tirée à sa place.
 */

import type { ChipInfo, KnownDevice } from "./types";

export const CHIPS: Record<string, ChipInfo> = {
  A4: { id: "A4", label: "A4", architecture: "32-bit" },
  A5: { id: "A5", label: "A5", architecture: "32-bit" },
  A5X: { id: "A5X", label: "A5X", architecture: "32-bit" },
  A6: { id: "A6", label: "A6", architecture: "32-bit" },
  A6X: { id: "A6X", label: "A6X", architecture: "32-bit" },
  A7: { id: "A7", label: "A7 (64 bits)", architecture: "arm64" },
  A8: { id: "A8", label: "A8", architecture: "arm64" },
  A8X: { id: "A8X", label: "A8X", architecture: "arm64" },
  A9: { id: "A9", label: "A9", architecture: "arm64" },
  A9X: { id: "A9X", label: "A9X", architecture: "arm64" },
  A10: { id: "A10", label: "A10 Fusion", architecture: "arm64" },
  A10X: { id: "A10X", label: "A10X Fusion", architecture: "arm64" },
  A11: { id: "A11", label: "A11 Bionic", architecture: "arm64" },
  A12: { id: "A12", label: "A12 Bionic", architecture: "arm64e" },
  A12X: { id: "A12X", label: "A12X Bionic", architecture: "arm64e" },
  A12Z: { id: "A12Z", label: "A12Z Bionic", architecture: "arm64e" },
  A13: { id: "A13", label: "A13 Bionic", architecture: "arm64e" },
  A14: { id: "A14", label: "A14 Bionic", architecture: "arm64e" },
  A15: { id: "A15", label: "A15 Bionic", architecture: "arm64e" },
  A16: { id: "A16", label: "A16 Bionic", architecture: "arm64e" },
  A17: { id: "A17", label: "A17 Pro", architecture: "arm64e" },
  A18: { id: "A18", label: "A18 / A18 Pro", architecture: "arm64e" },
  A19: { id: "A19", label: "A19 / A19 Pro", architecture: "arm64e" },
  M1: { id: "M1", label: "Apple M1", architecture: "arm64e" },
  M2: { id: "M2", label: "Apple M2", architecture: "arm64e" },
  T2: { id: "T2", label: "Apple T2 (iBridge)", architecture: "arm64e" },
};

/** Puces listées dans le sélecteur manuel, du plus récent au plus ancien. */
export const SELECTABLE_CHIPS: ChipInfo[] = [
  "A19",
  "A18",
  "A17",
  "A16",
  "A15",
  "A14",
  "A13",
  "A12Z",
  "A12X",
  "A12",
  "A11",
  "A10X",
  "A10",
  "A9X",
  "A9",
  "A8X",
  "A8",
  "A7",
  "A6X",
  "A6",
  "A5X",
  "A5",
  "T2",
  "M2",
  "M1",
].map((id) => CHIPS[id]);

function device(identifier: string, name: string, chip: string): KnownDevice {
  return { identifier, name, chip };
}

export const KNOWN_DEVICES: KnownDevice[] = [
  // iPhone
  device("iPhone8,1", "iPhone 6s", "A9"),
  device("iPhone8,2", "iPhone 6s Plus", "A9"),
  device("iPhone8,4", "iPhone SE (1re génération)", "A9"),
  device("iPhone9,1", "iPhone 7", "A10"),
  device("iPhone9,2", "iPhone 7 Plus", "A10"),
  device("iPhone9,3", "iPhone 7", "A10"),
  device("iPhone9,4", "iPhone 7 Plus", "A10"),
  device("iPhone10,1", "iPhone 8", "A11"),
  device("iPhone10,4", "iPhone 8", "A11"),
  device("iPhone10,2", "iPhone 8 Plus", "A11"),
  device("iPhone10,5", "iPhone 8 Plus", "A11"),
  device("iPhone10,3", "iPhone X", "A11"),
  device("iPhone10,6", "iPhone X", "A11"),
  device("iPhone11,2", "iPhone XS", "A12"),
  device("iPhone11,4", "iPhone XS Max", "A12"),
  device("iPhone11,6", "iPhone XS Max", "A12"),
  device("iPhone11,8", "iPhone XR", "A12"),
  device("iPhone12,1", "iPhone 11", "A13"),
  device("iPhone12,3", "iPhone 11 Pro", "A13"),
  device("iPhone12,5", "iPhone 11 Pro Max", "A13"),
  device("iPhone12,8", "iPhone SE (2e génération)", "A13"),
  device("iPhone13,1", "iPhone 12 mini", "A14"),
  device("iPhone13,2", "iPhone 12", "A14"),
  device("iPhone13,3", "iPhone 12 Pro", "A14"),
  device("iPhone13,4", "iPhone 12 Pro Max", "A14"),
  device("iPhone14,4", "iPhone 13 mini", "A15"),
  device("iPhone14,5", "iPhone 13", "A15"),
  device("iPhone14,2", "iPhone 13 Pro", "A15"),
  device("iPhone14,3", "iPhone 13 Pro Max", "A15"),
  device("iPhone14,6", "iPhone SE (3e génération)", "A15"),
  device("iPhone14,7", "iPhone 14", "A15"),
  device("iPhone14,8", "iPhone 14 Plus", "A15"),
  device("iPhone15,2", "iPhone 14 Pro", "A16"),
  device("iPhone15,3", "iPhone 14 Pro Max", "A16"),
  device("iPhone15,4", "iPhone 15", "A16"),
  device("iPhone15,5", "iPhone 15 Plus", "A16"),
  device("iPhone16,1", "iPhone 15 Pro", "A17"),
  device("iPhone16,2", "iPhone 15 Pro Max", "A17"),
  device("iPhone17,1", "iPhone 16 Pro", "A18"),
  device("iPhone17,2", "iPhone 16 Pro Max", "A18"),
  device("iPhone17,3", "iPhone 16", "A18"),
  device("iPhone17,4", "iPhone 16 Plus", "A18"),
  device("iPhone17,5", "iPhone 16e", "A18"),

  // iPad
  device("iPad5,1", "iPad mini 4", "A8"),
  device("iPad5,2", "iPad mini 4", "A8"),
  device("iPad5,3", "iPad Air 2", "A8X"),
  device("iPad5,4", "iPad Air 2", "A8X"),
  device("iPad6,11", "iPad (5e génération)", "A9"),
  device("iPad6,12", "iPad (5e génération)", "A9"),
  device("iPad6,3", "iPad Pro 9,7 pouces", "A9X"),
  device("iPad6,4", "iPad Pro 9,7 pouces", "A9X"),
  device("iPad6,7", "iPad Pro 12,9 pouces (1re génération)", "A9X"),
  device("iPad6,8", "iPad Pro 12,9 pouces (1re génération)", "A9X"),
  device("iPad7,1", "iPad Pro 12,9 pouces (2e génération)", "A10X"),
  device("iPad7,2", "iPad Pro 12,9 pouces (2e génération)", "A10X"),
  device("iPad7,3", "iPad Pro 10,5 pouces", "A10X"),
  device("iPad7,4", "iPad Pro 10,5 pouces", "A10X"),
  device("iPad7,5", "iPad (6e génération)", "A10"),
  device("iPad7,6", "iPad (6e génération)", "A10"),
  device("iPad7,11", "iPad (7e génération)", "A10"),
  device("iPad7,12", "iPad (7e génération)", "A10"),
  device("iPad8,1", "iPad Pro 11 pouces (1re génération)", "A12X"),
  device("iPad8,2", "iPad Pro 11 pouces (1re génération)", "A12X"),
  device("iPad8,3", "iPad Pro 11 pouces (1re génération)", "A12X"),
  device("iPad8,4", "iPad Pro 11 pouces (1re génération)", "A12X"),
  device("iPad8,5", "iPad Pro 12,9 pouces (3e génération)", "A12X"),
  device("iPad8,6", "iPad Pro 12,9 pouces (3e génération)", "A12X"),
  device("iPad8,7", "iPad Pro 12,9 pouces (3e génération)", "A12X"),
  device("iPad8,8", "iPad Pro 12,9 pouces (3e génération)", "A12X"),
  device("iPad8,9", "iPad Pro 11 pouces (2e génération)", "A12Z"),
  device("iPad8,10", "iPad Pro 11 pouces (2e génération)", "A12Z"),
  device("iPad8,11", "iPad Pro 12,9 pouces (4e génération)", "A12Z"),
  device("iPad8,12", "iPad Pro 12,9 pouces (4e génération)", "A12Z"),
  device("iPad11,1", "iPad mini (5e génération)", "A12"),
  device("iPad11,2", "iPad mini (5e génération)", "A12"),
  device("iPad11,3", "iPad Air (3e génération)", "A12"),
  device("iPad11,4", "iPad Air (3e génération)", "A12"),
  device("iPad11,6", "iPad (8e génération)", "A12"),
  device("iPad11,7", "iPad (8e génération)", "A12"),
  device("iPad12,1", "iPad (9e génération)", "A13"),
  device("iPad12,2", "iPad (9e génération)", "A13"),
  device("iPad13,1", "iPad Air (4e génération)", "A14"),
  device("iPad13,2", "iPad Air (4e génération)", "A14"),
  device("iPad13,4", "iPad Pro 11 pouces (3e génération)", "M1"),
  device("iPad13,5", "iPad Pro 11 pouces (3e génération)", "M1"),
  device("iPad13,6", "iPad Pro 11 pouces (3e génération)", "M1"),
  device("iPad13,7", "iPad Pro 11 pouces (3e génération)", "M1"),
  device("iPad13,8", "iPad Pro 12,9 pouces (5e génération)", "M1"),
  device("iPad13,9", "iPad Pro 12,9 pouces (5e génération)", "M1"),
  device("iPad13,10", "iPad Pro 12,9 pouces (5e génération)", "M1"),
  device("iPad13,11", "iPad Pro 12,9 pouces (5e génération)", "M1"),
  device("iPad13,16", "iPad Air (5e génération)", "M1"),
  device("iPad13,17", "iPad Air (5e génération)", "M1"),
  device("iPad13,18", "iPad (10e génération)", "A14"),
  device("iPad13,19", "iPad (10e génération)", "A14"),
  device("iPad14,1", "iPad mini (6e génération)", "A15"),
  device("iPad14,2", "iPad mini (6e génération)", "A15"),
  device("iPad14,3", "iPad Pro 11 pouces (4e génération)", "M2"),
  device("iPad14,4", "iPad Pro 11 pouces (4e génération)", "M2"),
  device("iPad14,5", "iPad Pro 12,9 pouces (6e génération)", "M2"),
  device("iPad14,6", "iPad Pro 12,9 pouces (6e génération)", "M2"),
  device("iPad14,8", "iPad Air 11 pouces (M2)", "M2"),
  device("iPad14,9", "iPad Air 13 pouces (M2)", "M2"),

  // iPod
  device("iPod9,1", "iPod touch (7e génération)", "A10"),

  // Apple TV
  device("AppleTV5,3", "Apple TV HD", "A8"),
  device("AppleTV6,2", "Apple TV 4K (1re génération)", "A10X"),
  device("AppleTV11,1", "Apple TV 4K (2e génération)", "A12"),
  device("AppleTV14,1", "Apple TV 4K (3e génération)", "A15"),
];

const DEVICE_INDEX: Map<string, KnownDevice> = new Map(
  KNOWN_DEVICES.map((entry) => [entry.identifier.toLowerCase(), entry])
);

/** Résout un identifiant matériel (« iPhone10,3 ») en appareil connu. */
export function resolveKnownDevice(modelIdentifier: string | null | undefined): KnownDevice | null {
  if (!modelIdentifier) return null;
  return DEVICE_INDEX.get(modelIdentifier.trim().toLowerCase()) ?? null;
}

/** Résout une puce : sélection manuelle prioritaire, sinon table des appareils. */
export function resolveChip(
  modelIdentifier: string | null | undefined,
  chipOverride?: string | null
): { chip: ChipInfo | null; source: "auto" | "manuel" | "inconnu"; device: KnownDevice | null } {
  const manual = chipOverride ? CHIPS[chipOverride] : undefined;
  if (manual) {
    return { chip: manual, source: "manuel", device: resolveKnownDevice(modelIdentifier) };
  }
  const device = resolveKnownDevice(modelIdentifier);
  if (device && CHIPS[device.chip]) {
    return { chip: CHIPS[device.chip], source: "auto", device };
  }
  return { chip: null, source: "inconnu", device: device ?? null };
}
