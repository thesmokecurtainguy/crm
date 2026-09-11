"use client";

import Launch from "@carbon/icons-react/es/Launch";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { LocalDay } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";

export function fileSize(bytes: number | null): string {
	if (bytes === null) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fileToBase64(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const chunk = 8192;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export function FilesCard({
	projectId,
	companyId,
	folderName,
}: {
	projectId?: string;
	companyId?: string;
	folderName: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [link, setLink] = useState("");
	const [busy, setBusy] = useState(false);

	const scope = projectId ? { projectId } : { companyId: companyId ?? "" };
	const files = useQuery(trpc.drive.list.queryOptions(scope));

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: trpc.drive.list.queryKey() });

	const createFolder = useMutation(
		trpc.drive.createFolder.mutationOptions({
			onSuccess: async () => {
				await refresh();
				await queryClient.invalidateQueries();
				toast.success("Folder created in your Drive.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const linkFolder = useMutation(
		trpc.drive.linkFolder.mutationOptions({
			onSuccess: async () => {
				setLink("");
				await refresh();
				await queryClient.invalidateQueries();
				toast.success("Folder linked.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const upload = useMutation(
		trpc.drive.upload.mutationOptions({
			onSuccess: async (file) => {
				await refresh();
				toast.success(`${file.name} uploaded.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	async function onPick(list: FileList | null) {
		if (!list?.length) return;
		setBusy(true);
		try {
			for (const file of Array.from(list)) {
				const base64 = await fileToBase64(file);
				await upload.mutateAsync({
					...scope,
					name: file.name,
					mimeType: file.type || "application/octet-stream",
					contentBase64: base64,
				});
			}
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	if (files.isPending) return <Spinner />;

	if (!files.data?.folderId) {
		return (
			<div className="space-y-3 text-sm">
				<p className="text-muted-foreground">
					No Drive folder yet. Create one named after this record, or paste the
					link to a folder you already have.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						size="sm"
						disabled={createFolder.isPending}
						onClick={() => createFolder.mutate({ ...scope, name: folderName })}
					>
						{createFolder.isPending ? (
							<Spinner data-icon="inline-start" />
						) : null}
						Create folder in Drive
					</Button>
					<Input
						value={link}
						onChange={(event) => setLink(event.target.value)}
						placeholder="…or paste a Drive folder link"
						className="w-[280px]"
					/>
					<Button
						size="sm"
						variant="outline"
						disabled={!link.trim() || linkFolder.isPending}
						onClick={() => linkFolder.mutate({ ...scope, link })}
					>
						Link
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				{files.data.folderUrl ? (
					<Button asChild size="sm" variant="outline">
						<a href={files.data.folderUrl} target="_blank" rel="noreferrer">
							Open folder in Drive
							<Launch data-icon="inline-end" />
						</a>
					</Button>
				) : null}
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() => inputRef.current?.click()}
				>
					{busy ? <Spinner data-icon="inline-start" /> : null}
					Upload
				</Button>
				<input
					ref={inputRef}
					type="file"
					multiple
					className="hidden"
					onChange={(event) => onPick(event.target.files)}
				/>
			</div>

			{files.data.files.length === 0 ? (
				<p className="text-muted-foreground">The folder is empty.</p>
			) : (
				<ul className="divide-y">
					{files.data.files.map((file) => (
						<li
							key={file.id}
							className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
						>
							<a
								href={file.url}
								target="_blank"
								rel="noreferrer"
								className="min-w-0 truncate font-medium hover:underline"
							>
								{file.isFolder ? "📁 " : ""}
								{file.name}
							</a>
							<span className="ml-auto flex gap-3 text-muted-foreground text-xs">
								{fileSize(file.size) ? (
									<span>{fileSize(file.size)}</span>
								) : null}
								{file.modifiedAt ? <LocalDay date={file.modifiedAt} /> : null}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
