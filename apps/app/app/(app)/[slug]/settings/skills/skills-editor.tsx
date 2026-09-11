"use client";

import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function SkillsEditor() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const skills = useQuery(trpc.skills.list.queryOptions());
	const [slug, setSlug] = useState<string | null>(null);
	const [body, setBody] = useState("");

	const current = skills.data?.find((s) => s.slug === slug) ?? null;

	useEffect(() => {
		if (!slug && skills.data?.[0]) setSlug(skills.data[0].slug);
	}, [skills.data, slug]);

	useEffect(() => {
		if (current) setBody(current.body);
	}, [current]);

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: trpc.skills.list.queryKey() });

	const save = useMutation(
		trpc.skills.update.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Skill saved. The agent uses it from its next session.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const reset = useMutation(
		trpc.skills.reset.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Reset to the shipped version.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const dirty = current !== null && body !== current.body;
	const busy = save.isPending || reset.isPending;

	return (
		<div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
			<ul className="divide-y rounded-md border">
				{(skills.data ?? []).map((s) => (
					<li key={s.slug}>
						<button
							type="button"
							className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
								slug === s.slug ? "bg-accent" : ""
							}`}
							onClick={() => setSlug(s.slug)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="truncate font-medium">{s.title}</span>
								{s.edited ? (
									<span className="shrink-0 text-muted-foreground text-xs">
										edited
									</span>
								) : null}
							</div>
							<div className="line-clamp-2 text-muted-foreground text-xs">
								{s.description}
							</div>
						</button>
					</li>
				))}
			</ul>

			{current ? (
				<div className="flex min-h-0 flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium">{current.title}</span>
						<code className="text-muted-foreground text-xs">
							{current.slug}
						</code>
						<span className="ml-auto flex gap-2">
							{current.edited ? (
								<Button
									size="sm"
									variant="ghost"
									disabled={busy}
									onClick={() => reset.mutate({ slug: current.slug })}
								>
									Reset to shipped
								</Button>
							) : null}
							<Button
								size="sm"
								disabled={!dirty || busy}
								onClick={() => save.mutate({ slug: current.slug, body })}
							>
								{save.isPending ? <Spinner data-icon="inline-start" /> : null}
								Save
							</Button>
						</span>
					</div>
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={32}
						className="min-h-[560px] font-mono text-[13px] leading-relaxed"
					/>
					<p className="text-muted-foreground text-xs">
						Keep the first lines (the --- block) as they are; that's the
						one-line description the agent uses to pick the right skill.
					</p>
				</div>
			) : (
				<Spinner />
			)}
		</div>
	);
}
