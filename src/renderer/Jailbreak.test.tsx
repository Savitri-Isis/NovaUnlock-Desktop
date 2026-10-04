import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Jailbreak from "./Jailbreak";
import { DeviceDetector } from "../lib/usb/DeviceDetector";
import { useDeviceStore } from "../store/device-store";

vi.mock("../lib/usb/DeviceDetector", () => ({
  DeviceDetector: {
    scan: vi.fn(),
    fetchDeviceInfo: vi.fn(),
  },
}));

describe("Assistant jailbreak", () => {
  beforeEach(() => {
    useDeviceStore.getState().resetAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("ne prétend pas détecter un jailbreak quand l’état est inconnu", () => {
    render(<Jailbreak />);

    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
    expect(screen.getByText(/vérification n’est pas disponible/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lancement indisponible/i })).toBeDisabled();
  });

  it("affiche le profil matériel et garde le lancement bloqué sans matrice vérifiée", () => {
    useDeviceStore.getState().setConnection({ isConnected: true, currentMode: "normal" });
    useDeviceStore.getState().setDeviceInfo({
      model: "iPhone",
      modelIdentifier: "iPhone15,2",
      iosVersion: "17.0",
      jailbreakState: "unknown",
    });

    render(<Jailbreak />);

    expect(screen.getAllByText("iPhone15,2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("17.0").length).toBeGreaterThan(0);
    expect(screen.getByText(/catalogue vérifié couvrant ces combinaisons/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compatibilité non validée/i })).toBeDisabled();
  });

  it("analyse le périphérique connecté par le scanner USB", async () => {
    useDeviceStore.getState().setConnection({ isConnected: true, currentMode: "normal" });
    vi.mocked(DeviceDetector.fetchDeviceInfo).mockResolvedValue(undefined);

    render(<Jailbreak />);
    fireEvent.click(screen.getByRole("button", { name: /Analyser \/ actualiser l’appareil/i }));

    await waitFor(() => expect(DeviceDetector.fetchDeviceInfo).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(/Analyse terminée/i);
  });
});
