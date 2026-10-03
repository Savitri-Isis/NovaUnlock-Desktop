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
├── native/libimobiledevice/         # Documentation + payload Windows local (ignoré par Git)
└── scripts/                         # Staging et vérification avant packaging
```

---

## Prérequis

- Windows 10/11 x64
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

Si MSYS2 est installé ailleurs que `C:\msys64`, définissez `MSYS2_ROOT` sur son dossier avant de lancer le fichier `.cmd`.

### Créer l’installateur sans saisir de commandes (Windows)

1. Récupérez le **projet complet** sur votre PC, par exemple dans `C:\Users\hp\NovaUnlock-Desktop`. Ne déplacez pas le lanceur seul.
2. Installez une version compatible de **Node.js x64** depuis [nodejs.org](https://nodejs.org), si nécessaire.
3. Préparez les outils natifs : construisez-les avec `Construire-outils-libimobiledevice-Windows.cmd` (section précédente), ou obtenez un paquet Windows x64 de confiance avec toutes ses DLL et licences.
4. Dans l’Explorateur Windows, double-cliquez sur **`Creer-installateur-Windows.cmd`**.
5. Si vous utilisez un paquet déjà extrait, choisissez son dossier lorsque le sélecteur s’ouvre ; si le constructeur MSYS2 a préparé `native/libimobiledevice`, aucun sélecteur n’est nécessaire. Gardez la fenêtre ouverte jusqu’à la fin.

Le lanceur se place lui-même dans le dossier du projet, contrôle Node/npm, prépare et vérifie les fichiers natifs, installe les dépendances verrouillées avec `npm ci --include=dev`, puis lance `package:win`. Il s’arrête à la première erreur. La fenêtre reste ouverte pour lire les messages ; en cas d’annulation du sélecteur, aucune copie, installation de dépendances ou compilation n’est lancée.

Un paquet complet déjà présent dans `native/libimobiledevice` est réutilisé. Une variable `NOVAUNLOCK_NATIVE_DIR` déjà définie permet de le remplacer sans ouvrir le sélecteur. La source de remplacement doit être complète : les anciens fichiers de destination ne peuvent pas masquer les fichiers manquants dans la source.

À la fin, l’Explorateur ouvre **`release`**, qui contient deux fichiers distincts :

- `NovaUnlock-Setup-<version>-x64.exe` : installateur Windows ;
- `NovaUnlock-Portable-<version>-x64.exe` : application portable.

Une connexion Internet est nécessaire pour les dépendances npm et les composants de compilation téléchargés par Electron Builder. Aucun changement de la politique PowerShell ni installation automatique de Node.js ou de pilotes Apple n’est effectué. Ne lancez qu’une construction à la fois dans un même dossier.

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

Les commandes de packaging lancent déjà `verify:native` : elles échouent volontairement si `ideviceinfo.exe`, `idevice_id.exe`, `ideviceactivation.exe`, `idevicebackup2.exe`, `idevicerestore.exe`, `irecovery.exe` ou les DLL associées sont absents. Voir [`native/libimobiledevice/README.md`](native/libimobiledevice/README.md).

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
