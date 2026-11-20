import { parse } from "tldts";

/**
 * Undoes common defanging so links written safely ("hxxps://example[.]com")
 * can still be looked up. Lookups never visit the link either way.
 */
export function refang(s: string): string {
  return s
    .replace(/hxxp/gi, "http")
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, ".")
    .replace(/\[:\]/g, ":");
}

/**
 * The registrable domain behind a URL or hostname ("parcel.royalmail.com.evil.xyz"
 * → "evil.xyz"), or null if it isn't a public internet domain: IP addresses,
 * localhost, internal names and made-up suffixes all return null.
 */
export function publicDomain(urlOrHost: string): string | null {
  const parsed = parse(refang(urlOrHost.trim()), { allowPrivateDomains: false });
  if (parsed.isIp || !parsed.isIcann || !parsed.domain) return null;
  return parsed.domain.toLowerCase();
}

/** Every public domain mentioned in a piece of text, in order, without repeats. */
export function domainsInText(text: string): string[] {
  const candidates = refang(text).match(/(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi) ?? [];
  const found: string[] = [];
  for (const c of candidates) {
    const d = publicDomain(c);
    if (d && !found.includes(d)) found.push(d);
  }
  return found;
}
