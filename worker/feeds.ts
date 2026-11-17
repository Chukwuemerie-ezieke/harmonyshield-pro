/**
 * Live feeds for HavonaShield
 * - RSS/Atom news from major cybersecurity outlets
 * - AlienVault OTX threat intelligence
 * - AbuseIPDB IP reputation (on demand)
 *
 * News + OTX are refreshed by a Cron Trigger (every 15 min) and stored in the
 * feed_cache table, so user requests never wait on third-party APIs.
 */
import { XMLParser } from "fast-xml-parser";
import { eq, sql } from "drizzle-orm";
import { feedCache } from "@shared/schema";
import type { Database } from "./db";
import type { Env } from "./env";

const UA = "HavonaShield/1.0 (+https://havonashield.tech)";
const FETCH_TIMEOUT_MS = 10_000;

export const RSS_FEEDS = [
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/" },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
];

export interface LiveNewsItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  publishedAt: string;
  isLive: true;
}

export interface OTXThreat {
  id: string;
  title: string;
  description: string;
  severity: string;
  type: string;
  source: string;
  publishedAt: string;
  country: string | null;
  isEducationSector: number;
  isLive: true;
  pulseUrl: string;
}

// ─── Helpers ─────────────────────────────────────────
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true });

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as any)) return String((v as any)["#text"]);
  return "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function isoDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

// ─── RSS ─────────────────────────────────────────────
export function parseFeed(body: string, source: string, limit = 5): LiveNewsItem[] {
  const doc = xml.parse(body);
  const rssItems = doc?.rss?.channel?.item;
  const atomItems = doc?.feed?.entry;
  const raw: any[] = [].concat(rssItems ?? atomItems ?? []);

  return raw.slice(0, limit).map((item) => {
    const link =
      typeof item.link === "string"
        ? item.link
        : Array.isArray(item.link)
          ? (item.link.find((l: any) => l["@_rel"] !== "self")?.["@_href"] ?? "")
          : (item.link?.["@_href"] ?? "");
    const summary = stripHtml(text(item.description ?? item.summary ?? item.content ?? item["content:encoded"]));
    return {
      title: stripHtml(text(item.title)) || "Untitled",
      source,
      url: safeUrl(text(link)),
      summary: summary.substring(0, 200),
      publishedAt: isoDate(text(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"])),
      isLive: true as const,
    };
  });
}

export async function fetchLiveNews(): Promise<LiveNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetchWithTimeout(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseFeed(await res.text(), feed.name);
    }),
  );
  const items: LiveNewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.error(`[feeds] ${RSS_FEEDS[i].name} failed: ${(r.reason as Error)?.message}`);
  });
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return items;
}

// ─── OTX ─────────────────────────────────────────────
export function mapOTXPulses(pulses: any[]): OTXThreat[] {
  return pulses.map((pulse: any) => {
    const tags: string[] = (pulse.tags || []).map((t: string) => String(t).toLowerCase());
    const has = (...list: string[]) => tags.some((t) => list.includes(t));

    let severity = "medium";
    if (has("critical", "apt", "ransomware", "zero-day")) severity = "critical";
    else if (has("malware", "exploit", "backdoor")) severity = "high";
    else if (has("phishing", "spam")) severity = "low";

    let type = "other";
    if (has("malware", "trojan", "virus")) type = "malware";
    else if (has("phishing", "social-engineering")) type = "phishing";
    else if (has("ransomware")) type = "ransomware";
    else if (has("ddos", "dos")) type = "ddos";
    else if (has("exploit", "vulnerability", "cve")) type = "vulnerability";

    const id = String(pulse.id ?? "");
    return {
      id,
      title: String(pulse.name || "Unknown Threat"),
      description: String(pulse.description || "").substring(0, 300),
      severity,
      type,
      source: "AlienVault OTX",
      publishedAt: isoDate(pulse.created || ""),
      country: pulse.targeted_countries?.[0] || null,
      isEducationSector: has("education", "school", "university", "academic") ? 1 : 0,
      isLive: true as const,
      pulseUrl: `https://otx.alienvault.com/pulse/${encodeURIComponent(id)}`,
    };
  });
}

/** OTX requires a (free) API key — anonymous requests are rejected. Returns null when not configured. */
export async function fetchOTXThreats(env: Env): Promise<OTXThreat[] | null> {
  if (!env.OTX_API_KEY) return null;
  const headers = { "X-OTX-API-KEY": env.OTX_API_KEY, "User-Agent": UA };
  // Subscribed pulses first; fall back to recent global activity if the account follows nobody yet.
  for (const url of [
    "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=20&page=1",
    "https://otx.alienvault.com/api/v1/pulses/activity?limit=20",
  ]) {
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) {
      console.error(`[feeds] OTX ${new URL(url).pathname} HTTP ${res.status}`);
      continue;
    }
    const pulses = mapOTXPulses(((await res.json()) as any).results || []);
    if (pulses.length > 0) return pulses;
  }
  throw new Error("OTX returned no pulses");
}

// ─── Cache (Postgres) ────────────────────────────────
export async function readFeed<T>(db: Database, key: string): Promise<{ data: T; updatedAt: string } | null> {
  const [row] = await db.select().from(feedCache).where(eq(feedCache.key, key)).limit(1);
  return row ? { data: row.data as T, updatedAt: row.updatedAt } : null;
}

async function writeFeed(db: Database, key: string, data: unknown): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db
    .insert(feedCache)
    .values({ key, data, updatedAt })
    .onConflictDoUpdate({ target: feedCache.key, set: { data: sql`excluded.data`, updatedAt } });
}

/** Called by the cron trigger. Keeps the previous data if a source fails entirely. */
export async function refreshFeeds(db: Database, env: Env): Promise<void> {
  const [news, otx] = await Promise.allSettled([fetchLiveNews(), fetchOTXThreats(env)]);
  if (news.status === "fulfilled" && news.value.length > 0) await writeFeed(db, "news", news.value);
  else console.error("[feeds] news refresh produced no items");
  if (otx.status === "fulfilled") {
    if (otx.value) await writeFeed(db, "otx", otx.value);
  } else console.error("[feeds] OTX refresh failed:", (otx.reason as Error)?.message);
}

// ─── AbuseIPDB ───────────────────────────────────────
export interface IPReputationResult {
  ip: string;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  totalReports: number;
  lastReportedAt: string | null;
  isWhitelisted: boolean;
  riskLevel: string;
}

function riskLevel(score: number): string {
  return score > 75 ? "critical" : score > 50 ? "high" : score > 25 ? "medium" : "low";
}

export async function checkIPReputation(env: Env, ip: string): Promise<IPReputationResult | null> {
  if (!env.ABUSEIPDB_API_KEY) return null;
  const res = await fetchWithTimeout(
    `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
    { headers: { Key: env.ABUSEIPDB_API_KEY, Accept: "application/json" } },
  );
  if (!res.ok) {
    console.error("[feeds] AbuseIPDB error:", res.status);
    return null;
  }
  const d = ((await res.json()) as any).data;
  return {
    ip: d.ipAddress,
    abuseConfidenceScore: d.abuseConfidenceScore,
    countryCode: d.countryCode,
    isp: d.isp,
    totalReports: d.totalReports,
    lastReportedAt: d.lastReportedAt,
    isWhitelisted: d.isWhitelisted,
    riskLevel: riskLevel(d.abuseConfidenceScore),
  };
}
