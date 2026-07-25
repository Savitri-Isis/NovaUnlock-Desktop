# NovaUnlock Desktop

Outil de déverrouillage iOS via USB pour **Windows**. Permet de gérer les modes DFU, Recovery, le flash de firmware et la lecture d'informations appareil.

---

## Architecture

```
NovaUnlock Desktop
├── electron/              # Processus principal Electron (Node.js)
│   ├── src/
│   │   ├── main.ts        # Point d'entrée Electron
│   │   └── usb-scanner.ts # Module USB Windows (node-hid, node-usb, libimobiledevice)
│   └── preload/
│       └── preload.ts     # Bridge sécurisé IPC → Renderer
├── src/                   # Frontend React (Vite)
│   ├── renderer/          # Composants d'écran
│   ├── components/        # Composants partagés (Sidebar)
│   ├── store/             # Store Zustand
│   ├── lib/usb/           # Clients USB (DFUClient, RecoveryClient, FirmwareManager)
│   └── types/             # Déclarations TypeScript Electron
├── native/                # Binaires libimobiledevice (à télécharger)
│   └── libimobiledevice/
│       ├── ideviceinfo.exe
│       ├── irecovery.exe
│       ├── idevicerestore.exe
│       └── idevice_id.exe
└── public/assets/         # Icônes et ressources
```

---

## Prérequis

- **Windows 10/11** (x64)
- **Node.js 18+**
- **Git**
- **Câble USB Lightning ou USB-C**

---

## Installation

```bash
# Cloner le repository
git clone https://github.com/Savitri-Isis/NovaUnlock-Desktop.git
cd NovaUnlock-Desktop

# Installer les dépendances
npm install

# Télécharger libimobiledevice
# 1. Allez sur https://github.com/libimobiledevice-win32/imobiledevice-runnning/releases
# 2. Téléchargez la dernière version
# 3. Extrayez dans le dossier native/libimobiledevice/
```

---

## Développement

```bash
# Lancer en mode dev (Vite + Electron)
npm run dev:electron

# Ou séparément :
npm run dev          # Vite seul (port 5173)
npm run dev:electron # Vite + Electron
```

---

## Build Windows

### APK / EXE (NSIS Installer)

```bash
# Build complet (frontend + electron + installer NSIS)
npm run package:win

# Ou mode portable (pas d'installation)
npm run package:win:portable
```

Les fichiers de sortie seront dans le dossier `release/`.

---

## Modules USB

| Module | Description |
|--------|-------------|
| `node-hid` | Détection HID bas niveau (USB HID devices) |
| `node-usb` | Communication USB bulk (DFU, Recovery, Normal) |
| `libimobiledevice` | Protocole Apple complet (iDevice API, AFC, Plist) |
| `irecovery` | Envoi de commandes iBoot/DFU/Recovery |
| `idevicerestore` | Flash firmware complet |
| `ideviceinfo` | Lecture informations appareil |
| `idevice_id` | Liste des appareils connectés |

---

## Device IDs Apple

| Mode | Product ID |
|------|-----------|
| DFU | `0x1281` |
| Recovery | `0x1282` |
| Normal | `0x1290`, `0x1297`, `0x129c` |
| KDFU | `0x1881` |

---

## Licence

Propriétaire — NovaUnlock
