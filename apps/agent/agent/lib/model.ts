import { db } from "@crm/db";
import { readAgentModel, readEnrichmentModel } from "@crm/db/settings";
import { purposeOf, type SessionPurpose } from "./session-purpose";

export interface ModelSelection {
	model: string;
	modelContextWindowTokens: number;
}

type ModelContext = Parameters<typeof purposeOf>[0];

export async function selectedModel(
	ctx?: ModelContext,
): Promise<ModelSelection | null> {
	const purpose: SessionPurpose | null = ctx ? purposeOf(ctx) : null;

	if (purpose === "enrichment") {
		try {
			const setting = readEnrichmentModel();
			return {
				model: setting.id,
				modelContextWindowTokens: setting.contextWindowTokens,
			};
		} catch (error) {
			console.error(
				`[agent] could not read the enrichment model, falling back: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return null;
		}
	}

	try {
		const setting = await readAgentModel(db);

		if (setting.isDefault) return null;

		return {
			model: setting.id,
			modelContextWindowTokens: setting.contextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}
