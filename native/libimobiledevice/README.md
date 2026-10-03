# Binaires natifs `libimobiledevice` (Windows x64)

Ce répertoire est destiné à contenir les exécutables Windows (`x64`) de la suite **libimobiledevice** copiés dans `resources/native/libimobiledevice/` lors du packaging Electron Builder (`extraResources`).

## Exécutables attendus

- `idevice_id.exe` — Énumération des UDID des appareils iOS connectés en mode Normal
- `ideviceinfo.exe` — Lecture des informations matérielles, batterie, stockage et Lockdown
- `ideviceactivation.exe` — Vérification de l'état d'activation (`ActivationState`)
- `idevicerestore.exe` — Restauration / flash officiel de paquets `.ipsw` signés
- `irecovery.exe` — Communication avec iBoot / mode Recovery et mode DFU
- `idevicebackup2.exe` — Création et vérification de sauvegardes locales iOS
- `*.dll` — Bibliothèques partagées associées (`imobiledevice.dll`, `usbmuxd.dll`, `plist.dll`, `irecovery.dll`, etc.)

## Licence et redistribution

Les composants de la suite `libimobiledevice` sont distribués sous licences open-source (**LGPL-2.1** / **GPL-2.0** selon les utilitaires). Toute redistribution binaire doit inclure les avis de licence et respecter les conditions de la licence applicable.
