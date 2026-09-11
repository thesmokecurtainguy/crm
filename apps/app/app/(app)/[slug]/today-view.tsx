"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Brief = RouterOutputs["brief"]["today"];
type Item = Brief["needsYou"][number];

function ItemList({ items, empty }: { items: Item[]; empty: string }) {
	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm">{empty}</p>;
	}
	return (
		<ul className="divide-y text-sm">
			{items.map((item) => (
				<li
					key={`${item.kind}|${item.title}|${item.detail ?? ""}|${item.url ?? ""}`}
					className="py-2"
				>
					{item.url ? (
						item.url.startsWith("http") && !item.url.includes("/projects/") ? (
							<a
								href={item.url}
								target="_blank"
								rel="noreferrer"
								className="font-medium hover:underline"
							>
								{item.title}
							</a>
						) : (
							<Link
								href={item.url.replace(/^https?:\/\/[^/]+/, "")}
								className="font-medium hover:underline"
							>
								{item.title}
							</Link>
						)
					) : (
						<span className="font-medium">{item.title}</span>
					)}
					{item.detail ? (
						<span className="ml-2 text-muted-foreground">{item.detail}</span>
					) : null}
				</li>
			))}
		</ul>
	);
}

export function TodayView() {
	const trpc = useTRPC();
	const brief = useQuery(trpc.brief.today.queryOptions());
	const send = useMutation(
		trpc.brief.sendNow.mutationOptions({
			onSuccess: (result) =>
				result.sent
					? toast.success("Brief sent to your inbox.")
					: toast.error(result.reason ?? "Could not send the brief."),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!brief.data) return <Spinner />;
	const b = brief.data;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="text-muted-foreground text-sm">
					{b.date} · {b.digests.count} digest{b.digests.count === 1 ? "" : "s"}{" "}
					overnight · {b.digests.created} new projects, {b.digests.updated}{" "}
					updated
				</div>
				<Button
					size="sm"
					variant="outline"
					disabled={send.isPending}
					onClick={() => send.mutate()}
				>
					{send.isPending ? <Spinner data-icon="inline-start" /> : null}
					Send to my inbox
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Needs you</CardTitle>
					</CardHeader>
					<CardContent>
						<ItemList items={b.needsYou} empty="Nothing waiting." />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Quote clocks</CardTitle>
					</CardHeader>
					<CardContent>
						<ItemList items={b.clocks} empty="No quotes at a checkpoint." />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Today</CardTitle>
					</CardHeader>
					<CardContent>
						<ItemList items={b.today} empty="Nothing on the calendar." />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Project updates overnight</CardTitle>
					</CardHeader>
					<CardContent>
						<ItemList
							items={b.projectUpdates}
							empty="No project changes worth a line."
						/>
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>What the agent did</CardTitle>
					</CardHeader>
					<CardContent>
						<ItemList items={b.agentDid} empty="Nothing yet." />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
