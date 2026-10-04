import { describe, expect, it } from "vitest";
import { ALLOWED_EXTERNAL_HOSTS, isAllowedExternalUrl } from "../electron/src/external-links";
import { JAILBREAK_METHODS } from "./lib/jailbreak/methods";

describe("Liste blanche des liens externes", () => {
  it("autorise les sources officielles en HTTPS", () => {
    expect(isAllowedExternalUrl("https://github.com/opa334/Dopamine")).toBe(true);
    expect(isAllowedExternalUrl("https://ellekit.space/dopamine/")).toBe(true);
    expect(isAllowedExternalUrl("https://palera.in/")).toBe(true);
    expect(isAllowedExternalUrl("https://ios.cfw.guide/installing-dopamine")).toBe(true);
    expect(isAllowedExternalUrl("https://theapplewiki.com/wiki/Dopamine")).toBe(true);
    expect(isAllowedExternalUrl("https://support.apple.com/fr-fr/guide")).toBe(true);
  });

  it("refuse les schémas non HTTPS et les URL illisibles", () => {
    expect(isAllowedExternalUrl("http://github.com/opa334/Dopamine")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("file:///C:/Windows/System32")).toBe(false);
    expect(isAllowedExternalUrl("https:///chemin-sans-hote")).toBe(false);
    expect(isAllowedExternalUrl("")).toBe(false);
  });

  it("refuse les hôtes ressemblants ou usurpés", () => {
    expect(isAllowedExternalUrl("https://github.com.attaquant.example/install")).toBe(false);
    expect(isAllowedExternalUrl("https://evil-github.com/ipa")).toBe(false);
    expect(isAllowedExternalUrl("https://ellekit.space.attaquant.example/dopamine")).toBe(false);
    expect(isAllowedExternalUrl("https://sous-domaine.theapplewiki.com/wiki/Dopamine")).toBe(false);
  });

  it("n'expose que des hôtes explicites", () => {
    expect(ALLOWED_EXTERNAL_HOSTS.size).toBeGreaterThan(3);
    for (const host of ALLOWED_EXTERNAL_HOSTS) {
      expect(host).toBe(host.toLowerCase());
      expect(host.startsWith("www.")).toBe(false);
    }
  });

  it("couvre toutes les sources citées par le catalogue jailbreak", () => {
    const sources = JAILBREAK_METHODS.flatMap((method) => method.sources.map((source) => source.url));
    expect(sources.length).toBeGreaterThan(10);
    for (const url of sources) {
      expect(isAllowedExternalUrl(url), `source non autorisée : ${url}`).toBe(true);
    }
  });
});
