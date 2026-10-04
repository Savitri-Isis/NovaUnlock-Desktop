# Binaires natifs `libimobiledevice` (Windows x64)

Ce dossier ne versionne volontairement **aucun exécutable ni DLL** dans Git. Le payload complet peut être construit localement depuis les sources amont épinglées avec `Construire-outils-libimobiledevice-Windows.cmd`, ou fourni comme paquet/ZIP Windows x64 approuvé avec ses notices et licences.

La compilation Windows amont passe par **MSYS2** ([instructions officielles](https://libimobiledevice.org/#get-started-windows-source)). Le constructeur de ce dépôt télécharge des sources épinglées et des paquets d’outils MSYS2, puis compile les binaires localement. Les sources `idevicerestore` épinglées reçoivent en plus un jeu de correctifs Windows local, versionné dans [`scripts/patches`](../../scripts/patches) et appliqué uniquement après vérification du commit amont ; ces correctifs sont documentés et testés hors ligne. Il ne télécharge pas d’exécutables `libimobiledevice` précompilés et ne lance aucune commande sur un appareil. Pour un paquet binaire tiers, l’utilisateur doit vérifier la provenance, l’architecture x64, la version, l’empreinte SHA-256 et les licences avant utilisation.

NovaUnlock ne télécharge ni n'exécute automatiquement un binaire natif précompilé. Cela évite d’intégrer silencieusement une collection d’exécutables tiers non vérifiés.

## Capacités attendues

| Binaire | Fonction NovaUnlock |
| --- | --- |
| `idevice_id.exe` | Détection d'appareils appairés en mode Normal |
| `ideviceinfo.exe` | Informations techniques lecture seule |
| `ideviceactivation.exe` | Contrôle **fail-closed** d'Activation Lock |
| `idevicebackup2.exe` | Sauvegarde locale chiffrée |
| `idevicerestore.exe` | Restauration IPSW officielle |
| `irecovery.exe` | Détection / sortie Recovery et DFU |
| `ideviceenterrecovery.exe` | Entrée Recovery officielle (optionnel mais recommandé) |
| `*.dll` | Dépendances partagées associées (`imobiledevice.dll`, `usbmuxd.dll`, `plist.dll`, etc.) |

> `Activated` n'est pas équivalent à « Activation Lock désactivé ». NovaUnlock n'autorise une restauration maître que lorsqu'un outil fournit un statut de verrouillage explicitement déverrouillé ; sinon il bloque l'opération.

## Construire le payload depuis les sources amont (Windows)

1. Installez **MSYS2 x64** depuis [msys2.org](https://www.msys2.org/) (dossier par défaut : `C:\msys64`).
2. Dans le terminal **MSYS2 UCRT64**, mettez MSYS2 à jour avec `pacman -Syu`. Si le terminal se ferme, rouvrez-le et relancez la mise à jour.
3. Depuis l’Explorateur Windows, double-cliquez sur **`Construire-outils-libimobiledevice-Windows.cmd`**. Le script utilise les versions et commits de [`scripts/native-sources.lock`](../../scripts/native-sources.lock), vérifie les commits, compile les outils, collecte les DLL d’exécution et écrit `NOTICE.txt` avec les licences disponibles.
4. Après réussite, double-cliquez sur **`Creer-installateur-Windows.cmd`** pour construire l’installateur complet.

Une connexion Internet est requise pour les outils MSYS2 et les sources. Le script contrôle la présence et l’architecture des exécutables, mais **ne teste aucun iPhone**. Les journaux d’échec sont conservés dans `.native-build/logs`; le payload et l’avis local sont ignorés par Git. Node.js x64 compatible (22.22.2+ ou 24.15.0+) est requis pour construire l’installateur, mais pas pour utiliser l’application installée.

## Création guidée de l’installateur avec un paquet déjà prêt

Depuis le dossier complet du projet, double-cliquez sur **`Creer-installateur-Windows.cmd`**. Node.js x64 compatible doit être installé (22.22.2+ dans la branche 22, ou 24.15.0+ dans la branche 24).

Si aucun payload complet n’est déjà présent dans `native/libimobiledevice`, une fenêtre demande de choisir le dossier extrait de confiance. L’assistant prépare les fichiers, les vérifie, installe les dépendances verrouillées puis construit l’installateur et le portable dans `release`. Il s’arrête en cas d’erreur et conserve les messages dans la console ouverte. Une source de remplacement incomplète est refusée avant toute copie, même si un ancien paquet complet est déjà présent.

Un dossier refusé n’arrête plus l’assistant : le message indique le dossier examiné, le nombre de `.exe` et de DLL trouvés, les outils manquants et les archives détectées, puis le sélecteur se rouvre (trois essais, fermeture pour annuler). Si le dossier choisi contient encore le paquet sous forme d’archive ZIP au nom évocateur, celle-ci est extraite localement par le préparateur d’archive (aucun téléchargement, aucune exécution) et vérifiée avant copie. Pour repartir d’une archive précise, la commande documentée reste disponible :

```powershell
npm run prepare:native:archive -- "C:\chemin\vers\libimobiledevice-win-x64.zip"
npm run verify:native
```

## Importer une archive ZIP complète

Le préparateur d’archive n’effectue aucun téléchargement et n’exécute aucun fichier importé :

```powershell
npm run prepare:native:archive -- "C:\chemin\vers\libimobiledevice-win-x64.zip"
npm run verify:native
```

Le script extrait l’archive dans un dossier temporaire, recherche un dossier contenant les six exécutables requis et au moins une DLL, copie uniquement les `.exe`, `.dll` et avis de licence, puis crée `NOVAUNLOCK-NATIVE-MANIFEST.json` avec les empreintes SHA-256 locales. Si un élément manque, la copie est refusée.

Le script ne transforme pas une archive en binaires : elle doit contenir de vrais fichiers Windows x64 issus d’une source validée. Le manifeste confirme la présence et les empreintes locales ; il ne prouve pas l’authenticité, l’architecture ni la compatibilité des DLL.

## Préparer un paquet manuellement

Les fichiers `.exe`, `.dll` et archives ne sont pas committés dans Git. Obtenez et extrayez une distribution Windows x64 validée, puis utilisez :

```powershell
$env:NOVAUNLOCK_NATIVE_DIR = "C:\chemin\vers\dossier-extrait"
npm run prepare:native
npm run verify:native
npm run package:win
```

`package`, `package:win` et `package:win:portable` exécutent automatiquement `verify:native`. Ils s’arrêtent si un exécutable requis ou une DLL manque, plutôt que de livrer un installateur USB incomplet.

## Pour un utilisateur de l’application installée

Dans **Paramètres** ou **Connexion USB**, l’**Assistant de configuration** vérifie automatiquement les fichiers disponibles. Cliquez sur **Configurer automatiquement**, puis choisissez le dossier déjà extrait. NovaUnlock copie seulement les `.exe`, `.dll` et avis de licence vers son répertoire utilisateur, puis revérifie les fichiers requis ; aucune élévation de privilèges ni modification de `Program Files` n’est nécessaire.

L’interface distingue un paquet incomplet, une erreur et une annulation. **Revérifier** actualise la liste sans réimporter. `ideviceenterrecovery.exe` est facultatif et son absence ne bloque pas la configuration.

Ce contrôle porte sur la présence des fichiers, **pas sur leur authenticité, leur architecture ou leur compatibilité**. Il ne vérifie pas les pilotes Apple et ne lance aucune opération sur un appareil. Une restauration officielle exige aussi Recovery/DFU, un IPSW accepté par Apple, l’autorisation du propriétaire et la vérification d’Activation Lock.

## Licence et redistribution

Les composants natifs gardent leurs licences respectives. Toute redistribution binaire doit inclure les notices/licences requises et respecter les conditions applicables, notamment celles des composants LGPL/GPL.
