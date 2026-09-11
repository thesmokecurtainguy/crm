import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmCall } from "../lib/crm-api";

export default defineTool({
	description:
		"List the files in a project's or company's Google Drive folder — names, types, sizes and links. Use it when John asks what is on file for a project, or before drafting an email that should reference a document. It lists; it does not read file contents.",
	inputSchema: z.object({
		projectId: z.string().optional(),
		companyId: z.string().optional(),
	}),
	async execute({ projectId, companyId }) {
		if (!projectId && !companyId) {
			return { ok: false as const, error: "Name a project or a company." };
		}
		const record = projectId
			? await db.project.findUnique({
					where: { id: projectId },
					select: { name: true, driveFolderId: true, driveFolderUrl: true },
				})
			: await db.company.findUnique({
					where: { id: companyId ?? "" },
					select: { name: true, driveFolderId: true, driveFolderUrl: true },
				});
		if (!record) return { ok: false as const, error: "No such record." };
		if (!record.driveFolderId) {
			return {
				ok: true as const,
				data: { name: record.name, folder: null, files: [] },
			};
		}
		return crmCall<{
			folderId: string | null;
			folderUrl: string | null;
			files: unknown[];
		}>("/drive/list", projectId ? { projectId } : { companyId });
	},
});
