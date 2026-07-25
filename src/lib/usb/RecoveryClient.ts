/**
 * NovaUnlock Desktop — Recovery Client
 * Gère les opérations Recovery via le module natif Electron.
 */

import { useDeviceStore } from "../../store/device-store";

export class RecoveryClient {
  /**
   * Entrer en mode Recovery.
   */
  static async enterRecovery(): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.addLog({ message: "Envoi de la commande enter_recovery...", type: "info" });

    try {
      const result = await window.novaunlock.sendRecoveryCommand("enter_recovery");
      if (result.success) {
        store.setConnection({ currentMode: "recovery" });
        store.addLog({ message: "Appareil entré en mode Recovery", type: "success" });
        return true;
      } else {
        store.addLog({
          message: `Échec entrée Recovery: ${result.response}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur entrée Recovery: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Sortir du mode Recovery.
   */
  static async exitRecovery(): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.addLog({ message: "Envoi de la commande exit_recovery...", type: "info" });

    try {
      const result = await window.novaunlock.sendRecoveryCommand("exit_recovery");
      if (result.success) {
        store.setConnection({ currentMode: "normal" });
        store.addLog({ message: "Appareil sorti du mode Recovery", type: "success" });
        return true;
      } else {
        store.addLog({
          message: `Échec sortie Recovery: ${result.response}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur sortie Recovery: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Flasher un firmware depuis le mode Recovery.
   */
  static async flashFromRecovery(filePath: string): Promise<boolean> {
    const store = useDeviceStore.getState();

    store.setDfuProgress({ isFlashing: true, progress: 0, stage: "Flash depuis Recovery...", speed: "" });
    store.addLog({ message: "Début du flash depuis Recovery...", type: "info" });

    try {
      const result = await window.novaunlock.flashFirmware(filePath);
      store.setDfuProgress({
        isFlashing: result.success,
        progress: result.progress,
        stage: result.stage,
        speed: result.speed,
      });

      if (result.success) {
        store.addLog({ message: "Flash depuis Recovery terminé avec succès", type: "success" });
        store.setConnection({ currentMode: "normal" });
        return true;
      } else {
        store.addLog({
          message: `Échec du flash depuis Recovery: ${result.stage}`,
          type: "error",
        });
        return false;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur flash Recovery: ${error.message}`,
        type: "error",
      });
      store.setDfuProgress({ isFlashing: false, progress: 0, stage: "Échec", speed: "" });
      return false;
    }
  }
}
