import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import NativeSetup from "./NativeSetup";
import { useDeviceStore } from "../store/device-store";
import type { NativeToolStatus, NovaUnlockAPI } from "../types/electron";

function nativeStatus(ready = false, overrides: Partial<NativeToolStatus> = {}): NativeToolStatus {
  return {
    diagnosticsReady: ready,
    backupReady: ready,
    restoreReady: ready,
    activationCheckReady: ready,
    complete: ready,
    hasDlls: ready,
    searchRoots: [],
    source: ready ? "runtime" : "none",
    tools: { deviceId: ready, deviceInfo: ready, activation: ready, backup: ready, restore: ready, recovery: ready, enterRecovery: false },
    missing: ready ? ["ideviceenterrecovery.exe"] : ["ideviceinfo.exe", "idevice_id.exe"],
    ...overrides,
  };
}

const getStatus = vi.fn();
const install = vi.fn();

async function openAssistant() {
  const result = render(<NativeSetup />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Configurer automatiquement" })).toBeEnabled());
  return result;
}

beforeEach(() => {
  getStatus.mockReset().mockResolvedValue(nativeStatus());
  install.mockReset().mockResolvedValue({ success: true, message: "Importé", status: nativeStatus(true) });
  window.novaunlock = { getNativeToolStatus: getStatus, installLibimobiledevice: install } as unknown as NovaUnlockAPI;
  useDeviceStore.getState().resetAll();
});

afterEach(() => cleanup());

describe("Assistant de configuration des outils USB", () => {
  it("vérifie automatiquement les fichiers sans importer ni exécuter de commande", async () => {
    await openAssistant();
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(install).not.toHaveBeenCalled();
    expect(screen.getByText("Configuration incomplète")).toBeInTheDocument();
    expect(screen.getByText(/Bibliothèques DLL — absentes/)).toBeInTheDocument();
  });

  it("enchaîne sélection/importation et vérification, sans bloquer sur l'outil facultatif", async () => {
    getStatus.mockResolvedValueOnce(nativeStatus()).mockResolvedValueOnce(nativeStatus(true));
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByText(/Configuration terminée/)).toBeInTheDocument();
    expect(install).toHaveBeenCalledTimes(1);
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Fichiers requis présents")).toBeInTheDocument();
    expect(screen.getByText(/Facultatif : ideviceenterrecovery.exe/)).toBeInTheDocument();
    expect(useDeviceStore.getState().isLibimobiledeviceInstalled).toBe(true);
  });

  it("ne présente pas une annulation comme une erreur et garde les outils existants", async () => {
    getStatus.mockResolvedValue(nativeStatus(true));
    install.mockResolvedValue({ success: false, canceled: true, message: "Annulé", status: nativeStatus(true) });
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByText(/Configuration annulée/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Fichiers requis présents")).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("ne dit pas que la configuration est complète si les DLL manquent", async () => {
    const noDlls = nativeStatus(true, { hasDlls: false });
    getStatus.mockResolvedValue(noDlls);
    install.mockResolvedValue({ success: true, message: "Importé", status: noDlls });
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByText(/le paquet reste incomplet/)).toBeInTheDocument();
    expect(screen.queryByText("Fichiers requis présents")).not.toBeInTheDocument();
    expect(screen.getByText(/Bibliothèques DLL — absentes/)).toBeInTheDocument();
  });

  it("affiche une erreur d'importation et permet de réessayer", async () => {
    install.mockResolvedValue({ success: false, message: "Le dossier ne contient pas les outils requis.", status: nativeStatus() });
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le dossier ne contient pas les outils requis.");
    expect(screen.getByRole("button", { name: "Configurer automatiquement" })).toBeEnabled();
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("gère un rejet IPC sans conserver un faux état de réussite", async () => {
    getStatus.mockResolvedValue(nativeStatus(true));
    install.mockRejectedValue(new Error("Accès refusé"));
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Accès refusé");
    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revérifier" })).toBeEnabled();
  });

  it("ne garde pas de succès quand la vérification après import échoue", async () => {
    getStatus.mockResolvedValueOnce(nativeStatus()).mockRejectedValueOnce(new Error("Vérification indisponible"));
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vérification indisponible");
    expect(screen.queryByText("Fichiers requis présents")).not.toBeInTheDocument();
  });

  it("revérifie un paquet déjà fourni avec l'application sans demander une réinstallation", async () => {
    getStatus.mockResolvedValueOnce(nativeStatus()).mockResolvedValueOnce(nativeStatus(true, { source: "bundled" }));
    await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Revérifier" }));
    expect(await screen.findByText("Fichiers requis présents")).toBeInTheDocument();
    expect(screen.getByText(/Source : fournis avec l’application/)).toBeInTheDocument();
    expect(install).not.toHaveBeenCalled();
  });

  it("désactive les actions pendant une importation et ignore son résultat après démontage", async () => {
    let finish!: (value: unknown) => void;
    install.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount } = await openAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Configurer automatiquement" }));
    const busyButton = screen.getByRole("button", { name: "Configuration en cours…" });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revérifier" })).toBeDisabled();
    fireEvent.click(busyButton);
    expect(install).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { finish({ success: true, message: "Importé", status: nativeStatus(true) }); });
    expect(useDeviceStore.getState().isLibimobiledeviceInstalled).toBe(false);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("explique l'absence du bridge Electron dans un navigateur", async () => {
    window.novaunlock = undefined as unknown as NovaUnlockAPI;
    render(<NativeSetup />);
    expect(await screen.findByText(/pas dans un aperçu navigateur/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurer automatiquement" })).toBeDisabled();
  });
});
