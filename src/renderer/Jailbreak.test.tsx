import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function mockBridge(
  openExternal = vi.fn().mockResolvedValue({ success: true }),
  options: { installReady?: boolean; devicePaired?: boolean; ipaPath?: string | null } = {}
) {
  const { installReady = true, devicePaired = true, ipaPath = "/tmp/telechargements/Dopamine.ipa" } = options;
  const capabilities = vi.fn().mockResolvedValue({ installReady, devicePaired });
  const selectJailbreakIpa = vi.fn().mockResolvedValue(ipaPath);
  const applyJailbreak = vi.fn().mockResolvedValue({
    id: "11111111-2222-3333-4444-555555555555",
    methodId: "dopamine",
    methodName: "Dopamine",
    state: "running",
    progress: 10,
    stage: "Préparation de l'action…",
    updatedAt: new Date().toISOString(),
  });
  const getJailbreakOperationStatus = vi.fn().mockResolvedValue({
    id: "11111111-2222-3333-4444-555555555555",
    methodId: "dopamine",
    methodName: "Dopamine",
    state: "completed",
    progress: 100,
    stage: "Installation terminée",
    updatedAt: new Date().toISOString(),
    result: {
      success: true,
      methodId: "dopamine",
      methodName: "Dopamine",
      kind: "install-ipa",
      stage: "Installation terminée",
      message: "IPA installé. Sur l'appareil, ouvrez l'application jailbreak et lancez la procédure.",
      artifact: { fileName: "Dopamine.ipa", size: "12.4 Mo", sha256: "a".repeat(64) },
    },
  });
  window.novaunlock = {
    scanDevices: vi.fn().mockResolvedValue(null),
    connectDevice: vi.fn().mockResolvedValue(true),
    disconnectDevice: vi.fn().mockResolvedValue(true),
    sendDFUCommand: vi.fn().mockResolvedValue({ success: true }),
    sendRecoveryCommand: vi.fn().mockResolvedValue({ success: true }),
    flashFirmware: vi.fn().mockResolvedValue({ success: false, progress: 0, stage: "", speed: "" }),
    getDeviceInfo: vi.fn().mockResolvedValue(null),
    getECID: vi.fn().mockResolvedValue(null),
    getActivationLockStatus: vi.fn().mockResolvedValue({ locked: null, account: null }),
    checkJailbreakStatus: vi.fn().mockResolvedValue(false),
    installLibimobiledevice: vi.fn().mockResolvedValue({
      success: false,
      message: "",
      status: {
        diagnosticsReady: false,
        backupReady: false,
        restoreReady: false,
        activationCheckReady: false,
        complete: false,
        hasDlls: false,
        searchRoots: [],
        tools: {},
        missing: [],
        source: "none",
      },
    }),
    listBackups: vi.fn().mockResolvedValue([]),
    selectFirmwareFile: vi.fn().mockResolvedValue(null),
    downloadFirmware: vi.fn().mockResolvedValue(""),
    preflight: vi.fn().mockResolvedValue({
      task: "inspect",
      ok: true,
      dryRun: true,
      canExecute: true,
      blockers: [],
      warnings: [],
      steps: [],
      activationLockNotice: "",
      backupCount: 0,
      diskFreeGb: 0,
      requirements: {
        ownerAttestation: false,
        typedConfirmation: false,
        backupPassword: false,
        firmwareFile: false,
        requiredMode: null,
      },
    }),
    executeMaster: vi.fn(),
    getMasterOperationStatus: vi.fn().mockResolvedValue(null),
    appendAudit: vi.fn().mockResolvedValue({ success: true }),
    openExternal,
    jailbreakCapabilities: capabilities,
    selectJailbreakIpa,
    applyJailbreak,
    getJailbreakOperationStatus,
  } as unknown as typeof window.novaunlock;
  return { openExternal, capabilities, selectJailbreakIpa, applyJailbreak, getJailbreakOperationStatus };
}

function connectedDevice(modelIdentifier: string, iosVersion: string) {
  useDeviceStore.getState().setConnection({ isConnected: true, currentMode: "normal" });
  useDeviceStore.getState().setDeviceInfo({ model: "iPhone", modelIdentifier, iosVersion });
}

describe("Assistant jailbreak", () => {
  beforeEach(() => {
    useDeviceStore.getState().resetAll();
    vi.clearAllMocks();
    mockBridge();
  });

  afterEach(() => {
    cleanup();
  });

  it("présente le catalogue sans exiger d'appareil connecté", () => {
    render(<Jailbreak />);

    expect(screen.getByRole("heading", { name: "Assistant jailbreak" })).toBeInTheDocument();
    expect(screen.getByTestId("verdict-summary")).toHaveTextContent(/à déterminer/i);
    expect(screen.getByTestId("methode-dopamine")).toBeInTheDocument();
    expect(screen.getByTestId("methode-palera1n")).toBeInTheDocument();
    expect(screen.getByTestId("methode-trollstore")).toBeInTheDocument();
  });

  it("calcule la compatibilité de l'appareil connecté et classe les méthodes", () => {
    connectedDevice("iPhone13,2", "17.3.1");
    render(<Jailbreak />);

    expect(screen.getByTestId("verdict-summary")).toHaveTextContent(/1 méthode\(s\) compatible\(s\)/i);

    const dopamine = screen.getByTestId("methode-dopamine");
    expect(within(dopamine).getByText("Compatible")).toBeInTheDocument();

    // Le filtre par défaut masque les puces non prises en charge : palera1n ne vise pas les A14.
    expect(screen.queryByTestId("methode-palera1n")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    const palera1n = screen.getByTestId("methode-palera1n");
    expect(within(palera1n).getByText("Non prise en charge")).toBeInTheDocument();
  });

  it("signale les méthodes hors plage avec la plage prise en charge", () => {
    connectedDevice("iPhone13,2", "18.5");
    render(<Jailbreak />);

    const dopamine = screen.getByTestId("methode-dopamine");
    expect(within(dopamine).getByText("Hors plage")).toBeInTheDocument();
    expect(within(dopamine).getByText(/15\.0 – 17\.3\.1/)).toBeInTheDocument();
    expect(screen.getByTestId("verdict-summary")).toHaveTextContent(/0 méthode\(s\) compatible\(s\)/i);
  });

  it("avertit qu'une méthode exige macOS ou Linux plutôt que ce PC Windows", () => {
    connectedDevice("iPhone10,3", "16.7.1");
    render(<Jailbreak />);

    const palera1n = screen.getByTestId("methode-palera1n");
    expect(within(palera1n).getByText("Compatible")).toBeInTheDocument();
    expect(within(palera1n).getByText(/pas depuis ce PC/)).toBeInTheDocument();
  });

  it("permet de choisir la puce et la version iOS à la main", () => {
    render(<Jailbreak />);

    fireEvent.change(screen.getByLabelText(/Puce \(détection automatique ou choix manuel\)/i), {
      target: { value: "A11" },
    });
    fireEvent.change(screen.getByLabelText(/Version iOS si l’appareil n’est pas connecté/i), {
      target: { value: "16.7.1" },
    });

    expect(screen.getByText(/A11 Bionic \(arm64\)/)).toBeInTheDocument();
    const dopamine = screen.getByTestId("methode-dopamine");
    expect(within(dopamine).getByText("Compatible")).toBeInTheDocument();
  });

  it("analyse le périphérique connecté par le scanner USB", async () => {
    connectedDevice("iPhone10,3", "16.7.1");
    vi.mocked(DeviceDetector.fetchDeviceInfo).mockResolvedValue(undefined);

    render(<Jailbreak />);
    fireEvent.click(screen.getByRole("button", { name: /Analyser \/ actualiser l’appareil/i }));

    await waitFor(() => expect(DeviceDetector.fetchDeviceInfo).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(/Analyse terminée/i);
  });

  it("ouvre les sources officielles via le pont sécurisé", () => {
    const { openExternal } = mockBridge();
    render(<Jailbreak />);

    const dopamine = screen.getByTestId("methode-dopamine");
    fireEvent.click(within(dopamine).getByRole("button", { name: /Voir prérequis, étapes et sources/i }));
    fireEvent.click(within(dopamine).getByRole("button", { name: /Téléchargement officiel/i }));

    expect(openExternal).toHaveBeenCalledWith("https://ellekit.space/dopamine/");
  });

  it("filtre l'affichage sur les méthodes compatibles", () => {
    connectedDevice("iPhone13,2", "17.3.1");
    render(<Jailbreak />);

    fireEvent.click(screen.getByRole("button", { name: "Compatibles" }));

    expect(screen.getByTestId("methode-dopamine")).toBeInTheDocument();
    expect(screen.queryByTestId("methode-checkra1n")).toBeNull();
  });

  it("retient automatiquement la méthode adaptée à l'appareil connecté", async () => {
    connectedDevice("iPhone10,3", "16.7.1");
    render(<Jailbreak />);

    const selection = await screen.findByTestId("auto-selection");
    expect(selection).toHaveTextContent(/Méthode retenue automatiquement/i);
    expect(selection).toHaveTextContent("Dopamine");
    expect(screen.getByTestId("plan-outcome")).toHaveTextContent(/Bloqué/i);
    expect(screen.getByTestId("installer-status")).toHaveTextContent(/ideviceinstaller prêt/i);
  });

  it("bloque l'application tant que l'IPA n'est pas sélectionné puis autorise l'installation confirmée", async () => {
    connectedDevice("iPhone10,3", "16.7.1");
    const { applyJailbreak, selectJailbreakIpa } = mockBridge();
    render(<Jailbreak />);

    await screen.findByTestId("auto-selection");
    const applyButton = screen.getByTestId("apply-button");
    expect(applyButton).toBeDisabled();
    expect(screen.getByTestId("plan-outcome")).toHaveTextContent(/Bloqué/i);

    fireEvent.click(screen.getByRole("button", { name: /Choisir l'IPA téléchargé/i }));
    await waitFor(() => expect(selectJailbreakIpa).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("artifact-path")).toHaveTextContent("Dopamine.ipa");
    expect(screen.getByTestId("plan-outcome")).toHaveTextContent(/Prêt à appliquer/i);

    // Le bouton reste bloqué sans consentement ni mot de confirmation.
    expect(screen.getByTestId("apply-button")).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Consentement propriétaire/i));
    fireEvent.change(screen.getByLabelText(/Confirmation d'installation/i), { target: { value: "JAILBREAK" } });
    expect(screen.getByTestId("apply-button")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("apply-button"));
    await waitFor(() => expect(applyJailbreak).toHaveBeenCalledTimes(1));
    const action = applyJailbreak.mock.calls[0][0];
    expect(action).toMatchObject({ methodId: "dopamine", kind: "install-ipa", sourceUrl: "https://ellekit.space/dopamine/" });
    expect(action.artifactPath).toMatch(/Dopamine\.ipa$/);

    expect(await screen.findByTestId("operation", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("bloque l'installation quand ideviceinstaller est absent", async () => {
    connectedDevice("iPhone10,3", "16.7.1");
    mockBridge(vi.fn().mockResolvedValue({ success: true }), { installReady: false });
    render(<Jailbreak />);

    await screen.findByTestId("auto-selection");
    expect(screen.getByTestId("installer-status")).toHaveTextContent(/absent/i);
    expect(screen.getByTestId("apply-button")).toBeDisabled();
    expect(screen.getByText(/ideviceinstaller\.exe est absent/i)).toBeInTheDocument();
  });

  it("affiche les étapes manuelles sans exécuter quoi que ce soit quand la méthode est déjà retenue", async () => {
    connectedDevice("iPhone10,3", "16.7.1");
    mockBridge();
    render(<Jailbreak />);

    await screen.findByTestId("auto-selection");
    fireEvent.change(screen.getByLabelText(/Remplacer la méthode retenue/i), { target: { value: "palera1n" } });

    expect(screen.getByTestId("plan-outcome")).toHaveTextContent(/Action manuelle/i);
    expect(screen.getByTestId("plan-kind")).toHaveTextContent(/Étapes manuelles/i);
    expect(screen.getByText(/Aucune commande n'est exécutée par NovaUnlock/i)).toBeInTheDocument();
    expect(screen.queryByTestId("apply-button")).toBeNull();
  });

  it("rappelle qu'aucune charge utile n'est téléchargée ni exécutée", () => {
    render(<Jailbreak />);

    expect(
      screen.getByText(/ne télécharge, n’installe et n’exécute aucune charge utile de jailbreak/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/contourne un code d’accès, Activation Lock/i)).toBeInTheDocument();
  });
});
