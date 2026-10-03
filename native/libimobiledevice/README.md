# Binaires natifs `libimobiledevice` (Windows x64)

Ce dossier ne contient volontairement **aucun exécutable ni DLL** dans Git. Les binaires Windows peuvent être soumis à des licences différentes selon l'utilitaire ; ils doivent être obtenus depuis une distribution `libimobiledevice` Windows x64 de confiance, avec ses avis de licence.

NovaUnlock ne télécharge ni n'exécute automatiquement un binaire trouvé sur Internet. Cela évite de transformer le packaging en chaîne d'approvisionnement non vérifiée.

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

## Pour les développeurs et le build Windows

1. Téléchargez puis **extrayez** le paquet Windows x64 officiel que votre organisation a validé.
2. Placez le contenu directement ici, ou utilisez le script de staging :

```powershell
$env:NOVAUNLOCK_NATIVE_DIR = "C:\chemin\vers\dossier-extrait"
npm run prepare:native
```

3. Vérifiez le payload avant de construire l'installateur :

```bash
npm run verify:native
npm run package:win
```

`package`, `package:win` et `package:win:portable` exécutent automatiquement `verify:native`. Ils s'arrêtent si un exécutable requis ou une DLL manque, plutôt que de livrer un installateur USB inutilisable. Les fichiers `.exe`, `.dll` et archives restent ignorés par Git.

## Pour un utilisateur de l'application installée

Depuis **Connexion USB**, cliquez sur **Importer / mettre à jour**, puis choisissez le dossier déjà extrait. NovaUnlock copie seulement les `.exe`, `.dll` et avis de licence vers son répertoire utilisateur ; aucune élévation de privilèges ni modification de `Program Files` n'est nécessaire. L'écran **Maître** affiche ensuite les capacités réellement disponibles.

## Licence et redistribution

Les composants de la suite `libimobiledevice` sont distribués sous licences open source (**LGPL-2.1** / **GPL-2.0** selon les utilitaires). Toute redistribution binaire doit inclure les avis de licence et respecter les conditions applicables.
