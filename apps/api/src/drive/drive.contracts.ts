import { z } from "zod";

export const driveFileOutput = z.object({
	id: z.string(),
	name: z.string(),
	mimeType: z.string(),
	size: z.number().nullable(),
	modifiedAt: z.string().nullable(),
	url: z.string(),
	isFolder: z.boolean(),
});

export const driveListInput = z.object({
	projectId: z.string().optional(),
	companyId: z.string().optional(),
	folderId: z.string().optional(),
});

export const driveListOutput = z.object({
	folderId: z.string().nullable(),
	folderUrl: z.string().nullable(),
	files: z.array(driveFileOutput),
});

export const driveCreateFolderInput = z.object({
	name: z.string().trim().min(1).max(200),
	parentId: z.string().nullable().optional(),
	projectId: z.string().optional(),
	companyId: z.string().optional(),
});

export const driveLinkFolderInput = z.object({
	link: z.string().trim().min(6),
	projectId: z.string().optional(),
	companyId: z.string().optional(),
});

export const driveUploadInput = z.object({
	name: z.string().trim().min(1).max(300),
	mimeType: z.string().trim().min(3).max(200),
	contentBase64: z.string().min(1),
	projectId: z.string().optional(),
	companyId: z.string().optional(),
	parentId: z.string().nullable().optional(),
});

export const driveFileIdInput = z.object({ fileId: z.string() });

export const driveContentsOutput = z.object({
	name: z.string(),
	mimeType: z.string(),
	base64: z.string(),
});
