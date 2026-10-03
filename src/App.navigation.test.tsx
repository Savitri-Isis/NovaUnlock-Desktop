import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { useDeviceStore } from "./store/device-store";

describe("Navigation React Router v7", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    useDeviceStore.getState().resetAll();
    useDeviceStore.getState().clearLogs();

    window.novaunlock = {
      scanDevices: vi.fn().mockResolvedValue(null),
      connectDevice: vi.fn().mockResolvedValue(false),
      disconnectDevice: vi.fn().mockResolvedValue(true),
      sendDFUCommand: vi.fn().mockResolvedValue({ success: true }),
      sendRecoveryCommand: vi.fn().mockResolvedValue({ success: true }),
      flashFirmware: vi.fn().mockResolvedValue({
        success: true,
        progress: 100,
        stage: "Terminé",
        speed: "0 MB/s",
      }),
      getDeviceInfo: vi.fn().mockResolvedValue(null),
      getECID: vi.fn().mockResolvedValue(null),
      getActivationLockStatus: vi.fn().mockResolvedValue({ locked: false, account: null }),
      checkJailbreakStatus: vi.fn().mockResolvedValue(false),
      installLibimobiledevice: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
      listBackups: vi.fn().mockResolvedValue([]),
      downloadFirmware: vi.fn().mockResolvedValue("/tmp/fw.ipsw"),
      preflight: vi.fn().mockResolvedValue({
        task: "inspect",
        ok: true,
        dryRun: true,
        blockers: [],
        warnings: [],
        steps: ["Inspection lecture seule"],
        activationLockNotice: "Activation Lock vérifié",
        backupCount: 1,
        diskFreeGb: 64,
      }),
      appendAudit: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le Dashboard sur la route /", () => {
    render(<App />);
    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByText("Vue d'ensemble de l'appareil et des opérations")
    ).toBeInTheDocument();
  });

  it("ouvre la page Maître", async () => {
    render(<App />);
    const masterLink = screen.getByRole("link", { name: /Maître/i });
    expect(masterLink).toHaveAttribute("href", "/master");

    fireEvent.click(masterLink);

    expect(
      await screen.findByRole("heading", { name: "Application maîtresse" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/master");
  });

  it("ouvre la page Connexion USB (/connect)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Connecter/i }));
    expect(window.location.pathname).toBe("/connect");
    expect(screen.getByRole("heading", { name: "Connexion USB" })).toBeInTheDocument();
  });

  it("ouvre la page Mode DFU (/dfu)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /DFU Mode/i }));
    expect(window.location.pathname).toBe("/dfu");
    expect(screen.getByRole("heading", { name: "Mode DFU" })).toBeInTheDocument();
  });

  it("ouvre la page Recovery (/recovery)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Recovery/i }));
    expect(window.location.pathname).toBe("/recovery");
    expect(screen.getByRole("heading", { name: "Mode Recovery" })).toBeInTheDocument();
  });

  it("ouvre le Gestionnaire firmware (/firmware)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Firmware/i }));
    expect(window.location.pathname).toBe("/firmware");
    expect(screen.getByRole("heading", { name: "Firmware Manager" })).toBeInTheDocument();
  });

  it("ouvre la page Informations appareil (/device-info)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Infos/i }));
    expect(window.location.pathname).toBe("/device-info");
    expect(screen.getByRole("heading", { name: "Informations appareil" })).toBeInTheDocument();
  });

  it("ouvre la page Paramètres (/settings)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Settings/i }));
    expect(window.location.pathname).toBe("/settings");
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeInTheDocument();
  });

  it("redirige une route inconnue vers le Dashboard sans page blanche", () => {
    window.history.replaceState({}, "", "/route-inconnue");
    render(<App />);

    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("gère le chemin initial file:// d'Electron (index.html) en redirigeant vers /", () => {
    window.history.replaceState(
      {},
      "",
      "/C:/Program%20Files/NovaUnlock/resources/app.asar/dist/renderer/index.html"
    );
    render(<App />);

    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("supporte l'actualisation d'une route sans page blanche", () => {
    window.history.replaceState({}, "", "/firmware");
    const { unmount } = render(<App />);
    expect(screen.getByRole("heading", { name: "Firmware Manager" })).toBeInTheDocument();

    unmount();
    render(<App />);
    expect(window.location.pathname).toBe("/firmware");
    expect(screen.getByRole("heading", { name: "Firmware Manager" })).toBeInTheDocument();
  });

  it("maintient un état cohérent lors de la navigation aller/retour", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: /Maître/i }));
    expect(screen.getByRole("heading", { name: "Application maîtresse" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Settings/i }));
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeInTheDocument();

    act(() => {
      window.history.back();
    });
    expect(
      await screen.findByRole("heading", { name: "Application maîtresse" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/master");

    act(() => {
      window.history.forward();
    });
    expect(
      await screen.findByRole("heading", { name: "Paramètres" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/settings");
  });

  it("conserve les appels window.novaunlock après navigation vers /master", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Maître/i }));

    const preflightBtn = screen.getByRole("button", { name: /Lancer le prévol sécurisé/i });
    fireEvent.click(preflightBtn);

    expect(await screen.findByText(/PRÊT POUR VALIDATION/i)).toBeInTheDocument();
    expect(window.novaunlock.preflight).toHaveBeenCalledTimes(1);
    expect(window.novaunlock.appendAudit).toHaveBeenCalledTimes(1);
  });
});
