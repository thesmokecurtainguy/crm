import type { Db } from "@crm/db";
import { Inject, NotFoundException } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	driveContentsOutput,
	driveCreateFolderInput,
	driveFileIdInput,
	driveFileOutput,
	driveLinkFolderInput,
	driveListInput,
	driveListOutput,
	driveUploadInput,
} from "./drive.contracts";
import { DriveService, driveIdFromUrl } from "./drive.service";

@Router({ alias: "drive" })
@UseMiddlewares(AuthMiddleware)
export class DriveRouter {
	constructor(
		@Inject(DriveService) private readonly drive: DriveService,
		@InjectDatabase() private readonly db: Db,
	) {}

	private async folderFor(input: {
		projectId?: string;
		companyId?: string;
		folderId?: string;
	}) {
		if (input.folderId)
			return { folderId: input.folderId, folderUrl: null as string | null };
		if (input.projectId) {
			const project = await this.db.project.findUnique({
				where: { id: input.projectId },
				select: { driveFolderId: true, driveFolderUrl: true },
			});
			return {
				folderId: project?.driveFolderId ?? null,
				folderUrl: project?.driveFolderUrl ?? null,
			};
		}
		if (input.companyId) {
			const company = await this.db.company.findUnique({
				where: { id: input.companyId },
				select: { driveFolderId: true, driveFolderUrl: true },
			});
			return {
				folderId: company?.driveFolderId ?? null,
				folderUrl: company?.driveFolderUrl ?? null,
			};
		}
		return { folderId: null, folderUrl: null };
	}

	@Query({
		input: driveListInput,
		output: driveListOutput,
		meta: restMeta("POST", "/drive/list", ["Drive"]),
	})
	async list(
		@Input() input: z.infer<typeof driveListInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		const { folderId, folderUrl } = await this.folderFor(input);
		if (!folderId) return { folderId: null, folderUrl: null, files: [] };
		const files = await this.drive.listFolder(ctx.user.id, folderId);
		return { folderId, folderUrl, files };
	}

	@Mutation({
		input: driveCreateFolderInput,
		output: driveFileOutput,
		meta: restMeta("POST", "/drive/folders", ["Drive"]),
	})
	async createFolder(
		@Input() input: z.infer<typeof driveCreateFolderInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.drive.createFolder(ctx.user.id, input);
	}

	@Mutation({
		input: driveLinkFolderInput,
		output: driveFileOutput,
		meta: restMeta("POST", "/drive/folders/link", ["Drive"]),
	})
	async linkFolder(
		@Input() input: z.infer<typeof driveLinkFolderInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		const folderId = driveIdFromUrl(input.link);
		if (!folderId)
			throw new NotFoundException("That doesn't look like a Drive link.");
		return this.drive.linkFolder(ctx.user.id, {
			folderId,
			projectId: input.projectId,
			companyId: input.companyId,
		});
	}

	@Mutation({
		input: driveUploadInput,
		output: driveFileOutput,
		meta: restMeta("POST", "/drive/upload", ["Drive"]),
	})
	async upload(
		@Input() input: z.infer<typeof driveUploadInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		const parentId =
			input.parentId ?? (await this.folderFor(input)).folderId ?? null;
		return this.drive.upload(ctx.user.id, {
			name: input.name,
			mimeType: input.mimeType,
			contentBase64: input.contentBase64,
			parentId,
		});
	}

	@Query({
		input: driveFileIdInput,
		output: driveContentsOutput,
		meta: restMeta("POST", "/drive/contents", ["Drive"]),
	})
	async contents(
		@Input("fileId") fileId: string,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.drive.contents(ctx.user.id, fileId);
	}
}
