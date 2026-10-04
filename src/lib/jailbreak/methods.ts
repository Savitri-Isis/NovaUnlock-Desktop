/**
 * NovaUnlock Desktop — Catalogue des méthodes de jailbreak
 *
 * Chaque entrée est un condensé vérifiable : périmètre puce × version iOS,
 * type de persistance, prérequis, étapes, risques et sources officielles.
 * Aucune charge utile n'est embarquée ni téléchargée par NovaUnlock.
 *
 * Vérifications effectuées le 2026-10-04 à partir des pages officielles des
 * projets et de la fiche de référence The Apple Wiki (theapplewiki.com/wiki/Jailbreak).
 * Les périmètres évoluent : l'interface invite toujours à confirmer sur la source.
 */

import type { JailbreakMethod } from "./types";

export const CATALOGUE_VERIFIED_AT = "2026-10-04";

export const APPLE_WIKI_JAILBREAK = "https://theapplewiki.com/wiki/Jailbreak";
export const IOS_CFW_GUIDE = "https://ios.cfw.guide/";

const CHECKM8_CHIPS = ["A8", "A8X", "A9", "A9X", "A10", "A10X", "A11"];
const A12_A13_CHIPS = ["A12", "A12X", "A12Z", "A13"];
const LEGACY_AND_A12_CHIPS = [...CHECKM8_CHIPS, ...A12_A13_CHIPS];
const A14_A17_CHIPS = ["A14", "A15", "A16", "A17"];
const APPLE_SILICON_M1_M2 = ["M1", "M2"];

export const JAILBREAK_METHODS: JailbreakMethod[] = [
  {
    id: "dopamine",
    name: "Dopamine",
    kind: "semi-untethered",
    status: "actif",
    recommended: true,
    summary:
      "Jailbreak rootless de référence sur iOS 15.0 à 18.7.1, complété par 26.0 à 26.0.1 sur les puces A12/A13. Installe Sileo et Zebra ; c'est la suite directe de Fugu15.",
    lastRelease: "3.0.10 — 23 septembre 2026",
    exploit: "Chaînes d'exploits noyau et PPL selon la version (kfd, multicast_bytecopy, DarkSword/Coruna…)",
    persistence: "Semi-untethered : l'application doit être relancée après chaque redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal — appareil démarré, déverrouillé et appairé",
    requires: [
      "Sauvegarde récente de l'appareil",
      "Installation de l'IPA : TrollStore (14.0–16.6.1 / 17.0) ou sideload signé (AltStore, Sideloadly, Xcode)",
      "Batterie suffisante et appareil non utilisé pendant l'opération",
    ],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS],
        min: "15.0",
        max: "18.7.1",
        note: "Sur les appareils A8 à A11, la branche arm64 est couverte jusqu'à iOS 18.7.1 inclus.",
      },
      {
        chips: A12_A13_CHIPS,
        min: "26.0",
        max: "26.0.1",
        note: "Premier jailbreak non basé sur le bootrom visant une version majeure récente ; au-delà de 26.0.1, aucune méthode n'existe.",
      },
      {
        chips: [...A14_A17_CHIPS, ...APPLE_SILICON_M1_M2],
        min: "15.0",
        max: "17.3.1",
        note: "Aucune prise en charge au-delà d'iOS 17.3.1 sur ces puces.",
      },
    ],
    steps: [
      "Sauvegardez l'appareil (Finder, iTunes ou iCloud) et notez son identifiant matériel et sa version iOS exacte.",
      "Confirmez la compatibilité sur la page officielle : les plages évoluent à chaque version publiée.",
      "Installez l'IPA : TrollStore quand la version le permet, sinon un sideload signé avec un compte développeur.",
      "Ouvrez Dopamine, appuyez sur « Jailbreak » et laissez l'appareil effectuer son respring sans le débrancher.",
      "Après un redémarrage, relancez l'application pour restaurer l'état jailbreaké, puis installez vos tweaks depuis Sileo.",
    ],
    risks: [
      "Jailbreak rootless : l'écriture est limitée à certaines partitions, beaucoup de tweaks anciens sont incompatibles.",
      "Applications bancaires, jeux et services anti-triche peuvent refuser de démarrer sur un appareil modifié.",
      "Aucun downgrade officiel vers une version non signée : conservez les blobs SHSH si vous en avez.",
      "Un jailbreak annule de fait la garantie logicielle et réduit parfois l'autonomie ou la stabilité.",
    ],
    sources: [
      { label: "Téléchargement officiel", url: "https://ellekit.space/dopamine/" },
      { label: "Code source (GitHub)", url: "https://github.com/opa334/Dopamine" },
      { label: "Guide d'installation", url: "https://ios.cfw.guide/installing-dopamine" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Dopamine" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "README et site officiels Dopamine (opa334)",
  },
  {
    id: "palera1n",
    name: "palera1n",
    kind: "semi-tethered",
    status: "actif",
    recommended: true,
    summary:
      "Jailbreak fondé sur l'exploit bootrom checkm8 pour les appareils A8 à A11 et les puces T2. Comme la faille est matérielle, toutes les versions iOS/iPadOS à partir de 15.0 restent couvertes.",
    lastRelease: "2.4 (palera1n-c) — 27 juillet 2026 ; 3.0 bêta 2 en préparation",
    exploit: "checkm8 (vulnérabilité bootrom non corrigeable par Apple) via pongoOS",
    persistence: "Semi-tethered : un ordinateur compatible est nécessaire après chaque redémarrage",
    hosts: ["macos", "linux"],
    deviceMode: "DFU obligatoire à chaque exécution",
    requires: [
      "Un ordinateur macOS ou Linux : Windows n'est pas pris en charge par l'outil officiel",
      "Câble USB-A recommandé (les câbles USB-C provoquent des échecs de détection)",
      "Sauvegarde récente de l'appareil",
      "Sur A11 (et A10/A10X selon la version) : code d'accès désactivé en état jailbreaké ; sur iOS 16, un effacement est requis",
    ],
    rules: [
      {
        chips: CHECKM8_CHIPS,
        min: "15.0",
        max: null,
        note: "checkm8 étant une faille matérielle, les versions futures restent couvertes tant que l'appareil les exécute.",
      },
      {
        chips: ["T2"],
        min: "15.0",
        max: null,
        note: "Couvre aussi les Macs à puce T2 (bridgeOS 6.0 et plus) ainsi qu'Apple TV HD et 4K (1re génération).",
      },
    ],
    steps: [
      "Consultez la liste d'appareils et les avertissements (code d'accès, câble USB-A, CPU AMD) sur palera.in et le README du projet.",
      "Sauvegardez l'appareil : sur iOS 16 et un A11, le jailbreak impose de tout effacer.",
      "Depuis macOS ou Linux, lancez palera1n puis suivez les indications pour placer l'appareil en DFU.",
      "Choisissez le mode rootless (recommandé) ou rootful, laissez l'appareil redémarrer et gardez le terminal ouvert.",
      "Après chaque redémarrage, repassez en DFU et relancez l'outil pour retrouver l'état jailbreaké.",
    ],
    risks: [
      "Aucun support officiel de Windows : cet écran ne peut pas lancer la méthode, il documente seulement la marche à suivre.",
      "Le code d'accès doit être désactivé en état jailbreaké sur les puces A11 (effacement complet sur iOS 16).",
      "Les CDR répétés et les câbles inadaptés augmentent le risque d'échec de l'exploit (l'appareil reste récupérable en Recovery/DFU).",
      "Comme pour tout jailbreak : perte de garantie logicielle et baisse possible de stabilité.",
    ],
    sources: [
      { label: "Site officiel", url: "https://palera.in/" },
      { label: "Code source (GitHub)", url: "https://github.com/palera1n/palera1n" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Palera1n" },
      { label: "Guide d'installation", url: "https://ios.cfw.guide/installing-palera1n" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "README palera1n + fiche The Apple Wiki",
  },
  {
    id: "trollstore",
    name: "TrollStore",
    kind: "installateur",
    status: "maintenu",
    recommended: true,
    summary:
      "Application jailée signée en permanence qui installe n'importe quel IPA sans compte développeur ni expiration. Ce n'est pas un jailbreak, mais la voie d'installation privilégiée de Dopamine et des bootstraps.",
    lastRelease: "2.1.1 — 1er avril 2026",
    exploit: "Bogue AMFI/CoreTrust sur la vérification des signatures multiples",
    persistence: "Permanente tant que l'appareil reste sur une version compatible",
    hosts: ["appareil"],
    deviceMode: "Normal — l'installation dépend d'un installeur adapté à la version",
    requires: [
      "Une version iOS couverte : 14.0 bêta 2 à 16.6.1, 16.7 RC (20H18) ou 17.0 uniquement",
      "Un installeur adapté (TrollHelperOTA, TrollInstallerX, TrollRestore…) selon la version et la puce",
      "Le helper de persistance installé dans une application système",
    ],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS, ...A14_A17_CHIPS, "A18", ...APPLE_SILICON_M1_M2],
        min: "14.0",
        max: "16.6.1",
      },
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS, ...A14_A17_CHIPS, "A18", ...APPLE_SILICON_M1_M2],
        min: "17.0",
        max: "17.0",
        note: "16.7 RC (20H18) est également couvert ; 16.7.x final et 17.0.1 et suivants ne le seront jamais.",
      },
    ],
    steps: [
      "Vérifiez la version iOS : seules les plages indiquées sont prises en charge, sans exception possible.",
      "Suivez le guide correspondant à votre version sur ios.cfw.guide pour lancer l'installeur.",
      "Activez le helper de persistance proposé par TrollStore (dans une application système).",
      "Ouvrez ensuite un IPA dans TrollStore — ou utilisez le schéma apple-magnifier:// — pour l'installer.",
    ],
    risks: [
      "Ce n'est pas un jailbreak : pas d'injection dans les processus système ni de démon de démarrage.",
      "Le bogue CoreTrust corrigé, aucune nouvelle version ne pourra être prise en charge.",
      "Un rechargement du cache d'icônes peut nécessiter de relancer le helper de persistance pour ouvrir les apps installées.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/opa334/TrollStore" },
      { label: "Guide d'installation", url: "https://ios.cfw.guide/installing-trollstore" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/TrollStore" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "README TrollStore 2.1.1",
  },
  {
    id: "roothide-bootstrap",
    name: "roothide Bootstrap",
    kind: "bootstrap",
    status: "maintenu",
    recommended: true,
    summary:
      "Bootstrap complet sans jailbreak : il apporte un gestionnaire de paquets et l'injection de tweaks dans les applications, sur iOS 15.0 à 17.0, pour les appareils disposant d'un bogue exploitable.",
    lastRelease: "2.2.1 — 12 juin 2026",
    exploit: "Bootstrap utilisateur reposant sur un bogue noyau (kfd selon la version) et le bogue CoreTrust",
    persistence: "Tant que le bogue utilisé reste disponible sur la version installée",
    hosts: ["appareil"],
    deviceMode: "Normal — installation généralement via TrollStore",
    requires: [
      "TrollStore (ou un moyen d'installation équivalent) pour poser le .tipa",
      "Un bogue noyau compatible avec la version (kfd sur 15.0–16.6.1 selon les cas)",
      "Un semi-jailbreak complémentaire (NathanLR, Serotonin…) pour l'injection dans les processus système",
    ],
    rules: [
      {
        chips: [...LEGACY_AND_A12_CHIPS, ...A14_A17_CHIPS, ...APPLE_SILICON_M1_M2],
        min: "15.0",
        max: "17.0",
        note: "Le périmètre exact dépend du bogue disponible sur la version : consultez la page du projet.",
      },
    ],
    steps: [
      "Vérifiez que la version est couverte et qu'un bogue convient (kfd ou équivalent selon la version).",
      "Installez TrollStore, puis le paquet .tipa du Bootstrap depuis la page officielle du projet.",
      "Ouvrez Bootstrap, choisissez « Install » et attendez la fin de l'installation.",
      "Ouvrez le gestionnaire de paquets (Sileo/Zebra) pour ajouter les dépôts et les tweaks compatibles.",
      "Pour injecter dans les applications système, complétez avec un semi-jailbreak compatible avec votre version.",
    ],
    risks: [
      "Un bootstrap n'est pas un jailbreak complet : l'accès au système reste limité.",
      "Mélanger des tweaks incompatibles peut provoquer des boucles de démarrage ; sauvegardez avant.",
      "La désinstallation laisse parfois des fichiers résiduels qu'il faut retirer manuellement.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/roothide/Bootstrap" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Bootstrap_(App)" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "README roothide/Bootstrap 2.2.1",
  },
  {
    id: "serotonin",
    name: "Serotonin",
    kind: "semi-jailbreak",
    status: "abandonne",
    recommended: false,
    summary:
      "Semi-jailbreak fondé sur l'exploit kfd pour iOS 16.0 à 16.6.1 : il ajoute l'injection dans les processus système au-dessus du bootstrap roothide. Dépassé, car Dopamine couvre désormais ces versions.",
    lastRelease: "Non maintenu depuis 2024",
    exploit: "kfd (kernel file descriptor) + bootstrap roothide",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal — nécessite TrollStore et le bootstrap déjà installés",
    requires: ["TrollStore", "roothide Bootstrap installé", "Version iOS 16.0 à 16.6.1"],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS, ...A14_A17_CHIPS, ...APPLE_SILICON_M1_M2],
        min: "16.0",
        max: "16.6.1",
        note: "La version publiée visait 16.2–16.6.1 ; des correctifs communautaires ont étendu le bas de plage.",
      },
    ],
    steps: [
      "Installez TrollStore puis le bootstrap roothide sur l'appareil.",
      "Téléchargez le paquet .tipa depuis la page de publication du projet.",
      "Ouvrez-le dans TrollStore, lancez Serotonin et appuyez sur « Jailbreak ».",
      "Redémarrez le SpringBoard si demandé, puis administrez les tweaks depuis Sileo.",
    ],
    risks: [
      "Injecter des tweaks sans jailbreak complet augmente le risque de boucle de démarrage.",
      "Projet à l'arrêt : préférez Dopamine, qui prend en charge ces versions proprement.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/hrtowii/Serotonin" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Serotonin" },
    ],
    supersededBy: "dopamine",
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Publication communautaire + fiche The Apple Wiki",
  },
  {
    id: "xinaa15",
    name: "XinaA15",
    kind: "semi-untethered",
    status: "abandonne",
    recommended: false,
    summary:
      "Premier jailbreak public d'iOS 15 (rootful, semi-untethered) sur les puces A12 à A15 et M1, limité à iOS 15.0–15.4.1. Abandonné depuis 2023.",
    lastRelease: "2.1.5.2 — 14 décembre 2023",
    exploit: "Exploit noyau d'iOS 15 (série kfd/weightBufs selon la version)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA (certificat ou installeur)", "Version iOS 15.0 à 15.4.1"],
    rules: [
      {
        chips: ["A12", "A12X", "A12Z", "A13", "A14", "A15", "M1"],
        min: "15.0",
        max: "15.4.1",
      },
    ],
    steps: [
      "Vérifiez la version iOS : strictement 15.0 à 15.4.1.",
      "Sideloadez l'IPA officiel avec un certificat ou un installeur.",
      "Lancez l'application et suivez la procédure de jailbreak, puis redémarrez le SpringBoard.",
    ],
    risks: [
      "Non maintenu : aucune correction depuis fin 2023.",
      "Dopamine couvre les mêmes versions avec un état rootless mieux supporté : préférez-le.",
      "Bannissement possible de certains services Apple (Apple Pay, iMessage) en mode rootful.",
    ],
    sources: [
      { label: "Site officiel", url: "https://zhuxinlang.github.io/" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/XinaA15" },
    ],
    supersededBy: "dopamine",
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Site officiel XinaA15 + fiche The Apple Wiki",
  },
  {
    id: "fugu15",
    name: "Fugu15",
    kind: "semi-untethered",
    status: "recherche",
    recommended: false,
    summary:
      "Preuve de concept destinée à la recherche, à l'origine de Dopamine. Elle ne fournit ni gestionnaire de paquets ni injection de tweaks et n'est pas prévue pour un usage quotidien.",
    lastRelease: "Démonstration de recherche (2022), non maintenue",
    exploit: "Chaîne d'exploits iOS 15.0–15.4.1 (PUB exploit, kfd côté noyau)",
    persistence: "Aucune persistance durable : outil de démonstration",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Environnement de développement (Xcode) pour l'installation", "Compte développeur"],
    rules: [
      {
        chips: [...A12_A13_CHIPS, ...A14_A17_CHIPS, ...APPLE_SILICON_M1_M2],
        min: "15.0",
        max: "15.4.1",
        note: "Périmètre de démonstration : à confirmer sur le dépôt, aucune garantie appareil par appareil.",
      },
    ],
    steps: [
      "Utilisez de préférence Dopamine, qui en dérive et ajoute la gestion des paquets.",
      "Si vous étudiez la recherche : compilez et installez le projet depuis le dépôt officiel avec Xcode.",
      "N'attendez pas de stabilité ni de tweaks : Fugu15 n'est pas un environnement utilisateur.",
    ],
    risks: [
      "Outil de recherche : aucune assistance, aucun correctif, comportement non déterministe.",
      "Aucun gestionnaire de paquets ; l'injection de tweaks n'est pas prise en charge.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/LinusHenze/Fugu15" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Fugu15" },
    ],
    supersededBy: "dopamine",
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt officiel Fugu15 + fiche The Apple Wiki",
  },
  {
    id: "unc0ver",
    name: "unc0ver",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak historique d'iOS 11 à iOS 14.8, très utilisé sur iOS 12–14. Le dernier correctif date de 2021 et la couverture varie fortement selon la puce.",
    lastRelease: "8.0.2 — 30 décembre 2021",
    exploit: "Selon la version : kfd, Fugu14, checkm8, exploits noyau d'iOS 11–14",
    persistence: "Semi-untethered ; l'application doit être resignée régulièrement (7 jours avec un compte gratuit)",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: [
      "Sideload de l'IPA (AltStore, Sideloadly, certificat)",
      "Sur iOS 14.4 et plus, Fugu14 est nécessaire pour certaines combinaisons",
      "Puce A8 à A13 : la puce A14 n'est pas prise en charge",
    ],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS],
        min: "11.0",
        max: "14.8",
        note: "Selon la puce : jusqu'à 14.3 (voire 14.5.1) pour la majorité des appareils ; 14.6–14.8 uniquement sur A12/A13 avec la version 8.0.x.",
      },
    ],
    steps: [
      "Vérifiez la combinaison exacte puce + version iOS sur la fiche de référence : elle est déterminante.",
      "Installez un certificat de développement ou un installeur (AltStore, Sideloadly…).",
      "Sideloadez l'IPA unc0ver correspondant, ouvrez-le et appuyez sur « Jailbreak » ; plusieurs tentatives sont normales.",
      "Si l'appareil redémarre, relancez l'application pour revenir en état jailbreaké.",
    ],
    risks: [
      "Projet à l'arrêt depuis 2021 : aucune correction de sécurité.",
      "Certificat gratuit de 7 jours : l'application cesse de fonctionner sans resignature.",
      "L'exploit modifie le comportement du noyau : désactivez les fonctions sensibles si une instabilité apparaît.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/pwn20wndstuff/Undecimus" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Unc0ver" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt Undecimus + fiche The Apple Wiki",
  },
  {
    id: "checkra1n",
    name: "checkra1n",
    kind: "semi-tethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak checkm8 semi-tethered sur les appareils A7 à A11 (iPhone 5s à X) pour iOS 12.0 à 14.8.1. Ancêtre de palera1n, figé depuis 2021.",
    lastRelease: "0.12.4 — 2020 (support macOS/Linux)",
    exploit: "checkm8 (bootrom) via checkra1n loader",
    persistence: "Semi-tethered : ordinateur nécessaire après chaque redémarrage",
    hosts: ["macos", "linux"],
    deviceMode: "DFU obligatoire",
    requires: [
      "Ordinateur macOS ou Linux",
      "Appareil A7 à A11 (iPhone 5s → iPhone X, iPad compatibles, iPod touch 6/7)",
      "Sauvegarde récente",
    ],
    rules: [
      {
        chips: ["A7", ...CHECKM8_CHIPS],
        min: "12.0",
        max: "14.8.1",
        note: "Sur iOS 14.8.1, certains modèles demandent de désactiver le code d'accès.",
      },
    ],
    steps: [
      "Depuis macOS ou Linux, lancez checkra1n puis placez l'appareil en DFU lorsque l'outil le demande.",
      "Sélectionnez les options souhaitées (par exemple « Allow untested iOS versions » au besoin).",
      "Ouvrez l'application checkra1n sur l'appareil et lancez l'installation de Cydia.",
      "Après chaque redémarrage, relancez l'outil depuis l'ordinateur.",
    ],
    risks: [
      "Version figée : ne couvre ni iOS 15 ni les appareils A12 et plus récents.",
      "Windows n'est pas pris en charge par l'outil officiel.",
      "Sur les appareils A10/A10X et A11, le code d'accès doit être désactivé en état jailbreaké.",
    ],
    sources: [
      { label: "Site officiel", url: "https://checkra.in/" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Checkra1n" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Site officiel checkra1n + fiche The Apple Wiki",
  },
  {
    id: "taurine",
    name: "Taurine",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered de l'équipe Odyssey couvrant tout iOS 14.0 à 14.8.1, y compris les toutes dernières versions d'iOS 14 grâce à kfd.",
    lastRelease: "1.1.7 — 18 septembre 2023",
    exploit: "Exploits noyau d'iOS 14 (dont kfd pour 14.4–14.8.1)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA (AltStore, Sideloadly, certificat)", "Version iOS 14.0 à 14.8.1"],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS],
        min: "14.0",
        max: "14.8.1",
      },
    ],
    steps: [
      "Sideloadez l'IPA Taurine avec un certificat ou un installeur.",
      "Ouvrez l'application et appuyez sur « Jailbreak ».",
      "Si nécessaire, choisissez de restaurer l'environnement jailbreaké (restore rootfs) avant de recommencer.",
    ],
    risks: [
      "Projet en veille depuis 2023.",
      "Certificat gratuit de 7 jours : resignature nécessaire.",
      "Sur iOS 14.4 et plus, l'injection des tweaks anciens (Old ABI) est limitée.",
    ],
    sources: [
      { label: "Site officiel", url: "https://taurine.app/" },
      { label: "Code source (GitHub)", url: "https://github.com/Odyssey-Team/Taurine" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Taurine" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Notes de version Taurine + fiche The Apple Wiki",
  },
  {
    id: "odyssey",
    name: "Odyssey",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered de l'équipe Odyssey pour iOS 13.0 à 13.7, avec Sileo et libhooker comme base d'injection.",
    lastRelease: "1.4.2 — 2021",
    exploit: "Exploits noyau d'iOS 13 (série 0x44…)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Version iOS 13.0 à 13.7"],
    rules: [
      {
        chips: [...CHECKM8_CHIPS, ...A12_A13_CHIPS],
        min: "13.0",
        max: "13.7",
      },
    ],
    steps: [
      "Sideloadez l'IPA Odyssey avec un certificat ou un installeur.",
      "Ouvrez l'application et lancez le jailbreak.",
      "Après un redémarrage, relancez l'application pour réactiver l'état jailbreaké.",
    ],
    risks: [
      "Non maintenu : unc0ver ou checkra1n couvrent aussi iOS 13 avec plus de tests.",
      "Certificat gratuit de 7 jours.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/Odyssey-Team/Odyssey" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Odyssey" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt Odyssey-Team + fiche The Apple Wiki",
  },
  {
    id: "chimera",
    name: "Chimera",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered de CoolStar pour iOS 12.0 à 12.5.8 sur les appareils A7 à A11 ; la prise en charge des puces A12 se limite aux premières versions d'iOS 12.",
    lastRelease: "1.6.4 — 2020 (dernière évolution publique)",
    exploit: "Exploits noyau d'iOS 12 (série 0x44…), libhooker",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Version iOS 12.0 à 12.5.8"],
    rules: [
      {
        chips: ["A7", ...CHECKM8_CHIPS, ...A12_A13_CHIPS],
        min: "12.0",
        max: "12.5.8",
        note: "Sur A12 (XS/XR), seules les versions 12.0 à 12.1.2 sont couvertes ; unc0ver prend le relais ensuite.",
      },
    ],
    steps: [
      "Sideloadez l'IPA Chimera avec un certificat ou un installeur.",
      "Lancez le jailbreak depuis l'application, puis installez Sileo.",
      "Après un redémarrage, relancez l'application pour retrouver l'état jailbreaké.",
    ],
    risks: [
      "A12 : couverture limitée aux premières versions d'iOS 12.",
      "Projet abandonné depuis 2020.",
    ],
    sources: [
      { label: "Paquets officiels (GitHub)", url: "https://github.com/coolstar/chimera-ipas" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Chimera" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Notes de version CoolStar + fiche The Apple Wiki",
  },
  {
    id: "electra",
    name: "Electra",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered de CoolStar pour iOS 11.0 à 11.4.1, avec Cydia puis Sileo selon les versions.",
    lastRelease: "1.3.2 — 2018",
    exploit: "Exploits noyau d'iOS 11 (async_wake, multipath, vfs…)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Version iOS 11.0 à 11.4.1"],
    rules: [
      {
        chips: ["A7", ...CHECKM8_CHIPS],
        min: "11.0",
        max: "11.4.1",
      },
    ],
    steps: [
      "Sideloadez l'IPA Electra avec un certificat ou un installeur.",
      "Lancez « Jailbreak » depuis l'application et attendez la fin de l'installation.",
      "Après un redémarrage, relancez l'application pour réactiver l'état jailbreaké.",
    ],
    risks: [
      "Projet abandonné : checkra1n couvre aussi iOS 11.0–11.4.1 sur A7–A11.",
      "Certificat gratuit de 7 jours.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/coolstar/Electra" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Electra" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt CoolStar + fiche The Apple Wiki",
  },
  {
    id: "meridian",
    name: "Meridian",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered pour iOS 10.0 à 10.3.3 sur appareils 64 bits, resté populaire après la fin d'iOS 10.",
    lastRelease: "0.9-9 (bêta) — 2018",
    exploit: "Exploits noyau d'iOS 10 (série v0rtex/extra_recipe selon la version)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Version iOS 10.0 à 10.3.3"],
    rules: [
      {
        chips: ["A7", ...CHECKM8_CHIPS],
        min: "10.0",
        max: "10.3.3",
      },
    ],
    steps: [
      "Sideloadez l'IPA Meridian avec un certificat ou un installeur.",
      "Lancez le jailbreak et choisissez le gestionnaire de paquets (Cydia ou Sileo selon la version).",
      "Après un redémarrage, relancez l'application.",
    ],
    risks: [
      "Resté en bêta ; certaines fonctions (Sileo avec Cydia Substrate) sont limitées.",
      "Sur iPhone 7, préférez extra_recipe ou Meridian pour iOS 10.1.1.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/PsychoTea/meridian" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Meridian" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt PsychoTea + fiche The Apple Wiki",
  },
  {
    id: "yalu",
    name: "Yalu (yalu102)",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered d'iOS 10.0.2 à 10.2, historique pour les appareils 64 bits hors iPhone 7 (couvert par extra_recipe).",
    lastRelease: "yalu102 bêta 7 — 2017",
    exploit: "Exploit noyau d'iOS 10 (mach_portal, projet de Ian Beer)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Version iOS 10.0.2 à 10.2"],
    rules: [
      {
        chips: ["A7", "A8", "A8X", "A9", "A9X"],
        min: "10.0.2",
        max: "10.2",
        note: "iPhone 7 / iPhone 7 Plus (A10) : utilisez extra_recipe ou Yalu bêta pour iOS 10.1.1.",
      },
    ],
    steps: [
      "Sideloadez l'IPA yalu102 avec un certificat ou un installeur.",
      "Ouvrez l'application, appuyez sur « go » et attendez le redémarrage du système.",
      "Relancez l'application après chaque redémarrage pour réactiver l'état jailbreaké.",
    ],
    risks: [
      "Resté en bêta, crashs fréquents de l'application.",
      "Ne couvre pas l'iPhone 7 ni iOS 10.3.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/kpwn/yalu102" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Yalu" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt kpwn/yalu102 + fiche The Apple Wiki",
  },
  {
    id: "h3lix",
    name: "h3lix",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered pour les appareils 32 bits (iPhone 5 / 5c, iPad 4) restés sous iOS 10, jusqu'à 10.3.4.",
    lastRelease: "Bêta — 2018 (rc8)",
    exploit: "Exploit noyau d'iOS 10 (double v0rtex)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal",
    requires: ["Sideload de l'IPA", "Appareil 32 bits sous iOS 10"],
    rules: [
      {
        chips: ["A6", "A6X"],
        min: "10.0",
        max: "10.3.4",
        note: "iOS 10.3.4 ne concerne que l'iPad 4, dernier appareil 32 bits mis à jour par Apple.",
      },
    ],
    steps: [
      "Sideloadez l'IPA h3lix avec un certificat ou un installeur.",
      "Lancez le jailbreak et laissez l'installation se terminer.",
      "Après un redémarrage, relancez l'application.",
    ],
    risks: [
      "Appareils 32 bits uniquement (iPhone 5/5c, iPad 4).",
      "Les outils modernes, les certificats actuels et de nombreux dépôts ne fonctionnent plus.",
    ],
    sources: [{ label: "Fiche de référence", url: "https://theapplewiki.com/wiki/H3lix" }],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Fiche The Apple Wiki",
  },
  {
    id: "pangu9",
    name: "Pangu 9",
    kind: "untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak untethered d'iOS 9 (9.0 à 9.3.3 selon les variantes), distribué pour Windows et macOS.",
    lastRelease: "1.3.1 — 2016",
    exploit: "Exploits noyau d'iOS 9 (série IOMobileFramebuffer, etc.)",
    persistence: "Untethered : survit aux redémarrages",
    hosts: ["windows", "macos"],
    deviceMode: "Normal — appareil démarré et déverrouillé",
    requires: ["Windows ou macOS avec iTunes", "Version iOS 9.0 à 9.3.3 selon la variante"],
    rules: [
      {
        chips: ["A5", "A5X", "A6", "A6X", "A7", "A8", "A8X", "A9", "A9X"],
        min: "9.0",
        max: "9.3.3",
        note: "9.0–9.1 avec Pangu 9, 9.2–9.3.3 avec Pangu 9.3.3 (64 bits) ; 9.3.4–9.3.6 via Home Depot ou Phœnix.",
      },
    ],
    steps: [
      "Reliez l'appareil à un PC avec iTunes et une sauvegarde non chiffrée disponible.",
      "Lancez Pangu depuis l'ordinateur et suivez l'assistant jusqu'au redémarrage.",
      "Vérifiez l'accès SSH/Cydia installé par l'outil.",
    ],
    risks: [
      "Outils d'une autre époque : dépôts et certificats largement hors service.",
      "L'outil envoie les identifiants Apple sur un serveur tiers dans certaines versions : à éviter absolument aujourd'hui.",
    ],
    sources: [{ label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Pangu9" }],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Fiche The Apple Wiki",
  },
  {
    id: "home-depot",
    name: "Home Depot",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered pour les appareils 32 bits sous iOS 9.1 à 9.3.4, lancé depuis Safari sur l'appareil.",
    lastRelease: "Version 0.1 — 2017",
    exploit: "Exploits noyau d'iOS 9 (série mach_portal/kernel)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal — installation via le navigateur",
    requires: ["Appareil 32 bits sous iOS 9.1 à 9.3.4"],
    rules: [
      { chips: ["A5", "A5X", "A6", "A6X"], min: "9.1", max: "9.3.4" },
    ],
    steps: [
      "Désactivez le verrouillage de l'écran et enregistrez un favori vers l'installeur Home Depot.",
      "Lancez l'installation depuis Safari et laissez l'appareil redémarrer.",
      "Après un redémarrage, relancez la page ou l'application pour réactiver l'état jailbreaké.",
    ],
    risks: [
      "Appareils 32 bits uniquement.",
      "Aucun support, aucun dépôt moderne compatible.",
    ],
    sources: [{ label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Home_Depot" }],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Fiche The Apple Wiki",
  },
  {
    id: "phoenix",
    name: "Phœnix",
    kind: "semi-untethered",
    status: "en-veille",
    recommended: false,
    summary:
      "Jailbreak semi-untethered pour les appareils 32 bits bloqués en iOS 9.3.5 et 9.3.6, souvent utilisé pour ressusciter un iPhone 4S ou un iPad 2/3.",
    lastRelease: "1.0 — 2017",
    exploit: "Exploits noyau d'iOS 9.3.5 (double v0rtex)",
    persistence: "Semi-untethered : à relancer après redémarrage",
    hosts: ["appareil"],
    deviceMode: "Normal — dépend d'un certificat de signature",
    requires: ["Appareil 32 bits sous iOS 9.3.5/9.3.6", "Certificat de développement pour signer l'IPA"],
    rules: [
      { chips: ["A5", "A5X", "A6", "A6X"], min: "9.3.5", max: "9.3.6" },
    ],
    steps: [
      "Signez et sideloadez l'IPA Phœnix depuis un ordinateur.",
      "Lancez le jailbreak depuis l'application.",
      "Après un redémarrage, relancez l'application pour réactiver l'état jailbreaké.",
    ],
    risks: [
      "Signature de 7 jours (certificat gratuit) : resignature nécessaire.",
      "Ne couvre que les appareils 32 bits sous 9.3.5 et 9.3.6.",
    ],
    sources: [
      { label: "Code source (GitHub)", url: "https://github.com/Siguza/phoenix" },
      { label: "Fiche de référence", url: "https://theapplewiki.com/wiki/Ph%C5%93nix" },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "Dépôt Siguza/phoenix + fiche The Apple Wiki",
  },
  {
    id: "variantes-recentes",
    name: "Variantes récentes et outils complémentaires (2024–2026)",
    kind: "bootstrap",
    status: "recherche",
    recommended: false,
    summary:
      "Famille d'outils complémentaires : variantes roothide de Dopamine et palera1n, semi-jailbreaks iOS 16/17 (NathanLR, Def1nit3lyN0tAJa1lbr3akTool), outils kfd iOS 15 (meowbrek2, nekoJB, bakera1n) et bootstraps dérivés.",
    lastRelease: "Versions publiées entre 2024 et 2026",
    exploit: "Variable selon l'outil (kfd, CoreTrust, variantes roothide)",
    persistence: "Variable : ces outils sont des bootstraps ou des semi-jailbreaks",
    hosts: ["appareil"],
    deviceMode: "Normal — la plupart s'installent via TrollStore",
    requires: ["Consulter la page de référence de chaque outil avant tout usage"],
    rules: [],
    steps: [],
    risks: [
      "Projets souvent non documentés : provenance et maintenance à vérifier au cas par cas.",
      "Les variantes roothide ne se désinstallent pas toujours proprement ; sauvegardez avant.",
    ],
    sources: [{ label: "Fiche de référence", url: APPLE_WIKI_JAILBREAK }],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "The Apple Wiki — inventaire par version iOS",
  },
  {
    id: "historiques-inventaire",
    name: "Méthodes historiques antérieures (iOS 3 à 8)",
    kind: "untethered",
    status: "abandonne",
    recommended: false,
    summary:
      "Inventaire de référence : TaiG (8.0–8.4), evasi0n7 et Pangu (7.0–7.1.2), evasi0n et p0sixspwn (6.0–6.1.6), Absinthe (5.0.1–5.1.1), JailbreakMe (4.0–4.3.3), redsn0w, limera1n, greenpois0n et blackra1n (iOS 3–4), EtasonJB (8.4.1), Carbon, Blizzard, EverPwnage, p0laris, kok3shi9, Aquila, Lyncis…",
    lastRelease: "Aucune de ces méthodes n'est maintenue",
    exploit: "Historique (bootrom, noyau, navigateur) selon la génération concernée",
    persistence: "Variable : untethered pour la plupart des versions de cette époque",
    hosts: ["windows", "macos", "appareil"],
    deviceMode: "Variable selon l'outil",
    requires: ["Un appareil bloqué sur une version aussi ancienne n'a d'intérêt que patrimonial ou de recherche"],
    rules: [],
    steps: [],
    risks: [
      "Outils obsolètes, non maintenus et parfois retirés du réseau.",
      "Ne les utilisez pas pour un appareil en usage quotidien : dépôts, certificats et services ont disparu.",
      "Aucune de ces méthodes ne concerne un iPhone ou un iPad récent.",
    ],
    sources: [
      { label: "Inventaire par version", url: APPLE_WIKI_JAILBREAK },
      { label: "Guide communautaire", url: IOS_CFW_GUIDE },
    ],
    verifiedAt: CATALOGUE_VERIFIED_AT,
    verifiedFrom: "The Apple Wiki — inventaire par version iOS",
  },
];

export function getMethod(id: string): JailbreakMethod | null {
  return JAILBREAK_METHODS.find((method) => method.id === id) ?? null;
}
