/**
 * NovaUnlock — Liste blanche des liens externes
 *
 * Le renderer isolé ne peut pas naviguer librement : chaque ouverture vers
 * l'extérieur passe par cette liste fermée, limitée aux sources officielles
 * des projets cités par le catalogue jailbreak et aux services Apple.
 */

export const ALLOWED_EXTERNAL_HOSTS: ReadonlySet<string> = new Set([
  "support.apple.com",
  "ipsw.me",
  "github.com",
  "ios.cfw.guide",
  "theapplewiki.com",
  "ellekit.space",
  "palera.in",
  "checkra.in",
  "taurine.app",
  "zhuxinlang.github.io",
]);

/**
 * N'autorise que les URL HTTPS dont l'hôte figure dans la liste blanche.
 * Les sous-domaines ne sont volontairement pas acceptés implicitement.
 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
