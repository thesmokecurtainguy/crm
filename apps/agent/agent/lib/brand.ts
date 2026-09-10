import { db, EnrichmentStatus } from "@crm/db";
import { mirrorBrandImages } from "./brand-images";
import { brandToUpdate, filledFields, stillFillable } from "./brand-mapping";
import type { Brand } from "./context-dev";
import { brandByDomain, contextDevEnabled } from "./context-dev";
import { UNLESS_COMPLETE } from "./enrichment";
import { brandFromSite } from "./site-brand";

export type BrandResult = {
	enriched: boolean;
	filled?: string[];
	mirrored?: string[];
	reason?: string;
	retryable?: boolean;
};

export type Spend = (units?: number) => { ok: boolean; reason?: string };

export const FREE: Spend = () => ({ ok: true });

const COMPANY_FIELDS = {
	id: true,
	name: true,
	domain: true,
	description: true,
	logoUrl: true,
	logoDarkUrl: true,
	iconUrl: true,
	iconDarkUrl: true,
	iconTone: true,
	brandColor: true,
	industry: true,
	subIndustry: true,
	city: true,
	stateCode: true,
	country: true,
	countryCode: true,
	phone: true,
	email: true,
	linkedinUrl: true,
	twitterUrl: true,
	githubUrl: true,
	pricingUrl: true,
	careersUrl: true,
} as const;

export async function runBrand({
	companyId,
	fresh = false,
	spend = FREE,
}: {
	companyId: string;
	fresh?: boolean;
	spend?: Spend;
}): Promise<BrandResult> {
	const company = await db.company.findUnique({
		where: { id: companyId },
		select: COMPANY_FIELDS,
	});

	if (!company) return { enriched: false, reason: "No such company." };

	if (!company.domain) {
		await settle(
			companyId,
			EnrichmentStatus.SKIPPED,
			"No domain to look up.",
			UNLESS_COMPLETE,
		);
		return { enriched: false, reason: "No domain on this company." };
	}

	await db.company.updateMany({
		where: { id: companyId, ...UNLESS_COMPLETE },
		data: {
			enrichmentStatus: EnrichmentStatus.RUNNING,
			enrichmentError: null,
		},
	});

	const result = await lookupBrand(company.domain, fresh, spend);

	if (result.outcome === "skipped") {
		await settle(companyId, EnrichmentStatus.SKIPPED, result.reason);
		return { enriched: false, reason: result.reason };
	}

	if (result.outcome === "failed") {
		await settle(companyId, EnrichmentStatus.FAILED, result.reason);
		return {
			enriched: false,
			reason: result.reason,
			retryable: result.retryable,
		};
	}

	const update = brandToUpdate(result.brand, snapshot(company));

	const { mirrored } = await mirrorBrandImages(companyId, update);

	const filled = await db.$transaction(async (tx) => {
		const current = await tx.company.findUnique({
			where: { id: companyId },
			select: COMPANY_FIELDS,
		});

		if (!current) return null;

		const data = stillFillable(update, snapshot(current));

		await tx.company.update({
			where: { id: companyId },
			data: {
				...data,
				enrichmentStatus: EnrichmentStatus.COMPLETE,
				enrichedAt: new Date(),
				enrichmentError: null,
			},
		});

		await tx.companyEnrichment.upsert({
			where: { companyId },
			create: { companyId, raw: result.raw as object },
			update: { raw: result.raw as object, fetchedAt: new Date() },
		});

		return filledFields(data);
	});

	if (!filled) return { enriched: false, reason: "No such company." };

	return {
		enriched: true,
		filled,
		mirrored: mirrored.filter((slot) => filled.includes(slot)),
	};
}

async function lookupBrand(
	domain: string,
	fresh: boolean,
	spend: Spend,
): Promise<
	| { outcome: "ok"; brand: Brand; raw: unknown }
	| { outcome: "skipped"; reason: string }
	| { outcome: "failed"; reason: string; retryable?: boolean }
> {
	const site = await brandFromSite(domain);
	if (site.outcome === "ok" && (site.brand.title || site.brand.logos?.length)) {
		return { outcome: "ok", brand: site.brand, raw: site.raw };
	}

	if (await contextDevEnabled()) {
		const charge = spend(2);
		if (!charge.ok)
			return { outcome: "skipped", reason: charge.reason ?? "Budget." };
		const vendor = await brandByDomain(domain, fresh ? 0 : undefined);
		if (vendor.outcome === "found") {
			return { outcome: "ok", brand: vendor.brand, raw: vendor.raw };
		}
		return vendor;
	}

	if (site.outcome === "failed") {
		return {
			outcome: "failed",
			reason: site.reason,
			retryable: site.retryable,
		};
	}
	return { outcome: "ok", brand: site.brand, raw: site.raw };
}

function snapshot<T extends { name: string; domain: string | null }>(
	company: T,
) {
	return { ...company, nameIsPlaceholder: company.name === company.domain };
}

export function brandOutcome(result: BrandResult): string {
	if (!result.enriched) return result.reason ?? "Nothing to fill.";

	const filled = result.filled ?? [];
	const mirrored = result.mirrored ?? [];

	if (filled.length === 0) {
		return "Everything the website offered was already on the record.";
	}

	return `Filled ${filled.join(", ")}.${mirrored.length > 0 ? ` Copied ${mirrored.length} image(s) in-house.` : ""}`;
}

type SettleGuard =
	| typeof UNLESS_COMPLETE
	| { enrichmentStatus: EnrichmentStatus };

async function settle(
	companyId: string,
	status: EnrichmentStatus,
	error: string,
	guard: SettleGuard = { enrichmentStatus: EnrichmentStatus.RUNNING },
): Promise<void> {
	await db.company.updateMany({
		where: { id: companyId, ...guard },
		data: { enrichmentStatus: status, enrichmentError: error },
	});
}
