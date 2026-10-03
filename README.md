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
- Node.js 18+
- Un câble USB compatible
- Apple Devices ou iTunes / Apple Mobile Device USB Driver pour l'appairage en mode Normal
- Un paquet **Windows x64** complet de `libimobiledevice` (exécutables **et** DLL) pour le build final ou les opérations USB avancées

### Préparer les binaires natifs pour un installateur

Les `.exe`, `.dll` et archives ne sont pas committés dans Git. Avant un package Windows, obtenez et extrayez une distribution x64 validée par votre organisation, puis exécutez :

```powershell
$env:NOVAUNLOCK_NATIVE_DIR = "C:\chemin\vers\libimobiledevice-extrait"
npm run prepare:native
npm run verify:native
npm run package:win
```

Les commandes de packaging lancent déjà `verify:native` : elles échouent volontairement si `ideviceinfo.exe`, `idevice_id.exe`, `ideviceactivation.exe`, `idevicebackup2.exe`, `idevicerestore.exe`, `irecovery.exe` ou les DLL associées sont absents. Voir [`native/libimobiledevice/README.md`](native/libimobiledevice/README.md).

Un utilisateur d'une application déjà installée peut aussi choisir le dossier extrait depuis **Connexion USB → Importer / mettre à jour**. Le payload est alors copié dans son répertoire utilisateur, sans écriture dans `Program Files`.

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
npm run package:win            # Installeur NSIS Windows x64
npm run package:win:portable   # Binaire portable Windows x64
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
