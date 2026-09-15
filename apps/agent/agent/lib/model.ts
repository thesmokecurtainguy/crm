import { db } from "@crm/db";
import {
	DEFAULT_ENRICHMENT_MODEL,
	readAgentModel,
	readEnrichmentModel,
} from "@crm/db/settings";
import { type LaneModel, modelForLane } from "./agent-config";
import { purposeOf } from "./session-purpose";

export type ModelSelection = LaneModel;

type ModelContext = Parameters<typeof purposeOf>[0];

export async function selectedModel(
	ctx?: ModelContext,
): Promise<ModelSelection | null> {
	const purpose = ctx ? purposeOf(ctx) : null;

	if (purpose === "enrichment") {
		try {
			return modelForLane(purpose, readEnrichmentModel(), null);
		} catch (error) {
			console.error(
				`[agent] could not read the enrichment model, falling back: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return modelForLane(
				purpose,
				{ ...DEFAULT_ENRICHMENT_MODEL, isDefault: true },
				null,
			);
		}
	}

	try {
		return modelForLane(
			purpose,
			{ ...DEFAULT_ENRICHMENT_MODEL, isDefault: true },
			await readAgentModel(db),
		);
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}
