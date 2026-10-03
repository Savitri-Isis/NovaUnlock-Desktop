# Pilotes USB Windows (`WinUSB` / `usbmuxd`)

Pour communiquer avec les appareils Apple sous Windows :

1. **Mode Normal** (`0x05AC:0x1290`, `0x1297`, `0x129C`) :
   - Requiert le pilote **Apple Mobile Device USB Driver** et le service `usbmuxd` (fourni par iTunes / Apple Devices pour Windows).
2. **Mode Recovery (`0x1282`) et Mode DFU (`0x1281`)** :
   - Requiert un pilote compatible **WinUSB** / **libusbK** pour permettre à `irecovery` et `idevicerestore` d'ouvrir l'interface USB bulk.
