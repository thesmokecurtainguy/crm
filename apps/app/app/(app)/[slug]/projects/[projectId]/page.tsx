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

export default function ProjectPage({
	params,
}: PageProps<"/[slug]/projects/[projectId]">) {
	return (
		<PageShell className="min-h-0">
			<Suspense fallback={<PageShellLoading />}>
				<Project params={params} />
			</Suspense>
		</PageShell>
	);
}

async function Project({
	params,
}: Pick<PageProps<"/[slug]/projects/[projectId]">, "params">) {
	const { projectId } = await params;
	await requireSession();
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.projects.byId.queryOptions({ id: projectId }),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);
	return (
		<HydrateClient>
			<ProjectDetail id={projectId} />
		</HydrateClient>
	);
}
