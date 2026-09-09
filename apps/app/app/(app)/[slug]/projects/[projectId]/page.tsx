import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell, PageShellLoading } from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ProjectDetail } from "./project-detail";

export const metadata: Metadata = {
	title: "Project",
};

export default async function ProjectPage({
	params,
}: {
	params: Promise<{ slug: string; projectId: string }>;
}) {
	const { projectId } = await params;
	return (
		<PageShell className="min-h-0">
			<Suspense fallback={<PageShellLoading />}>
				<Project id={projectId} />
			</Suspense>
		</PageShell>
	);
}

async function Project({ id }: { id: string }) {
	await requireSession();
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(trpc.projects.byId.queryOptions({ id })),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);
	return (
		<HydrateClient>
			<ProjectDetail id={id} />
		</HydrateClient>
	);
}
