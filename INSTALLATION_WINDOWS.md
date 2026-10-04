# NovaUnlock Desktop — Installation Windows

Cette notice concerne **l’utilisation de l’application déjà construite** sur un PC Windows 10/11 x64. Pour créer l’installateur depuis les sources, consultez la section dédiée dans le [`README.md`](README.md).

## 1. Ce qu’il faut avant de commencer

- Windows 10 ou Windows 11 en 64 bits.
- Un câble USB compatible avec l’iPhone ou l’iPad.
- **Apple Devices** ou **iTunes** installé pour le pilote Apple Mobile Device USB et l’appairage en mode normal.
- Un compte Apple appartenant au propriétaire de l’appareil lorsque l’écran d’activation le demande.
- Un installateur NovaUnlock fourni par une source de confiance : `NovaUnlock-Setup-<version>-x64.exe`.

Node.js n’est **pas nécessaire** pour utiliser l’application installée. Il est nécessaire uniquement pour fabriquer l’installateur depuis le dépôt.

### Où obtenir l’installateur

Le dépôt fabrique l’installateur sur GitHub, sans PC Windows : le workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) compile les outils natifs depuis les sources épinglées, puis crée les fichiers `.exe`. Deux sources équivalentes :

- **Releases** (recommandé) : ouvrez l’onglet *Releases* du dépôt et téléchargez `NovaUnlock-Setup-<version>-x64.exe` avec `SHA256SUMS.txt` ; ces fichiers sont publiés à chaque étiquette `v<version>`, dont la cohérence avec [`package.json`](package.json) est contrôlée avant publication ;
- **Actions** (construction à la demande) : ouvrez l’exécution du workflow *Construire l’installateur Windows*, puis téléchargez l’artefact `NovaUnlock-Windows-x64` (installateur, version portable et `SHA256SUMS.txt`, conservé 30 jours).

Les fichiers produits ne sont pas signés : Windows peut afficher un avertissement SmartScreen. Avant d’installer, comparez l’empreinte du fichier téléchargé avec celle de `SHA256SUMS.txt` :

```powershell
Get-FileHash -Algorithm SHA256 .\NovaUnlock-Setup-1.0.0-x64.exe
```

N’installez que des fichiers provenant du dépôt de confiance dont l’empreinte correspond. Cela ne remplace pas les autres précautions : NovaUnlock ne contourne ni code d’accès, ni iCloud / Activation Lock, ni SIM.

## 2. Installer l’application

1. Fermez les applications qui utilisent l’iPhone ou l’iPad, notamment Apple Devices ou iTunes.
2. Double-cliquez sur `NovaUnlock-Setup-<version>-x64.exe`.
3. Acceptez l’emplacement proposé ou choisissez un dossier d’installation.
4. Laissez cochées les options de raccourci souhaitées, puis terminez l’assistant.
5. Lancez **NovaUnlock** depuis le menu Démarrer ou le raccourci du bureau.

L’application n’installe pas automatiquement de pilote Apple et ne modifie pas la stratégie PowerShell de Windows.

## 3. Configurer les outils USB

La première ouverture peut afficher l’**Assistant de configuration** :

1. Ouvrez **Connexion USB** ou **Paramètres**.
2. Cliquez sur **Configurer automatiquement**.
3. Sélectionnez un dossier `libimobiledevice` Windows x64 déjà extrait et provenant d’une source de confiance.
4. Attendez la vérification de tous les exécutables et DLL.
5. Si le paquet est incomplet, corrigez la source puis cliquez sur **Revérifier**.

La copie est réalisée dans le répertoire utilisateur de NovaUnlock, sans écriture dans `Program Files` et sans exécution automatique des fichiers importés. La vérification porte sur la présence des fichiers ; elle ne certifie pas l’authenticité, l’architecture ou la compatibilité de leurs DLL.

## 4. Première connexion d’un appareil

1. Déverrouillez l’appareil.
2. Branchez-le directement au PC avec un câble fiable.
3. Acceptez **Faire confiance à cet ordinateur** sur l’appareil.
4. Ouvrez **Connexion USB**, puis cliquez sur **Détecter**.
5. Vérifiez que le modèle et l’identifiant affichés correspondent à l’appareil attendu.

Une connexion en mode Recovery ou DFU peut ne pas afficher les mêmes informations qu’une connexion normale. NovaUnlock affiche les étapes de boutons ; il ne peut pas placer physiquement l’appareil en DFU à la place de l’utilisateur.

## 5. Opérations autorisées

- **Diagnostic** : lecture d’informations et vérification de l’état USB.
- **Sauvegarde** : appareil démarré, déverrouillé et appairé ; le mot de passe de sauvegarde est demandé à l’exécution et n’est pas conservé.
- **Recovery / DFU** : guidage manuel des séquences de boutons et détection de l’état.
- **Restauration officielle** : fichier `.ipsw` signé par Apple, prévol réussi, autorisation du propriétaire et confirmation explicite `EFFACER`.

Toute restauration peut effacer les données. NovaUnlock ne contourne pas un code d’accès, iCloud, Activation Lock, une SIM ou Temps d’écran. Si le statut d’Activation Lock ne peut pas être vérifié comme déverrouillé, la restauration maître est bloquée.

## 6. Dépannage rapide

| Symptôme | Action |
| --- | --- |
| Aucun appareil détecté | Vérifier le câble, le pilote Apple, l’appairage et le verrouillage de l’écran. |
| Outils natifs incomplets | Reprendre un paquet Windows x64 complet avec ses DLL, puis utiliser **Revérifier**. |
| Recovery/DFU non détecté | Suivre la séquence affichée et brancher l’appareil directement au PC. |
| Restauration refusée | Vérifier l’IPSW signé, le prévol, l’autorisation du propriétaire et le statut Activation Lock. |
| Application bloquée par Windows | Vérifier la provenance de l’installateur et la signature de votre distribution ; ne désactivez pas la sécurité Windows pour contourner un avertissement. |

Pour un problème de build, revenir au dépôt complet et utiliser `Creer-installateur-Windows.cmd`. Ne lancez pas ce fichier depuis une copie isolée du lanceur.
