import type { Brand } from "./context-dev";

export type SiteLookup =
	| { outcome: "ok"; brand: Brand; raw: unknown; source: "site" }
	| { outcome: "failed"; reason: string; retryable: boolean };

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 600_000;
const USER_AGENT =
	"Mozilla/5.0 (compatible; CRM brand reader; +https://crm.johnmcphail.net)";

export async function brandFromSite(domain: string): Promise<SiteLookup> {
	const attempts = [
		`https://${domain}`,
		`https://www.${domain}`,
		`http://${domain}`,
	];
	let lastReason = "No response.";

	for (const url of attempts) {
		const page = await fetchPage(url);
		if (page.outcome !== "ok") {
			lastReason = page.reason;
			if (!page.retryable) continue;
			continue;
		}
		const brand = extractBrand(page.html, page.url, domain);
		return {
			outcome: "ok",
			brand,
			source: "site",
			raw: {
				source: "site",
				url: page.url,
				fetchedAt: new Date().toISOString(),
				brand,
			},
		};
	}

	return { outcome: "failed", reason: lastReason, retryable: true };
}

async function fetchPage(
	url: string,
): Promise<
	| { outcome: "ok"; html: string; url: string }
	| { outcome: "failed"; reason: string; retryable: boolean }
> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			redirect: "follow",
			signal: controller.signal,
			headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.5" },
		});
		if (!response.ok) {
			return {
				outcome: "failed",
				reason: `${url} answered ${response.status}.`,
				retryable: response.status >= 500 || response.status === 429,
			};
		}
		const type = response.headers.get("content-type") ?? "";
		if (!type.includes("html")) {
			return {
				outcome: "failed",
				reason: `${url} is not an HTML page.`,
				retryable: false,
			};
		}
		const text = await response.text();
		return {
			outcome: "ok",
			html: text.slice(0, MAX_BYTES),
			url: response.url || url,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return { outcome: "failed", reason: `${url}: ${reason}`, retryable: true };
	} finally {
		clearTimeout(timer);
	}
}

export function extractBrand(
	html: string,
	pageUrl: string,
	domain: string,
): Brand {
	const head = html.slice(0, 200_000);
	const meta = metaTags(head);
	const links = linkTags(head);
	const ld = jsonLd(head);

	const title =
		clean(meta.get("og:site_name")) ??
		clean(ld?.name) ??
		siteTitle(head) ??
		null;

	const description =
		clean(meta.get("description")) ??
		clean(meta.get("og:description")) ??
		clean(ld?.description) ??
		null;

	const logos: NonNullable<Brand["logos"]> = [];
	const ogImage = absolute(meta.get("og:image"), pageUrl);
	const ldLogo = absolute(
		typeof ld?.logo === "string" ? ld.logo : ld?.logo?.url,
		pageUrl,
	);
	const imgLogo = absolute(logoImage(html), pageUrl);
	const logoUrl = ldLogo ?? imgLogo ?? ogImage;
	if (logoUrl) logos.push({ url: logoUrl, mode: "light", type: "logo" });

	const icon =
		absolute(links.get("apple-touch-icon"), pageUrl) ??
		absolute(links.get("icon"), pageUrl) ??
		absolute(links.get("shortcut icon"), pageUrl) ??
		`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
	logos.push({ url: icon, mode: "has_opaque_background", type: "icon" });

	const colorHex = normaliseHex(
		meta.get("theme-color") ?? meta.get("msapplication-tilecolor"),
	);
	const colors = colorHex ? [{ hex: colorHex, name: null }] : null;

	const socials: NonNullable<Brand["socials"]> = [];
	for (const [type, pattern] of SOCIALS) {
		const match = pattern.exec(html);
		if (match?.[1]) socials.push({ type, url: match[1] });
	}

	const address = ld?.address
		? {
				city: clean(ld.address.addressLocality),
				state_code: clean(ld.address.addressRegion),
				country: clean(ld.address.addressCountry),
				country_code: null,
			}
		: addressFromText(html);

	const phone = clean(ld?.telephone) ?? firstMatch(html, /href="tel:([^"]+)"/i);
	const email = firstMatch(html, /href="mailto:([^"?]+)/i);

	return {
		domain,
		title,
		description,
		slogan: null,
		email,
		phone,
		colors,
		logos,
		socials,
		address,
		industries: null,
		links: {
			pricing: null,
			careers: absolute(
				firstMatch(html, /href="([^"]*(?:careers|jobs)[^"]*)"/i),
				pageUrl,
			),
		},
	};
}

const SOCIALS: [string, RegExp][] = [
	[
		"linkedin",
		/href="(https?:\/\/(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9_-]+)/i,
	],
	[
		"twitter",
		/href="(https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+)\/?"/i,
	],
	["github", /href="(https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_-]+)\/?"/i],
];

function metaTags(head: string): Map<string, string> {
	const out = new Map<string, string>();
	const re = /<meta\s+[^>]*>/gi;
	for (const tag of head.match(re) ?? []) {
		const key =
			attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop");
		const content = attr(tag, "content");
		if (key && content && !out.has(key.toLowerCase())) {
			out.set(key.toLowerCase(), content);
		}
	}
	return out;
}

function linkTags(head: string): Map<string, string> {
	const out = new Map<string, string>();
	const re = /<link\s+[^>]*>/gi;
	const candidates: { rel: string; href: string; size: number }[] = [];
	for (const tag of head.match(re) ?? []) {
		const rel = attr(tag, "rel")?.toLowerCase();
		const href = attr(tag, "href");
		if (!rel || !href) continue;
		const sizes = attr(tag, "sizes") ?? "";
		const size = Number.parseInt(sizes.split("x")[0] ?? "0", 10) || 0;
		candidates.push({ rel, href, size });
	}
	for (const rel of ["apple-touch-icon", "icon", "shortcut icon"]) {
		const best = candidates
			.filter((c) => c.rel === rel || c.rel.split(/\s+/).includes(rel))
			.sort((a, b) => b.size - a.size)[0];
		if (best) out.set(rel, best.href);
	}
	return out;
}

type LdOrg = {
	name?: string;
	description?: string;
	logo?: string | { url?: string };
	telephone?: string;
	address?: {
		addressLocality?: string;
		addressRegion?: string;
		addressCountry?: string;
	};
};

function jsonLd(head: string): LdOrg | null {
	const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
	let match: RegExpExecArray | null = re.exec(head);
	while (match) {
		try {
			const parsed = JSON.parse(match[1] ?? "");
			const items = Array.isArray(parsed)
				? parsed
				: [parsed, ...(parsed?.["@graph"] ?? [])];
			for (const item of items) {
				const type = String(item?.["@type"] ?? "").toLowerCase();
				if (type.includes("organization") || type.includes("localbusiness")) {
					return item as LdOrg;
				}
			}
		} catch {}
		match = re.exec(head);
	}
	return null;
}

function siteTitle(head: string): string | null {
	const raw = firstMatch(head, /<title[^>]*>([^<]*)<\/title>/i);
	if (!raw) return null;
	const first = raw.split(/\s+[|–—-]\s+/)[0] ?? raw;
	return clean(decode(first));
}

function logoImage(html: string): string | null {
	const re = /<img\s+[^>]*>/gi;
	for (const tag of html.match(re) ?? []) {
		const src = attr(tag, "src") ?? attr(tag, "data-src");
		const alt = attr(tag, "alt") ?? "";
		const cls = attr(tag, "class") ?? "";
		if (!src) continue;
		if (/logo/i.test(src) || /logo/i.test(alt) || /logo/i.test(cls)) return src;
	}
	return null;
}

function addressFromText(html: string): Brand["address"] {
	const text = html.replace(/<[^>]+>/g, " ");
	const match = /([A-Z][A-Za-z .'-]{2,40}),\s*([A-Z]{2})\s+\d{5}/.exec(text);
	if (!match) return null;
	return {
		city: match[1]?.trim() ?? null,
		state_code: match[2] ?? null,
		country: "United States",
		country_code: "US",
	};
}

function attr(tag: string, name: string): string | null {
	const re = new RegExp(
		`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
		"i",
	);
	const match = re.exec(tag);
	const value = match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
	return value ? decode(value) : null;
}

function firstMatch(text: string, re: RegExp): string | null {
	const match = re.exec(text);
	return match?.[1] ? decode(match[1]) : null;
}

function absolute(
	href: string | null | undefined,
	base: string,
): string | null {
	if (!href) return null;
	try {
		return new URL(href, base).toString();
	} catch {
		return null;
	}
}

function normaliseHex(value: string | undefined): string | null {
	if (!value) return null;
	const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
	return match?.[1] ? `#${match[1].toLowerCase()}` : null;
}

function decode(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ");
}

function clean(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}
