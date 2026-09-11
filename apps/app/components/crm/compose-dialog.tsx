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
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
};

const NONE = "__none__";

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

	useEffect(() => {
		if (!open) return;
		setTo(context.to ?? "");
		setCc("");
		setTemplateId(NONE);
		setSubject(context.subject ?? "");
		setBody(context.body ?? "");
	}, [open, context.to, context.subject, context.body]);

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
			setBody(rendered.body);
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
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>New email</DialogTitle>
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
							rows={14}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							className="font-sans"
						/>
					</Field>
				</FieldGroup>
				<div className="flex items-center justify-end gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!ready || send.isPending || filling}
						onClick={() =>
							send.mutate({
								to: recipients,
								cc: ccList,
								subject: subject.trim(),
								body: body.trim(),
								contactId: context.contactId ?? null,
								companyId: context.companyId ?? null,
								projectId: context.projectId ?? null,
								dealId: context.dealId ?? null,
							})
						}
					>
						{send.isPending ? <Spinner data-icon="inline-start" /> : null}
						Send
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
