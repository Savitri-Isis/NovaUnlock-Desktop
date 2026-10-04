# NovaUnlock Desktop

Application Windows de **diagnostic, sauvegarde et restauration iOS officielle**. NovaUnlock accompagne uniquement les appareils que l'utilisateur est autorisé à administrer : lecture d'informations via USB, sauvegardes locales chiffrées, guidage DFU/Recovery et restauration d'IPSW signés par Apple.

> NovaUnlock ne contourne jamais un code d'accès, iCloud / Activation Lock ou une SIM. Une restauration efface les données et peut toujours exiger l'identifiant Apple du propriétaire à l'écran d'activation.

---

## Architecture

```text
NovaUnlock Desktop
├── electron/
│   ├── src/main.ts                 # Processus principal Electron et IPC validé
│   ├── src/master-service.ts        # Prévol, inventaire de backups et audit haché
│   ├── src/master-executor.ts       # Actions confirmées (diagnostic / backup / restore)
│   ├── src/master-operation-manager.ts # Suivi des opérations longues
│   ├── src/native-tools.ts          # Capacités et import sûr du payload natif
│   └── src/usb-scanner.ts           # Couche libimobiledevice / USB
├── electron/preload/                # Bridge context-isolated
├── src/                             # Interface React
│   └── lib/jailbreak/               # Catalogue documentaire des méthodes de jailbreak
├── native/libimobiledevice/         # Documentation + payload Windows local (ignoré par Git)
└── scripts/                         # Staging et vérification avant packaging
```

---

## Prérequis

- Windows 10/11 x64
- Pour l’installation et l’utilisation de l’application déjà construite, voir [`INSTALLATION_WINDOWS.md`](INSTALLATION_WINDOWS.md).
- Pour compiler : Node.js **x64**, branche **22 à partir de 22.22.2** ou **24 à partir de 24.15.0** (versions compatibles avec les dépendances verrouillées ; Node 18 n’est plus suffisant). Node.js n’est pas nécessaire pour utiliser l’application déjà installée.
- Un câble USB compatible
- Apple Devices ou iTunes / Apple Mobile Device USB Driver pour l'appairage en mode Normal
- Pour un installateur complet : les outils natifs Windows x64 de `libimobiledevice` (exécutables **et** DLL compatibles). Ils peuvent être compilés depuis les sources avec la procédure ci-dessous ; aucun iPhone n’est nécessaire pour cette étape.

### Construire les outils natifs depuis les sources officielles (Windows)

Si vous ne disposez pas déjà d’un paquet natif de confiance, vous n’avez pas à assembler manuellement les `.exe` et DLL : le dépôt contient un constructeur MSYS2, suivant la méthode de compilation Windows décrite par le projet [libimobiledevice](https://libimobiledevice.org/#get-started-windows-source). Il récupère des versions amont épinglées dans [`scripts/native-sources.lock`](scripts/native-sources.lock), vérifie les identifiants de commit, compile les projets dans MSYS2 UCRT64, collecte les DLL d’exécution requises et génère les notices/licences.

1. Installez **MSYS2 x64** depuis [msys2.org](https://www.msys2.org/) (installation par défaut : `C:\msys64`).
2. Dans **MSYS2 UCRT64**, mettez MSYS2 à jour avec `pacman -Syu`. Si le terminal se ferme, rouvrez-le et relancez la mise à jour jusqu’à ce qu’elle soit terminée.
3. Dans l’Explorateur Windows, double-cliquez sur **`Construire-outils-libimobiledevice-Windows.cmd`** et gardez la fenêtre ouverte. Une connexion Internet est nécessaire pour les paquets de compilation et les sources amont.
4. Après le message de réussite, double-cliquez sur **`Creer-installateur-Windows.cmd`** pour construire l’application et son installateur.

Le script ne télécharge pas d’exécutables `libimobiledevice` précompilés et ne lance aucune commande sur un appareil. Il place le payload local dans `native/libimobiledevice` et les journaux d’échec dans `.native-build/logs`; les binaires natifs et l’avis généré sont ignorés par Git par défaut. Les sources sont compilées sur le PC Windows et ne sont pas vérifiées matériellement dans le sandbox.

**Compilation native de `idevicerestore` sous Windows** : la version amont 1.0.0 ne se compile pas telle quelle sous MSYS2. Le constructeur applique trois correctifs locaux, versionnés dans [`scripts/patches`](scripts/patches) et appliqués après vérification du commit épinglé, **avant** la génération de `configure` et des `Makefile` :

- `argument to '-O' should be a non-negative integer` : `configure.ac` colle `-O2` et `-DWIN32` ;
- `storage size of 'fst' isn't known` ou `implicit declaration of function 'stat'` : `src/common.h` masque `<sys/stat.h>` quand `WIN32` est défini ;
- échec d’édition de liens sur les symboles winsock (`socket`, `htons`, …) : `src/Makefile.am` ne lie pas `ws2_32`, utilisé par `src/socket.c`.

Récupérez les fichiers du dépôt à jour (y compris `scripts/patches`), puis relancez `Construire-outils-libimobiledevice-Windows.cmd`. Aucune suppression manuelle du dossier temporaire n’est nécessaire. Les journaux de compilation affichent les commandes complètes (`make V=1`) et sont conservés dans `.native-build/logs` en cas d’échec. Un correctif qui ne s’applique plus (version amont modifiée, correctif déjà appliqué) arrête la construction au lieu d’être ignoré.

Le constructeur désactive aussi l’avis Git **detached HEAD** pour ses propres clones (`git -c advice.detachedHead=false`) : votre configuration Git personnelle n’est jamais modifiée. Pour le désactiver globalement (facultatif) : `git config --global advice.detachedHead false`.

Si MSYS2 est installé ailleurs que `C:\msys64`, définissez `MSYS2_ROOT` sur son dossier avant de lancer le fichier `.cmd`.

### Créer l’installateur sans saisir de commandes (Windows)

1. Récupérez le **projet complet** sur votre PC, par exemple dans `C:\Users\hp\NovaUnlock-Desktop`. Ne déplacez pas le lanceur seul.
2. Installez une version compatible de **Node.js x64** depuis [nodejs.org](https://nodejs.org), si nécessaire.
3. Préparez les outils natifs : construisez-les avec `Construire-outils-libimobiledevice-Windows.cmd` (section précédente), ou obtenez un paquet Windows x64 de confiance avec toutes ses DLL et licences.
4. Dans l’Explorateur Windows, double-cliquez sur **`Creer-installateur-Windows.cmd`**.
5. Si vous utilisez un paquet déjà extrait, choisissez son dossier lorsque le sélecteur s’ouvre ; si le constructeur MSYS2 a préparé `native/libimobiledevice`, aucun sélecteur n’est nécessaire. Gardez la fenêtre ouverte jusqu’à la fin.

Le lanceur se place lui-même dans le dossier du projet, contrôle Node/npm, prépare et vérifie les fichiers natifs, installe les dépendances verrouillées avec `npm ci --include=dev`, puis lance `package:win`. Il s’arrête à la première erreur. La fenêtre reste ouverte pour lire les messages ; en cas d’annulation du sélecteur, aucune copie, installation de dépendances ou compilation n’est lancée.

Un paquet complet déjà présent dans `native/libimobiledevice` est réutilisé. Une variable `NOVAUNLOCK_NATIVE_DIR` déjà définie permet de le remplacer sans ouvrir le sélecteur. La source de remplacement doit être complète : les anciens fichiers de destination ne peuvent pas masquer les fichiers manquants dans la source.

Si le dossier choisi ne contient pas le paquet extrait, l’assistant ne s’arrête plus sur une seule ligne : il affiche ce qui a été examiné (nombre de sous-dossiers, de `.exe` et de DLL), les outils manquants et les archives détectées, puis rouvre le sélecteur (trois essais au maximum, fermeture du sélecteur pour annuler).

Deux pièges fréquents sont traités automatiquement :

- **le paquet est encore dans son archive ZIP** : si une archive au nom évocateur (`libimobiledevice`, `idevice`, `irecovery`, `ios`, `iphone`, `ipad`, `apple`) se trouve dans le dossier choisi, elle est extraite localement avec le même préparateur que `prepare:native:archive` — aucun téléchargement, aucun fichier exécuté, et le contenu est vérifié avant toute copie ;
- **seuls les `.exe` ont été copiés** : le message rappelle que les DLL d’exécution doivent accompagner les `.exe` dans le même dossier, et indique où des DLL ont été trouvées.

L’erreur `le dossier ne contient pas ideviceinfo.exe et idevice_id.exe` signifie donc toujours que la sélection ne contient pas les binaires extraits : choisissez le sous-dossier qui contient réellement les `.exe` et les `.dll` (souvent `bin`), ou l’archive ZIP complète.

À la fin, l’Explorateur ouvre **`release`**, qui contient deux fichiers distincts :

- `NovaUnlock-Setup-<version>-x64.exe` : installateur Windows ;
- `NovaUnlock-Portable-<version>-x64.exe` : application portable.

Une connexion Internet est nécessaire pour les dépendances npm et les composants de compilation téléchargés par Electron Builder. Aucun changement de la politique PowerShell ni installation automatique de Node.js ou de pilotes Apple n’est effectué. Ne lancez qu’une construction à la fois dans un même dossier.

### Construire l’installateur `.exe` avec GitHub Actions (sans PC Windows)

Le dépôt contient le workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) : GitHub met à disposition un « bâtisseur » Windows virtuel qui applique la même procédure que la section précédente, puis publie les fichiers `.exe`. Aucune installation locale de MSYS2, de Node.js ou d’Electron n’est alors nécessaire.

1. Poussez le projet sur GitHub (dépôt `Savitri-Isis/NovaUnlock-Desktop`).
2. Ouvrez l’onglet **Actions**, choisissez le workflow **Construire l’installateur Windows**, puis **Run workflow** (branche `main`).
3. Attendez la fin des trois travaux : *Lint et tests unitaires* (Ubuntu, rapide), *Outils natifs libimobiledevice (MSYS2 UCRT64)* (compilation depuis les sources épinglées, la plus longue) et *Installateur et version portable (.exe)*.
4. Téléchargez l’artefact **NovaUnlock-Windows-x64** en bas de la page de l’exécution : il contient `NovaUnlock-Setup-<version>-x64.exe`, `NovaUnlock-Portable-<version>-x64.exe` et `SHA256SUMS.txt` (conservé 30 jours).

Pour obtenir en plus une **Release** (page de téléchargement permanente), créez une étiquette égale à la version de [`package.json`](package.json) :

```bash
git tag v1.0.0
git push origin v1.0.0
```

Le workflow refuse une étiquette qui ne correspond pas à `package.json` (`v1.0.1` pour une version `1.0.0`) au lieu de livrer des fichiers mal nommés : aucun fichier n’est publié dans ce cas. Une étiquette cohérente publie les deux `.exe` et `SHA256SUMS.txt` dans **Releases**.

Le workflow reprend la procédure locale sans en retirer aucune garantie :

- les outils `libimobiledevice` sont compilés par [`scripts/build-native-msys2.sh`](scripts/build-native-msys2.sh) dans MSYS2 UCRT64, depuis les versions et commits épinglés de [`scripts/native-sources.lock`](scripts/native-sources.lock), avec les correctifs de [`scripts/patches`](scripts/patches) ; **aucun exécutable `libimobiledevice` précompilé n’est téléchargé ni exécuté** ;
- ce sont les commandes npm du dépôt qui s’exécutent : `npm ci --include=dev`, `npm test`, `npm run package:win` (`verify:native` compris), et les six outils natifs attendus sont vérifiés avant puis après le transfert du payload entre les deux travaux Windows ;
- seules des actions épinglées à une version majeure sont utilisées (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `msys2/setup-msys2@v2`) ; le jeton GitHub reste en lecture seule partout, sauf pour la seule étape qui crée la Release.

Précautions et limites :

- les fichiers produits ne sont **pas signés** : Windows SmartScreen peut afficher un avertissement, et la provenance doit être vérifiée ; comparez l’empreinte du fichier téléchargé avec `SHA256SUMS.txt` avant d’installer ;
- une **demande de fusion** ne lance que le lint et les tests : la compilation native dure plusieurs dizaines de minutes et n’est déclenchée que sur `main`, sur une étiquette ou à la demande ;
- la **première** construction est la plus longue (huit projets amont compilés) ; le payload natif obtenu est ensuite mis en cache par GitHub sous une clé qui contient l’empreinte de [`scripts/native-sources.lock`](scripts/native-sources.lock) et des correctifs : une reconstruction à sources identiques ne recompile rien, alors qu’une modification des sources épinglées déclenche une recompilation complète, sans jamais réutiliser un binaire d’une autre version ;
- en cas d’échec de la compilation native, les journaux sont conservés dans l’artefact `journaux-compilation-native` ;
- les empreintes SHA-256 calculées par le bâtisseur GitHub ne remplacent pas la vérification d’authenticité : elles prouvent seulement que le fichier publié n’a pas été modifié depuis sa construction.

### Configurer les outils depuis l’application

Dans **Paramètres** ou **Connexion USB**, l’**Assistant de configuration** contrôle automatiquement les fichiers disponibles. Cliquez sur **Configurer automatiquement**, puis sélectionnez le paquet extrait de confiance. La copie dans le répertoire utilisateur et la vérification finale s’enchaînent sans commandes, sans Node.js et sans modification de `Program Files`.

L’assistant affiche chaque exécutable requis et la présence de DLL. `ideviceenterrecovery.exe` reste facultatif. Vous pouvez annuler, réessayer en cas d’erreur ou cliquer sur **Revérifier** après une modification. Les fichiers fournis avec un installateur complet sont détectés sans réimportation.

> Ce contrôle vérifie la **présence des fichiers**, pas leur authenticité, leur architecture ni la compatibilité de toutes leurs DLL. Les pilotes Apple, le câble et l’appairage doivent encore être vérifiés à la connexion. Aucune action sur l’appareil n’est lancée par l’assistant.
>
> **Configuration et construction sont distinctes** : l’application installée configure ses outils USB ; la création du premier installateur se fait depuis les sources avec le lanceur Windows. L’application n’expose aucune commande de compilation au renderer.

### Préparer les binaires natifs manuellement (alternative)

Les `.exe`, `.dll` et archives ne sont pas committés dans Git. Avant un package Windows, obtenez et extrayez une distribution x64 validée par votre organisation, puis exécutez :

```powershell
$env:NOVAUNLOCK_NATIVE_DIR = "C:\chemin\vers\libimobiledevice-extrait"
npm run prepare:native
npm run verify:native
npm run package:win
```

Pour une archive ZIP complète fournie par une source approuvée, le dépôt fournit également un préparateur local (aucun téléchargement ni exécution des fichiers importés) :

```powershell
npm run prepare:native:archive -- "C:\chemin\vers\libimobiledevice-win-x64.zip"
npm run verify:native
```

Le préparateur vérifie la présence des six exécutables requis et des DLL, copie le payload et génère un manifeste SHA-256 local. Ce manifeste n’atteste pas l’authenticité du paquet : vérifiez sa provenance et ses licences avant emploi. Les commandes de packaging lancent déjà `verify:native` et échouent si un outil ou les DLL associées sont absents. Voir [`native/libimobiledevice/README.md`](native/libimobiledevice/README.md).

Un utilisateur d’une application déjà installée choisit le dossier extrait depuis **Connexion USB → Assistant de configuration → Configurer automatiquement** (également disponible dans **Paramètres**). Le payload est copié dans son répertoire utilisateur, sans écriture dans `Program Files`.

---

## Installation et développement

```bash
git clone https://github.com/Savitri-Isis/NovaUnlock-Desktop.git
cd NovaUnlock-Desktop
npm install
npm run dev:electron
```

Commandes disponibles :

```bash
npm run dev                    # Vite + compilation Electron en veille
npm run dev:electron           # Lance Vite puis Electron
npm run test                   # Tests unitaires / interface
npm run lint                   # ESLint
npm run build:all              # Compile sans produire d'installeur
npm run prepare:native         # Stage un payload local via NOVAUNLOCK_NATIVE_DIR
npm run verify:native          # Vérifie les outils/DLL avant packaging
npm run package:win            # Installateur NSIS et portable Windows x64
npm run package:win:assisted   # Assistant Windows (équivalent au double-clic .cmd)
npm run package:win:portable   # Binaire portable Windows x64 uniquement
```

Les fichiers d'installation sont produits dans `release/`.

Les correctifs Windows des sources natives disposent de tests hors ligne, lançables sans MSYS2 ni Windows :

```bash
bash scripts/tests/idevicerestore-cflags.sh      # -O2 et -DWIN32 restent séparés
bash scripts/tests/idevicerestore-win32-stat.sh  # stat/struct stat déclarés sous WIN32
bash scripts/tests/idevicerestore-win32-libs.sh  # ws2_32 lié pour socket.c
```

---

## Utilisation sûre

1. Ouvrez **Connexion USB**, branchez l'appareil, déverrouillez-le puis acceptez *Faire confiance à cet ordinateur*.
2. Lancez une détection. NovaUnlock ne considère l'appareil connecté qu'après une vérification réelle de l'endpoint sélectionné.
3. Dans **Application maîtresse**, choisissez une tâche puis lancez le prévol. Il vérifie notamment l'état USB, l'espace disponible, les sauvegardes, les capacités natives et l'Activation Lock en mode fail-closed.
4. Pour **Sauvegarder**, saisissez un mot de passe de sauvegarde d'au moins huit caractères. Il est transmis une seule fois à `idevicebackup2` et n'est ni conservé ni écrit dans le journal.
5. Pour une restauration officielle, placez l'appareil en Recovery/DFU, sélectionnez un fichier `.ipsw` signé, attestez votre autorisation et saisissez `EFFACER`. L'opération ne démarre qu'après ce second consentement explicite.

Le prévol est toujours non destructif (`dryRun: true`). L'action réelle est une seconde opération IPC, suivie avec progression et consignée dans un journal local à identifiants hachés et entrées chaînées.

### Limites assumées

- L'application ne peut pas mettre physiquement un iPhone en DFU : les séquences de boutons affichées doivent être suivies par l'utilisateur.
- Une sauvegarde exige un appareil démarré, déverrouillé et appairé. Une restauration officielle exige Recovery ou DFU et un IPSW que les serveurs Apple acceptent de signer.
- Si l'état Find My / Activation Lock ne peut pas être explicitement vérifié, NovaUnlock bloque les restaurations maître plutôt que de deviner.
- Aucune fonctionnalité ne contourne l'Activation Lock, iCloud, une SIM, Temps d'écran ou un code d'accès.

---

## Catalogue jailbreak et application assistée

L'écran **Assistant jailbreak** recense les méthodes publiques connues, calcule leur compatibilité avec
l'appareil détecté, puis **retient automatiquement la méthode adaptée** et propose l'action réellement
réalisable depuis ce PC Windows.

- **Périmètre** : Dopamine, palera1n, TrollStore, roothide Bootstrap, XinaA15, Serotonin, Fugu15,
  unc0ver, checkra1n, Taurine, Odyssey, Chimera, Electra, Meridian, Yalu, h3lix, Pangu 9, Home Depot,
  Phœnix, puis l'inventaire des méthodes antérieures (TaiG, evasi0n7, evasi0n, Absinthe, JailbreakMe,
  redsn0w, limera1n, greenpois0n, blackra1n, EtasonJB…) et des variantes 2024-2026.
- **Compatibilité** : la puce est déduite de l'identifiant matériel (`ProductType`, ex. `iPhone10,3`)
  ou choisie manuellement, puis comparée aux plages publiées par chaque projet. Trois verdicts sont
  affichés : compatible, hors plage (la puce est couverte, pas la version iOS) et non prise en charge.
- **Métadonnées vérifiées le [`CATALOGUE_VERIFIED_AT`](src/lib/jailbreak/methods.ts)** à partir des
  pages officielles des projets et de la fiche de référence
  [The Apple Wiki](https://theapplewiki.com/wiki/Jailbreak) ; chaque entrée rappelle sa date de
  vérification et sa source primaire.
- **Liens externes** : le renderer isolé ne peut ouvrir que les hôtes d'une liste blanche
  (`electron/src/external-links.ts`) — sites officiels des projets, guide communautaire `ios.cfw.guide`,
  `theapplewiki.com`, `github.com`, `ipsw.me` et les domaines Apple. Tout le reste est refusé.
- **Aucune charge utile** : NovaUnlock ne télécharge, n'installe et n'exécute aucun outil de jailbreak.
  Les étapes affichées sont exécutées par l'utilisateur, depuis les sources officielles, à ses risques.

### Sélection automatique et application assistée

1. Le renderer lit le profil réel de l'appareil (`ProductType` → puce, `ProductVersion` → version iOS),
   calcule les verdicts de compatibilité, puis retient la première méthode compatible selon
   `AUTO_PRIORITY` (`src/lib/jailbreak/execution.ts`). L'utilisateur peut toujours remplacer ce choix.
2. Le plan d'application décrit ce qui peut être fait :
   - **installation-ipa** : NovaUnlock installe sur l'appareil appairé l'IPA que l'utilisateur a
     téléchargé depuis la source officielle (outil natif `ideviceinstaller.exe`) ;
   - **action manuelle** : la méthode ne peut pas être lancée depuis Windows (outil macOS/Linux,
     installeur sur l'appareil, navigateur…). Les étapes sont affichées, **aucun processus n'est lancé** ;
   - **indisponible** : entrée d'inventaire ou outil non fiable.
3. L'application n'est possible que si le plan est *prêt*, après consentement explicite (case
   propriétaire) et saisie du mot de confirmation `JAILBREAK` — le même schéma que les restaurations
   maître. L'opération est suivie en direct, une seule à la fois, et consignée dans le journal local
   d'audit à identifiant d'appareil haché.

| Étendue | Méthodes | Ce que NovaUnlock fait réellement |
| --- | --- | --- |
| Installation IPA | Dopamine, XinaA15, unc0ver, Taurine, Odyssey, Chimera, Electra, Meridian, Yalu, h3lix, Phœnix | Vérifie l'IPA (conteneur ZIP + SHA-256) puis l'installe via `ideviceinstaller` ; la procédure « Jailbreak » se lance ensuite **sur l'appareil** |
| Étapes manuelles | TrollStore, roothide Bootstrap, Serotonin, Fugu15, variantes 2024-2026 | Affiche la marche à suivre, aucune commande exécutée |
| Étapes manuelles (poste incompatible) | palera1n, checkra1n | Exigent macOS ou Linux : documentés, jamais lancés depuis ce PC |
| Référence seulement | Pangu 9, Home Depot, inventaire historique iOS 3–8 | Fiche documentaire, aucune action |

Ce qui est **hors de portée par conception** : NovaUnlock ne télécharge aucun binaire de jailbreak, ne
lance aucun exécutable de jailbreak, ne contourne ni code d'accès, ni Activation Lock/iCloud, ni SIM,
ni Temps d'écran. Les outils qui s'exécutent sur l'appareil (Dopamine, palera1n, TrollStore…) sont
toujours lancés par l'utilisateur lui-même, après vérification de leur provenance.

### Contrat IPC et garanties

- `jailbreak:capabilities` — présence de `ideviceinstaller.exe` et état d'appairage réel.
- `jailbreak:select-ipa` — sélecteur de fichier `.ipa` local (aucun téléchargement).
- `jailbreak:apply` — action validée dans le processus principal : identifiant de méthode borné,
  **source en liste blanche**, chemin **absolu** en `.ipa`, conteneur ZIP vérifié, empreinte SHA-256
  affichée ; puis exécution de `ideviceinstaller.exe -u <udid> -i <ipa>` avec délai maximal de 15 min.
- `jailbreak:apply-status` — suivi d'opération (une seule à la fois).

Le catalogue est un jeu de données typé (`src/lib/jailbreak/methods.ts`), évalué par un moteur pur
(`compatibility.ts`) et piloté par `execution.ts`, couverts par `compatibility.test.ts`,
`jailbreak-execution.unit.test.ts` (validation d'action, inspection d'IPA, chemin d'installation avec
outil et appareil simulés), `external-links.unit.test.ts` et `Jailbreak.test.tsx`. Le seul autre IPC
ajouté est `shell:open-external`, également validé par liste blanche.

---

## Modules USB

| Module | Rôle |
| --- | --- |
| `node-hid` / `usb` | Détection USB de repli (DFU, Recovery, Normal) |
| `libimobiledevice` | Appairage et lecture Lockdown |
| `idevicebackup2` | Sauvegarde locale chiffrée |
| `irecovery` / `ideviceenterrecovery` | Recovery / DFU officiels |
| `idevicerestore` | Restauration IPSW officielle |

## Licence

Propriétaire — NovaUnlock. Les binaires tiers conservent leurs licences respectives.
