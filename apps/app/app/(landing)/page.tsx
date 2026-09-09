import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { workspaceUrl } from "@/lib/workspace-url";

export const instant = false;

export default async function Home() {
	const session = await getSession();
	if (!session) redirect("/sign-in");

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const workspace = await queryClient.fetchQuery(
		trpc.workspace.get.queryOptions(),
	);
	redirect(workspace.slug ? workspaceUrl(workspace.slug) : "/onboarding");
}
