# Correctifs locaux des sources natives (Windows)

Ces fichiers sont des correctifs locaux, appliqués **uniquement** aux sources
amont épinglées dans [`../native-sources.lock`](../native-sources.lock), par
`build-native-msys2.sh`, après vérification du commit et **avant** `autogen.sh`
(génération de `configure`/`Makefile`).

| Correctif | Fichier amont | Défaut amont corrigé |
| --- | --- | --- |
| `idevicerestore-1.0.0-win32-cflags.patch` | `configure.ac` | `GLOBAL_CFLAGS` colle `-O2` et `-DWIN32` (`argument to '-O'`). |
| `idevicerestore-1.0.0-win32-stat.patch` | `src/common.h` | `stat`/`struct stat` ne sont pas déclarés quand `WIN32` est défini (`storage size of 'fst' isn't known`). |
| `idevicerestore-1.0.0-win32-libs.patch` | `src/Makefile.am` | `socket.c` utilise winsock mais l'édition de liens n'ajoute pas `-lws2_32`. |

Règles :

- le nom encode le projet **et** la version épinglée : changer de version dans
  `native-sources.lock` exige de nouveaux correctifs, et le constructeur
  s'arrête tant qu'ils n'existent pas ;
- un correctif qui ne s'applique plus (source amont déplacée, déjà corrigée)
  fait échouer la construction au lieu d'être ignoré ;
- toute modification d'un correctif doit être accompagnée du test hors ligne
  correspondant dans [`../tests`](../tests).
