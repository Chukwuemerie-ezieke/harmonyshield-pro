/**
 * Live feeds system for HarmonyShield Pro
 * - RSS news from major cybersecurity outlets
 * - AlienVault OTX threat intelligence (public API)
 * - AbuseIPDB IP reputation check
 * - 15-minute server-side cache for all feeds
 */

import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "HarmonyShield-Pro/1.0",
  },
});

// ─── Cache ────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── RSS News Feeds ──────────────────────────────────
const RSS_FEEDS = [
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
  isLive: boolean;
}

export async function fetchLiveNews(): Promise<LiveNewsItem[]> {
  const cached = getCached<LiveNewsItem[]>("live-news");
  if (cached) return cached;

  const results: LiveNewsItem[] = [];

  const feedPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 5).map((item) => ({
        title: item.title || "Untitled",
        source: feed.name,
        url: item.link || "",
        summary: (item.contentSnippet || item.content || "").substring(0, 200),
        publishedAt: item.isoDate || new Date().toISOString(),
        isLive: true,
      }));
      return items;
    } catch (err) {
      console.error(`[LiveFeeds] Failed to fetch ${feed.name}:`, (err as Error).message);
      return [];
    }
  });

  const allItems = await Promise.allSettled(feedPromises);
  for (const result of allItems) {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    }
  }

  // Sort by date, newest first
  results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  setCache("live-news", results);
  return results;
}

// ─── AlienVault OTX Threat Intelligence ──────────────
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
  isLive: boolean;
  pulseUrl: string;
}

export async function fetchOTXThreats(): Promise<OTXThreat[]> {
  const cached = getCached<OTXThreat[]>("otx-threats");
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=20&page=1",
      {
        headers: {
          "X-OTX-API-KEY": process.env.OTX_API_KEY || "",
          "User-Agent": "HarmonyShield-Pro/1.0",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      // Fallback: try the public activity feed
      const publicResponse = await fetch(
        "https://otx.alienvault.com/api/v1/pulses/activity?limit=15",
        {
          headers: { "User-Agent": "HarmonyShield-Pro/1.0" },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!publicResponse.ok) {
        console.error("[LiveFeeds] OTX public API also failed:", publicResponse.status);
        setCache("otx-threats", []);
        return [];
      }

      const publicData = await publicResponse.json();
      const threats = mapOTXPulses(publicData.results || []);
      setCache("otx-threats", threats);
      return threats;
    }

    const data = await response.json();
    const threats = mapOTXPulses(data.results || []);
    setCache("otx-threats", threats);
    return threats;
  } catch (err) {
    console.error("[LiveFeeds] OTX fetch error:", (err as Error).message);
    setCache("otx-threats", []);
    return [];
  }
}

function mapOTXPulses(pulses: any[]): OTXThreat[] {
  return pulses.map((pulse: any) => {
    const tags = (pulse.tags || []).map((t: string) => t.toLowerCase());
    const isEdu = tags.some((t: string) =>
      ["education", "school", "university", "academic"].includes(t)
    ) ? 1 : 0;

    let severity = "medium";
    if (tags.some((t: string) => ["critical", "apt", "ransomware", "zero-day"].includes(t))) {
      severity = "critical";
    } else if (tags.some((t: string) => ["malware", "exploit", "backdoor"].includes(t))) {
      severity = "high";
    } else if (tags.some((t: string) => ["phishing", "spam"].includes(t))) {
      severity = "low";
    }

    let type = "other";
    if (tags.some((t: string) => ["malware", "trojan", "virus"].includes(t))) type = "malware";
    else if (tags.some((t: string) => ["phishing", "social-engineering"].includes(t))) type = "phishing";
    else if (tags.some((t: string) => ["ransomware"].includes(t))) type = "ransomware";
    else if (tags.some((t: string) => ["ddos", "dos"].includes(t))) type = "ddos";
    else if (tags.some((t: string) => ["exploit", "vulnerability", "cve"].includes(t))) type = "vulnerability";

    return {
      id: pulse.id,
      title: pulse.name || "Unknown Threat",
      description: (pulse.description || "").substring(0, 300),
      severity,
      type,
      source: "AlienVault OTX",
      publishedAt: pulse.created || new Date().toISOString(),
      country: pulse.targeted_countries?.[0] || null,
      isEducationSector: isEdu,
      isLive: true,
      pulseUrl: `https://otx.alienvault.com/pulse/${pulse.id}`,
    };
  });
}

// ─── AbuseIPDB IP Reputation ─────────────────────────
export interface IPReputationData {
  ip: string;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  totalReports: number;
  lastReportedAt: string | null;
  isWhitelisted: boolean;
  riskLevel: string;
}

/** Live reputation data retrieved from AbuseIPDB. */
export interface IPReputationLive extends IPReputationData {
  available: true;
  source: "live";
}

/** Reputation data is unavailable (no API key, or the upstream call failed). */
export interface IPReputationUnavailable {
  available: false;
  source: "unavailable";
  message: string;
}

export type IPReputationResult = IPReputationLive | IPReputationUnavailable;

const IP_UNAVAILABLE_NO_KEY: IPReputationUnavailable = {
  available: false,
  source: "unavailable",
  message: "IP reputation unavailable - ABUSEIPDB_API_KEY not configured",
};

export async function checkIPReputation(ip: string): Promise<IPReputationResult> {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) {
    // No API key: signal unavailability instead of fabricating random data.
    return IP_UNAVAILABLE_NO_KEY;
  }

  const cacheKey = `ip-${ip}`;
  const cached = getCached<IPReputationResult>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      {
        headers: {
          Key: apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.error("[LiveFeeds] AbuseIPDB error:", response.status);
      return {
        available: false,
        source: "unavailable",
        message: `IP reputation unavailable - AbuseIPDB returned ${response.status}`,
      };
    }

    const json = await response.json();
    const d = json.data;

    const result: IPReputationLive = {
      available: true,
      source: "live",
      ip: d.ipAddress,
      abuseConfidenceScore: d.abuseConfidenceScore,
      countryCode: d.countryCode,
      isp: d.isp,
      totalReports: d.totalReports,
      lastReportedAt: d.lastReportedAt,
      isWhitelisted: d.isWhitelisted,
      riskLevel:
        d.abuseConfidenceScore > 75 ? "critical" :
        d.abuseConfidenceScore > 50 ? "high" :
        d.abuseConfidenceScore > 25 ? "medium" : "low",
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[LiveFeeds] AbuseIPDB fetch error:", (err as Error).message);
    return {
      available: false,
      source: "unavailable",
      message: "IP reputation unavailable - the AbuseIPDB request failed",
    };
  }
}

// ─── Feed Status ─────────────────────────────────────
export function getFeedStatus() {
  const newsCache = cache.get("live-news");
  const otxCache = cache.get("otx-threats");

  return {
    rssFeeds: {
      status: newsCache ? "active" : "inactive",
      lastUpdate: newsCache ? new Date(newsCache.timestamp).toISOString() : null,
      sources: RSS_FEEDS.map(f => f.name),
    },
    otxThreats: {
      status: otxCache ? "active" : "inactive",
      lastUpdate: otxCache ? new Date(otxCache.timestamp).toISOString() : null,
      hasApiKey: !!process.env.OTX_API_KEY,
    },
    abuseIPDB: {
      hasApiKey: !!process.env.ABUSEIPDB_API_KEY,
    },
    cacheTTL: `${CACHE_TTL / 60000} minutes`,
  };
}
