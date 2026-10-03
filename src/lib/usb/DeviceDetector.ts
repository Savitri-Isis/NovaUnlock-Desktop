/**
 * NovaUnlock Desktop — Device Detector
 * Détection des appareils iOS connectés via USB sur Windows.
 */

import { useDeviceStore } from "../../store/device-store";
import type { ActivationLockStatus } from "../../types/electron";

export interface DetectedDevice {
  deviceId: number;
  deviceName: string;
  productName: string;
  serialNumber: string | null;
  manufacturer: string;
  vendorId: number;
  productId: number;
  mode: "normal" | "dfu" | "recovery" | "kdfu" | "unknown";
  connectionId: string;
}

export class DeviceDetector {
  /**
   * Vérifier dynamiquement si libimobiledevice est installé.
   */
  static async checkLibimobiledevice(): Promise<boolean> {
    try {
      if (window.novaunlock?.checkLibimobiledevice) {
        const installed = await window.novaunlock.checkLibimobiledevice();
        useDeviceStore.getState().setLibimobiledeviceInstalled(installed);
        return installed;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Scanner tous les appareils Apple connectés en USB.
   */
  static async scanAll(): Promise<DetectedDevice[]> {
    try {
      if (window.novaunlock?.scanAllDevices) {
        const devices = await window.novaunlock.scanAllDevices();
        return devices.map((device) => ({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          productName: device.productName,
          serialNumber: device.serialNumber,
          manufacturer: device.manufacturer,
          vendorId: device.vendorId,
          productId: device.productId,
          mode: device.mode,
          connectionId: device.connectionId,
        }));
      }
      const single = await this.scan();
      return single ? [single] : [];
    } catch {
      return [];
    }
  }

  /**
   * Scanner les appareils Apple connectés en USB.
   */
  static async scan(): Promise<DetectedDevice | null> {
    const store = useDeviceStore.getState();

    store.setConnection({ isSearching: true });
    store.addLog({ message: "Recherche d'appareils Apple USB...", type: "info" });

    try {
      const device = await window.novaunlock.scanDevices();

      if (device) {
        const detected: DetectedDevice = {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          productName: device.productName,
          serialNumber: device.serialNumber,
          manufacturer: device.manufacturer,
          vendorId: device.vendorId,
          productId: device.productId,
          mode: device.mode,
          connectionId: device.connectionId,
        };

        store.setConnection({
          isConnected: true,
          currentMode: device.mode,
          lastConnectedAt: new Date(),
        });

        store.setDeviceInfo({
          serial: device.serialNumber,
          model: device.productName,
          connectionType: "usb",
        });

        store.addLog({
          message: `Appareil détecté: ${device.deviceName} (${device.mode.toUpperCase()})`,
          type: "success",
        });

        return detected;
      } else {
        store.setConnection({ isConnected: false, currentMode: "disconnected" });
        store.addLog({ message: "Aucun appareil Apple détecté", type: "warning" });
        return null;
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur de scan USB: ${error.message}`,
        type: "error",
      });
      return null;
    } finally {
      store.setConnection({ isSearching: false });
    }
  }

  /**
   * Connecter à un appareil spécifique.
   */
  static async connect(deviceId: number): Promise<boolean> {
    const store = useDeviceStore.getState();

    try {
      const success = await window.novaunlock.connectDevice(deviceId);
      if (success) {
        store.setConnection({ isConnected: true });
        store.addLog({ message: "Appareil connecté avec succès", type: "success" });

        // Récupérer les infos détaillées
        await this.fetchDeviceInfo();
      } else {
        store.setConnection({ isConnected: false, currentMode: "disconnected" });
        store.addLog({
          message: "Impossible d'établir la connexion avec l'appareil (vérifiez le câble ou libimobiledevice)",
          type: "error",
        });
      }
      return success;
    } catch (error: any) {
      store.addLog({
        message: `Erreur de connexion: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Déconnecter l'appareil.
   */
  static async disconnect(deviceId: number): Promise<boolean> {
    const store = useDeviceStore.getState();

    try {
      const success = await window.novaunlock.disconnectDevice(deviceId);
      if (success) {
        store.setConnection({ isConnected: false, currentMode: "disconnected" });
        store.setDeviceInfo({
          serial: null,
          model: null,
          modelIdentifier: null,
          imei: null,
          iosVersion: null,
          batteryLevel: null,
          batteryHealth: null,
          storageUsed: null,
          storageTotal: null,
          jailbreakStatus: false,
          jailbreakState: "not-checked",
          activationLockStatus: null,
          connectionType: null,
          ecid: null,
          ibootVersion: null,
          chipset: null,
          boardConfig: null,
          basebandVersion: null,
        });
        store.addLog({ message: "Appareil déconnecté", type: "info" });
      }
      return success;
    } catch (error: any) {
      store.addLog({
        message: `Erreur de déconnexion: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }

  /**
   * Récupérer les informations détaillées de l'appareil.
   */
  static async fetchDeviceInfo(): Promise<void> {
    const store = useDeviceStore.getState();

    try {
      const info = await window.novaunlock.getDeviceInfo();
      if (info) {
        store.setDeviceInfo({
          serial: info.serial,
          model: info.model,
          modelIdentifier: info.modelIdentifier,
          imei: info.imei,
          iosVersion: info.iosVersion,
          batteryLevel: info.batteryLevel,
          batteryHealth: info.batteryHealth,
          storageUsed: info.storageUsed,
          storageTotal: info.storageTotal,
          jailbreakStatus: info.jailbreakStatus,
          jailbreakState: info.jailbreakState || (info.jailbreakStatus ? "yes" : "no"),
          activationLockStatus: info.activationLockStatus,
          connectionType: info.connectionType,
          ecid: info.ecid,
          ibootVersion: info.ibootVersion,
          chipset: info.chipset,
          boardConfig: info.boardConfig,
          basebandVersion: info.basebandVersion,
        });
        store.addLog({ message: "Informations appareil récupérées", type: "success" });
      }
    } catch (error: any) {
      store.addLog({
        message: `Erreur récupération infos: ${error.message}`,
        type: "error",
      });
    }
  }

  /**
   * Récupérer l'ECID.
   */
  static async getECID(): Promise<string | null> {
    try {
      return await window.novaunlock.getECID();
    } catch {
      return null;
    }
  }

  /**
   * Vérifier le statut Activation Lock (mode fail-closed : inconnu en cas d'erreur).
   */
  static async getActivationLockStatus(): Promise<ActivationLockStatus> {
    try {
      return await window.novaunlock.getActivationLockStatus();
    } catch {
      return {
        state: "unknown",
        locked: null,
        account: null,
        message: "Statut inconnu — opération sensible bloquée",
      };
    }
  }

  /**
   * Vérifier le statut jailbreak.
   */
  static async checkJailbreak(): Promise<boolean> {
    try {
      return await window.novaunlock.checkJailbreakStatus();
    } catch {
      return false;
    }
  }
}
