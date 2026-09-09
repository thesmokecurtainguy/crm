import { createListSearchParams } from "@/components/data-table/list-search-params";

export const projectsSearchParams = createListSearchParams({
	defaultSort: "lastUpdateAt",
	defaultDir: "desc",
	tabId: "status",
	facetIds: ["stage", "leadStatus", "stateCode", "owner"] as const,
});
