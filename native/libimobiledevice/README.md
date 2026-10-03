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

## Création guidée de l’installateur (sans commandes)

Depuis le dossier du projet complet, double-cliquez sur **`Creer-installateur-Windows.cmd`**. Node.js x64 compatible doit être installé (22.22.2+ dans la branche 22, ou 24.15.0+ dans la branche 24).

Si aucun paquet complet n’est déjà présent ici, une fenêtre vous demande le dossier **extrait** de confiance. L’assistant prépare les fichiers, les vérifie, installe les dépendances verrouillées puis construit l’installateur et le portable dans `release`. Il s’arrête en cas d’erreur et conserve les messages dans la console ouverte. Une source de remplacement incomplète est refusée avant toute copie, même si un ancien paquet complet existe déjà ici.

Aucun téléchargement de libimobiledevice, installation de pilotes ou changement de politique PowerShell n’est effectué. Les dépendances npm et composants de compilation nécessitent Internet. Node.js est requis uniquement sur le PC de construction, pas sur celui qui utilise une application déjà installée.

## Pour les développeurs et le build Windows (alternative manuelle)

1. Téléchargez puis **extrayez** le paquet Windows x64 de confiance que votre organisation a validé.
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

Dans **Paramètres** ou **Connexion USB**, l’**Assistant de configuration** vérifie automatiquement les fichiers disponibles. Cliquez sur **Configurer automatiquement**, puis choisissez le dossier déjà extrait. NovaUnlock copie seulement les `.exe`, `.dll` et avis de licence vers son répertoire utilisateur, puis revérifie les fichiers requis ; aucune élévation de privilèges ni modification de `Program Files` n’est nécessaire.

L’interface distingue un paquet incomplet, une erreur et une annulation. **Revérifier** actualise la liste sans réimporter. L’outil `ideviceenterrecovery.exe` est facultatif et son absence ne bloque pas la configuration.

Ce contrôle porte sur la présence des fichiers, **pas sur leur authenticité, leur architecture ou leur compatibilité**. Il n’exécute aucun binaire importé, ne vérifie pas les pilotes Apple et ne lance aucune opération sur un appareil. La génération de l’installateur est une étape de construction séparée, réservée au dossier des sources.

## Licence et redistribution

Les composants de la suite `libimobiledevice` sont distribués sous licences open source (**LGPL-2.1** / **GPL-2.0** selon les utilitaires). Toute redistribution binaire doit inclure les avis de licence et respecter les conditions applicables.
