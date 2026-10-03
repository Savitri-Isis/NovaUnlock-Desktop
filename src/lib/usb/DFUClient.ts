/**
 * NovaUnlock Desktop — DFU Client
 * Gère les opérations DFU via le module natif Electron.
 */

import { useDeviceStore } from "../../store/device-store";

export class DFUClient {
  /**
   * Entrer en mode DFU.
   * Utilise irecovery pour envoyer les commandes DFU.
   */
  static async enterDFU(): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.setDfuProgress({ isFlashing: false, progress: 0, stage: "Entrée en DFU...", speed: "" });
    store.addLog({ message: "Envoi de la commande enter_dfu...", type: "info" });

    try {
      const result = await window.novaunlock.sendDFUCommand("enter_dfu", "");
      if (result.success) {
        store.setConnection({ currentMode: "dfu" });
        store.addLog({ message: "Appareil entré en mode DFU avec succès", type: "success" });
        store.setDfuProgress({ isFlashing: false, progress: 100, stage: "Mode DFU actif", speed: "" });
        return true;
      } else {
        store.addLog({
          message: `Échec entrée DFU: ${result.response}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur entrée DFU: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Sortir du mode DFU.
   */
  static async exitDFU(): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.addLog({ message: "Envoi de la commande exit_dfu...", type: "info" });

    try {
      const result = await window.novaunlock.sendDFUCommand("exit_dfu", "");
      if (result.success) {
        store.setConnection({ currentMode: "normal" });
        store.addLog({ message: "Appareil sorti du mode DFU", type: "success" });
        return true;
      } else {
        store.addLog({
          message: `Échec sortie DFU: ${result.response}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur sortie DFU: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Flasher un firmware depuis le mode DFU.
   */
  static async flashFirmware(filePath: string): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.setDfuProgress({ isFlashing: true, progress: 0, stage: "Initialisation...", speed: "" });
    store.addLog({ message: "Début du flash firmware...", type: "info" });

    try {
      const result = await window.novaunlock.flashFirmware(filePath);
      store.setDfuProgress({
        isFlashing: false,
        progress: result.progress,
        stage: result.stage,
        speed: result.speed,
      });

      if (result.success) {
        store.addLog({ message: "Flash firmware terminé avec succès", type: "success" });
        store.setConnection({ currentMode: "normal" });
        return true;
      } else {
        store.addLog({
          message: `Échec du flash: ${result.stage}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur flash: ${error.message}`,
        type: "error",
      });
      store.setDfuProgress({ isFlashing: false, progress: 0, stage: "Échec", speed: "" });
      return false;
    }
  }
}
