"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fileSize, fileToBase64 } from "@/components/crm/files-card";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export type ComposeContext = {
	to?: string | null;
	contactId?: string | null;
	companyId?: string | null;
	projectId?: string | null;
	dealId?: string | null;
	subject?: string | null;
	body?: string | null;
	reply?: boolean;
	gmailThreadId?: string | null;
};

const NONE = "__none__";
const ATTACH_LIMIT = 4_500_000;

type Attachment = {
	key: string;
	name: string;
	size: number | null;
	mode: "attach" | "link";
	mimeType?: string;
	base64?: string;
	url?: string;
	driveId?: string;
};

function withSignature(body: string, signature: string): string {
	const trimmed = body.replace(/\s+$/, "");
	if (!signature.trim()) return trimmed;
	if (trimmed.endsWith(signature.trim())) return trimmed;
	return `${trimmed}\n\n${signature.trim()}`;
}

export function ComposeDialog({
	open,
	onOpenChange,
	context,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	context: ComposeContext;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();

	const [to, setTo] = useState("");
	const [cc, setCc] = useState("");
	const [templateId, setTemplateId] = useState(NONE);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [filling, setFilling] = useState(false);

	const templates = useQuery({
		...trpc.templates.list.queryOptions({ includeArchived: false }),
		enabled: open,
	});
	const signature = useQuery({
		...trpc.templates.signature.queryOptions(),
		enabled: open,
	});
	const [useLogo, setUseLogo] = useState(true);
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [picking, setPicking] = useState(false);
	const [working, setWorking] = useState(false);
	const uploadRef = useRef<HTMLInputElement>(null);

	const driveFiles = useQuery({
		...trpc.drive.list.queryOptions(
			context.projectId
				? { projectId: context.projectId }
				: { companyId: context.companyId ?? "" },
		),
		enabled: open && picking && Boolean(context.projectId || context.companyId),
	});

	const driveUpload = useMutation(trpc.drive.upload.mutationOptions({}));

	const signatureBlock = context.reply
		? signature.data?.short
		: signature.data?.full;

	useEffect(() => {
		if (!open) return;
		setTo(context.to ?? "");
		setCc("");
		setTemplateId(NONE);
		setSubject(context.subject ?? "");
		setBody(withSignature(context.body ?? "", signatureBlock ?? ""));
		setUseLogo(!context.reply);
	}, [
		open,
		context.to,
		context.subject,
		context.body,
		context.reply,
		signatureBlock,
	]);

	const send = useMutation(
		trpc.templates.sendEmail.mutationOptions({
			onSuccess: async () => {
				await cache.activity();
				toast.success(
					"Sent. It's in your Gmail Sent folder and on the record.",
				);
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	async function applyTemplate(id: string) {
		setTemplateId(id);
		if (id === NONE) return;
		setFilling(true);
		try {
			const rendered = await queryClient.fetchQuery(
				trpc.templates.render.queryOptions({
					templateId: id,
					contactId: context.contactId ?? null,
					companyId: context.companyId ?? null,
					projectId: context.projectId ?? null,
					dealId: context.dealId ?? null,
				}),
			);
			setSubject(rendered.subject);
			setBody(withSignature(rendered.body, signatureBlock ?? ""));
			if (rendered.missing.length > 0) {
				toast.message(
					`Left blank (nothing on the record): ${rendered.missing.join(", ")}`,
				);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not fill the template.",
			);
		} finally {
			setFilling(false);
		}
	}

	const recipients = to
		.split(/[,\s]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const ccList = cc
		.split(/[,\s]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const ready = recipients.length > 0 && subject.trim() && body.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92vh] w-[min(96vw,1180px)] overflow-y-auto text-sm sm:max-w-[min(96vw,1180px)]">
				<DialogHeader>
					<DialogTitle>{context.reply ? "Reply" : "New email"}</DialogTitle>
					<DialogDescription>
						Sends from your Gmail, threads normally, and lands on the record.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel>To</FieldLabel>
							<Input
								value={to}
								onChange={(e) => setTo(e.target.value)}
								placeholder="name@firm.com"
							/>
						</Field>
						<Field>
							<FieldLabel>Cc</FieldLabel>
							<Input
								value={cc}
								onChange={(e) => setCc(e.target.value)}
								placeholder="optional"
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel>Template</FieldLabel>
						<Select
							value={templateId}
							onValueChange={applyTemplate}
							disabled={filling}
						>
							<SelectTrigger>
								<SelectValue placeholder="Start from a template" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>Blank</SelectItem>
								{(templates.data ?? []).map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Subject</FieldLabel>
						<Input
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel>Body</FieldLabel>
						<Textarea
							rows={20}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							className="min-h-[440px] font-sans text-[15px] leading-relaxed"
						/>
					</Field>
					{signature.data?.logoUrl ? (
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={useLogo}
								onChange={(e) => setUseLogo(e.target.checked)}
							/>
							Include the signature logo
						</label>
					) : null}
				</FieldGroup>
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={working}
							onClick={() => uploadRef.current?.click()}
						>
							{working ? <Spinner data-icon="inline-start" /> : null}
							Attach a file
						</Button>
						{context.projectId || context.companyId ? (
							<Button
								size="sm"
								variant={picking ? "ghost" : "outline"}
								onClick={() => setPicking((value) => !value)}
							>
								{picking ? "Close Drive" : "From Drive"}
							</Button>
						) : null}
						<input
							ref={uploadRef}
							type="file"
							multiple
							className="hidden"
							onChange={async (event) => {
								const list = event.target.files;
								if (!list?.length) return;
								setWorking(true);
								try {
									for (const file of Array.from(list)) {
										if (file.size > ATTACH_LIMIT) {
											const base64 = await fileToBase64(file);
											const saved = await driveUpload.mutateAsync({
												...(context.projectId
													? { projectId: context.projectId }
													: { companyId: context.companyId ?? "" }),
												name: file.name,
												mimeType: file.type || "application/octet-stream",
												contentBase64: base64,
											});
											setAttachments((prev) => [
												...prev,
												{
													key: saved.id,
													name: saved.name,
													size: saved.size,
													mode: "link",
													url: saved.url,
													driveId: saved.id,
												},
											]);
											toast.message(
												`${file.name} is too big to attach — it went to Drive and the link is on the email.`,
											);
											continue;
										}
										const base64 = await fileToBase64(file);
										setAttachments((prev) => [
											...prev,
											{
												key: `${file.name}-${file.size}`,
												name: file.name,
												size: file.size,
												mode: "attach",
												mimeType: file.type || "application/octet-stream",
												base64,
											},
										]);
									}
								} catch (error) {
									toast.error(
										error instanceof Error
											? error.message
											: "Could not attach that.",
									);
								} finally {
									setWorking(false);
									if (uploadRef.current) uploadRef.current.value = "";
								}
							}}
						/>
					</div>

					{picking ? (
						<ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
							{(driveFiles.data?.files ?? [])
								.filter((file) => !file.isFolder)
								.map((file) => (
									<li key={file.id}>
										<button
											type="button"
											className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-accent"
											onClick={async () => {
												const tooBig =
													file.size !== null && file.size > ATTACH_LIMIT;
												if (tooBig) {
													setAttachments((prev) => [
														...prev,
														{
															key: file.id,
															name: file.name,
															size: file.size,
															mode: "link",
															url: file.url,
															driveId: file.id,
														},
													]);
													setPicking(false);
													return;
												}
												setWorking(true);
												try {
													const contents = await queryClient.fetchQuery(
														trpc.drive.contents.queryOptions({
															fileId: file.id,
														}),
													);
													setAttachments((prev) => [
														...prev,
														{
															key: file.id,
															name: contents.name,
															size: file.size,
															mode: "attach",
															mimeType: contents.mimeType,
															base64: contents.base64,
															url: file.url,
															driveId: file.id,
														},
													]);
													setPicking(false);
												} catch (error) {
													toast.error(
														error instanceof Error
															? error.message
															: "Could not read that file.",
													);
												} finally {
													setWorking(false);
												}
											}}
										>
											<span className="min-w-0 truncate">{file.name}</span>
											<span className="ml-auto shrink-0 text-muted-foreground text-xs">
												{fileSize(file.size)}
											</span>
										</button>
									</li>
								))}
							{(driveFiles.data?.files ?? []).length === 0 ? (
								<li className="px-3 py-2 text-muted-foreground">
									No Drive folder on this record yet, or it's empty.
								</li>
							) : null}
						</ul>
					) : null}

					{attachments.length > 0 ? (
						<ul className="divide-y rounded-md border text-sm">
							{attachments.map((file) => (
								<li
									key={file.key}
									className="flex flex-wrap items-center gap-2 px-3 py-1.5"
								>
									<span className="min-w-0 truncate">{file.name}</span>
									<span className="text-muted-foreground text-xs">
										{fileSize(file.size)}
									</span>
									<span className="ml-auto flex items-center gap-2">
										{file.url ? (
											<Button
												size="sm"
												variant="ghost"
												onClick={() =>
													setAttachments((prev) =>
														prev.map((item) =>
															item.key === file.key
																? {
																		...item,
																		mode:
																			item.mode === "link" ? "attach" : "link",
																	}
																: item,
														),
													)
												}
												disabled={
													file.mode === "link" &&
													(!file.base64 ||
														(file.size !== null && file.size > ATTACH_LIMIT))
												}
											>
												{file.mode === "link" ? "Sent as link" : "Attached"}
											</Button>
										) : (
											<span className="text-muted-foreground text-xs">
												Attached
											</span>
										)}
										<Button
											size="sm"
											variant="ghost"
											onClick={() =>
												setAttachments((prev) =>
													prev.filter((item) => item.key !== file.key),
												)
											}
										>
											Remove
										</Button>
									</span>
								</li>
							))}
						</ul>
					) : null}
				</div>

				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!ready || send.isPending || filling}
						onClick={() => {
							const links = attachments.filter(
								(file) => file.mode === "link" && file.url,
							);
							const linkBlock = links.length
								? `\n\n${links.map((file) => `${file.name}: ${file.url}`).join("\n")}`
								: "";
							send.mutate({
								to: recipients,
								cc: ccList,
								subject: subject.trim(),
								body: `${body.trim()}${linkBlock}`,
								attachments: attachments
									.filter((file) => file.mode === "attach" && file.base64)
									.map((file) => ({
										name: file.name,
										mimeType: file.mimeType ?? "application/octet-stream",
										base64: file.base64 ?? "",
									})),
								contactId: context.contactId ?? null,
								companyId: context.companyId ?? null,
								projectId: context.projectId ?? null,
								dealId: context.dealId ?? null,
								gmailThreadId: context.gmailThreadId ?? null,
								logoUrl: useLogo ? (signature.data?.logoUrl ?? null) : null,
							});
						}}
					>
						{send.isPending ? <Spinner data-icon="inline-start" /> : null}
						Send
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
