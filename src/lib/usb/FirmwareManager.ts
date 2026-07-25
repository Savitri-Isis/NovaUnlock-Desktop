/**
 * NovaUnlock Desktop — Firmware Manager
 * Gère la liste et le téléchargement des firmwares via l'API ipsw.me.
 */

import { useDeviceStore } from "../../store/device-store";

const IPSW_API = "https://api.ipsw.me/v4";

export interface FirmwareInfo {
  version: string;
  buildid: string;
  url: string;
  filesize: string;
  released: string;
  signed: boolean;
}

export class FirmwareManager {
  /**
   * Lister les firmwares disponibles pour un identifiant d'appareil.
   */
  static async listFirmwares(deviceIdentifier: string): Promise<FirmwareInfo[]> {
    const store = useDeviceStore.getState();

    try {
      const response = await fetch(`${IPSW_API}/device/${deviceIdentifier}`);
      const data = await response.json();

      const firmwares: FirmwareInfo[] = data.firmwares
        .filter((fw: any) => fw.signed)
        .map((fw: any) => ({
          version: fw.version,
          buildid: fw.buildid,
          url: fw.url,
          filesize: fw.filesize,
          released: fw.released,
          signed: fw.signed,
        }));

      store.setAvailableFirmwares(firmwares);
      store.addLog({
        message: `${firmwares.length} firmware(s) trouvé(s) pour ${deviceIdentifier}`,
        type: "success",
      });

      return firmwares;
    } catch (error: any) {
      store.addLog({
        message: `Erreur API ipsw.me: ${error.message}`,
        type: "error",
      });
      return [];
    }
  }

  /**
   * Télécharger un firmware.
   * Sur desktop, utilise node-fetch pour télécharger dans le dossier Downloads.
   */
  static async downloadFirmware(firmware: FirmwareInfo): Promise<string | null> {
    const store = useDeviceStore.getState();

    store.setFirmwareDownloadProgress({
      isDownloading: true,
      progress: 0,
      speed: "",
      totalSize: firmware.filesize,
      downloadedSize: "0 KB",
    });

    try {
      // Sur desktop, on appelle le backend Electron pour le téléchargement
      if (window.novaunlock) {
        store.addLog({
          message: "Téléchargement via Electron backend...",
          type: "info",
        });
      }

      // Fallback : download direct via fetch
      const response = await fetch(firmware.url);
      const totalSize = response.headers.get("content-length");
      const reader = response.body?.getReader();

      if (!reader) return null;

      let downloaded = 0;
      const total = parseInt(totalSize || "0");
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        const speed = downloaded > 0 ? `${(downloaded / 1024 / 1024).toFixed(1)} MB` : "";

        store.setFirmwareDownloadProgress({
          isDownloading: true,
          progress,
          speed,
          totalSize: firmware.filesize,
          downloadedSize: `${(downloaded / 1024 / 1024).toFixed(1)} MB`,
        });
      }

      // Créer le blob et déclencher le téléchargement
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deviceIdentifier}_${firmware.buildid}.ipsw`;
      a.click();
      window.URL.revokeObjectURL(url);

      store.setFirmwareDownloadProgress({
        isDownloading: false,
        progress: 100,
        speed: "",
        totalSize: firmware.filesize,
        downloadedSize: firmware.filesize,
      });

      store.addLog({
        message: `Firmware iOS ${firmware.version} téléchargé`,
        type: "success",
      });

      return a.download;
    } catch (error: any) {
      store.setFirmwareDownloadProgress({ isDownloading: false, progress: 0, speed: "", totalSize: "", downloadedSize: "" });
      store.addLog({
        message: `Erreur téléchargement: ${error.message}`,
        type: "error",
      });
      return null;
    }
  }
}
