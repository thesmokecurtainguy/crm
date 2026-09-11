import { DRIVE_SCOPE, parseScopes } from "@crm/auth";
import type { Db } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { MailboxApiClient } from "../mailbox/mailbox-api.client";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const ATTACH_LIMIT_BYTES = 4_500_000;

export type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
	size: number | null;
	modifiedAt: string | null;
	url: string;
	isFolder: boolean;
};

type ApiFile = {
	id: string;
	name: string;
	mimeType: string;
	size?: string;
	modifiedTime?: string;
	webViewLink?: string;
};

@Injectable()
export class DriveService {
	private readonly logger = new Logger(DriveService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
	) {}

	private async token(userId: string) {
		const account = await this.db.account.findFirst({
			where: { userId, providerId: "google" },
			select: { scope: true },
		});
		if (!parseScopes(account?.scope).has(DRIVE_SCOPE)) {
			throw new ForbiddenException(
				"Drive access has not been granted yet. Sign out and back in to approve it.",
			);
		}
		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome !== "ok") throw new ForbiddenException(token.reason);
		return token.accessToken;
	}

	async listFolder(userId: string, folderId: string): Promise<DriveFile[]> {
		const accessToken = await this.token(userId);
		const result = await this.api.get<{ files?: ApiFile[] }>(
			`${DRIVE}/files`,
			accessToken,
			{
				q: `'${folderId}' in parents and trashed = false`,
				fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
				orderBy: "folder,modifiedTime desc",
				pageSize: "100",
				supportsAllDrives: "true",
				includeItemsFromAllDrives: "true",
			},
		);
		if (result.outcome !== "ok") {
			throw new BadRequestException(
				`Drive would not list that folder: ${result.reason}.`,
			);
		}
		return (result.data.files ?? []).map(toFile);
	}

	async fileById(userId: string, fileId: string): Promise<DriveFile> {
		const accessToken = await this.token(userId);
		const result = await this.api.get<ApiFile>(
			`${DRIVE}/files/${encodeURIComponent(fileId)}`,
			accessToken,
			{
				fields: "id,name,mimeType,size,modifiedTime,webViewLink",
				supportsAllDrives: "true",
			},
		);
		if (result.outcome !== "ok") {
			throw new NotFoundException(
				`Drive would not open that file: ${result.reason}. If it wasn't created here, open it in Drive and share it with the CRM, or upload it instead.`,
			);
		}
		return toFile(result.data);
	}

	async createFolder(
		userId: string,
		input: {
			name: string;
			parentId?: string | null;
			projectId?: string;
			companyId?: string;
		},
	) {
		const accessToken = await this.token(userId);
		const result = await this.api.send<ApiFile>(
			"POST",
			`${DRIVE}/files`,
			accessToken,
			{
				name: input.name,
				mimeType: FOLDER_MIME,
				...(input.parentId ? { parents: [input.parentId] } : {}),
			},
		);
		if (result.outcome !== "ok") {
			throw new BadRequestException(
				`Drive would not create the folder: ${result.reason}.`,
			);
		}
		const folder = toFile(result.data);
		if (input.projectId) {
			await this.db.project.update({
				where: { id: input.projectId },
				data: { driveFolderId: folder.id, driveFolderUrl: folder.url },
			});
		}
		if (input.companyId) {
			await this.db.company.update({
				where: { id: input.companyId },
				data: { driveFolderId: folder.id, driveFolderUrl: folder.url },
			});
		}
		this.logger.log({ message: "Drive folder created", folderId: folder.id });
		return folder;
	}

	async linkFolder(
		userId: string,
		input: { folderId: string; projectId?: string; companyId?: string },
	) {
		const folder = await this.fileById(userId, input.folderId);
		if (!folder.isFolder)
			throw new BadRequestException("That link is a file, not a folder.");
		if (input.projectId) {
			await this.db.project.update({
				where: { id: input.projectId },
				data: { driveFolderId: folder.id, driveFolderUrl: folder.url },
			});
		}
		if (input.companyId) {
			await this.db.company.update({
				where: { id: input.companyId },
				data: { driveFolderId: folder.id, driveFolderUrl: folder.url },
			});
		}
		return folder;
	}

	async upload(
		userId: string,
		input: {
			name: string;
			mimeType: string;
			contentBase64: string;
			parentId?: string | null;
		},
	) {
		const accessToken = await this.token(userId);
		const bytes = Buffer.from(input.contentBase64, "base64");
		const boundary = `d_${Date.now().toString(36)}`;
		const metadata = JSON.stringify({
			name: input.name,
			...(input.parentId ? { parents: [input.parentId] } : {}),
		});
		const body = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
			),
			Buffer.from(`--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
			bytes,
			Buffer.from(`\r\n--${boundary}--`),
		]);

		const response = await fetch(
			`${UPLOAD}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink&supportsAllDrives=true`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${accessToken}`,
					"content-type": `multipart/related; boundary=${boundary}`,
				},
				body: new Uint8Array(body),
			},
		);
		const text = await response.text();
		if (!response.ok) {
			throw new BadRequestException(
				`Drive would not take the upload: ${text.slice(0, 300)}`,
			);
		}
		const file = toFile(JSON.parse(text) as ApiFile);
		this.logger.log({
			message: "Uploaded to Drive",
			fileId: file.id,
			bytes: bytes.length,
		});
		return file;
	}

	async contents(
		userId: string,
		fileId: string,
	): Promise<{ name: string; mimeType: string; base64: string }> {
		const accessToken = await this.token(userId);
		const meta = await this.fileById(userId, fileId);
		if (meta.isFolder)
			throw new BadRequestException("That is a folder, not a file.");
		if (meta.size !== null && meta.size > ATTACH_LIMIT_BYTES) {
			throw new BadRequestException(
				`${meta.name} is too big to attach. Send it as a Drive link instead.`,
			);
		}
		const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
		const url = isGoogleDoc
			? `${DRIVE}/files/${encodeURIComponent(fileId)}/export?mimeType=application%2Fpdf`
			: `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
		const response = await fetch(url, {
			headers: { authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) {
			throw new BadRequestException(
				`Drive would not download that file (${response.status}).`,
			);
		}
		const buffer = Buffer.from(await response.arrayBuffer());
		if (buffer.length > ATTACH_LIMIT_BYTES) {
			throw new BadRequestException(
				`${meta.name} is too big to attach. Send it as a Drive link instead.`,
			);
		}
		return {
			name: isGoogleDoc ? `${meta.name}.pdf` : meta.name,
			mimeType: isGoogleDoc ? "application/pdf" : meta.mimeType,
			base64: buffer.toString("base64"),
		};
	}
}

export function driveIdFromUrl(raw: string): string | null {
	const value = raw.trim();
	if (/^[\w-]{20,}$/.test(value)) return value;
	const patterns = [
		/\/folders\/([\w-]+)/,
		/\/file\/d\/([\w-]+)/,
		/\/document\/d\/([\w-]+)/,
		/\/spreadsheets\/d\/([\w-]+)/,
		/\/presentation\/d\/([\w-]+)/,
		/[?&]id=([\w-]+)/,
	];
	for (const pattern of patterns) {
		const match = pattern.exec(value);
		if (match?.[1]) return match[1];
	}
	return null;
}

function toFile(file: ApiFile): DriveFile {
	const isFolder = file.mimeType === FOLDER_MIME;
	return {
		id: file.id,
		name: file.name,
		mimeType: file.mimeType,
		size: file.size ? Number(file.size) : null,
		modifiedAt: file.modifiedTime ?? null,
		url:
			file.webViewLink ??
			(isFolder
				? `https://drive.google.com/drive/folders/${file.id}`
				: `https://drive.google.com/file/d/${file.id}/view`),
		isFolder,
	};
}
