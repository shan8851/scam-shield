import { publicDomain, refang } from "./domains.js";

/**
 * Results the lookup tools hand back to the model. These are the only fields
 * that ever reach it: the post-tool hook strips anything else.
 */
export interface DomainAgeResult {
  domain: string;
  status: "ok" | "not_found" | "unavailable";
  registered: string | null;
  ageDays: number | null;
}

export interface UrlReputationResult {
  domain: string;
  status: "clean" | "flagged" | "unavailable";
  threats: string[];
}

/**
 * The lookups the agent can make. Neither ever visits the link: one asks a
 * domain registry when the domain was registered, the other asks Google
 * Safe Browsing whether the URL is a known threat. Tests and the eval use a
 * fake with recorded answers.
 */
export interface Lookups {
  domainAge(domain: string, now: Date): Promise<DomainAgeResult>;
  urlReputation(url: string): Promise<UrlReputationResult>;
}

const TIMEOUT_MS = 5_000;
/** rdap.org sits behind a bot filter that rejects Node's default user agent. */
const USER_AGENT = "scam-shield/0.1 (+https://github.com/shan8851/scam-shield)";

/** Live lookups: RDAP (no key) and Safe Browsing v4 (key optional). */
export function liveLookups(opts: { safeBrowsingKey?: string; fetch?: typeof fetch } = {}): Lookups {
  const doFetch = opts.fetch ?? fetch;
  return {
    async domainAge(domain, now) {
      try {
        const res = await doFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { accept: "application/rdap+json", "user-agent": USER_AGENT },
        });
        // rdap.org redirects to the registry for the domain's TLD, and a 404
        // from the registry means not registered. A 404 from rdap.org itself
        // (no redirect) means it has no RDAP service for that TLD (.de, .es,
        // .it, .jp and more), which tells us nothing about the domain.
        if (res.status === 404) {
          return { domain, status: res.redirected ? "not_found" : "unavailable", registered: null, ageDays: null };
        }
        if (!res.ok) return { domain, status: "unavailable", registered: null, ageDays: null };
        return parseRdap(domain, await res.json(), now);
      } catch {
        return { domain, status: "unavailable", registered: null, ageDays: null };
      }
    },
    async urlReputation(url) {
      const domain = publicDomain(url) ?? url;
      if (!opts.safeBrowsingKey) return { domain, status: "unavailable", threats: [] };
      try {
        const res = await doFetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${opts.safeBrowsingKey}`,
          {
            method: "POST",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              client: { clientId: "scam-shield", clientVersion: "0.1.0" },
              threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: [{ url: refang(url) }],
              },
            }),
          },
        );
        if (!res.ok) return { domain, status: "unavailable", threats: [] };
        return parseSafeBrowsing(domain, await res.json());
      } catch {
        return { domain, status: "unavailable", threats: [] };
      }
    },
  };
}

/** Reads the registration date out of an RDAP domain response. */
export function parseRdap(domain: string, body: unknown, now: Date): DomainAgeResult {
  const events = (body as { events?: { eventAction?: string; eventDate?: string }[] }).events ?? [];
  const date = events.find((e) => e.eventAction === "registration")?.eventDate;
  const registered = date ? new Date(date) : null;
  if (!registered || Number.isNaN(registered.getTime())) {
    return { domain, status: "unavailable", registered: null, ageDays: null };
  }
  return {
    domain,
    status: "ok",
    registered: registered.toISOString().slice(0, 10),
    ageDays: Math.floor((now.getTime() - registered.getTime()) / 86_400_000),
  };
}

/** Reads threat types out of a Safe Browsing v4 response; empty means clean. */
export function parseSafeBrowsing(domain: string, body: unknown): UrlReputationResult {
  const matches = (body as { matches?: { threatType?: string }[] }).matches ?? [];
  const threats = [...new Set(matches.map((m) => m.threatType).filter((t): t is string => !!t))];
  return { domain, status: threats.length ? "flagged" : "clean", threats };
}

/** Lookups with fixed answers, for tests and the eval. Unknown domains are "unavailable". */
export function fakeLookups(answers: {
  domainAge?: Record<string, Omit<DomainAgeResult, "domain">>;
  urlReputation?: Record<string, Omit<UrlReputationResult, "domain">>;
}): Lookups {
  return {
    async domainAge(domain) {
      const a = answers.domainAge?.[domain];
      return a ? { domain, ...a } : { domain, status: "unavailable", registered: null, ageDays: null };
    },
    async urlReputation(url) {
      const domain = publicDomain(url) ?? url;
      const a = answers.urlReputation?.[domain];
      return a ? { domain, ...a } : { domain, status: "unavailable", threats: [] };
    },
  };
}
