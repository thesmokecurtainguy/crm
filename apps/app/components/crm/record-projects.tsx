"use client";

import type { LeadStatus, ProjectStage } from "@crm/db/enums";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LocalDay } from "@/components/local-date-time";
import {
	formatProjectValue,
	leadStatusLabel,
	leadStatusTone,
	projectStageLabel,
	projectStageTone,
} from "@/lib/project-stage";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function RecordProjects(
	props: { companyId: string } | { contactId: string },
) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const query =
		"companyId" in props
			? trpc.projects.forCompany.queryOptions({ companyId: props.companyId })
			: trpc.projects.forContact.queryOptions({ contactId: props.contactId });
	const projects = useQuery(query);

	if (!projects.data) return null;
	if (projects.data.length === 0) {
		return (
			<p className="p-4 text-muted-foreground text-sm">
				Not on any project yet. Projects arrive from ConstructConnect with the
				architect, GC and developer linked; people get assigned on the project
				page.
			</p>
		);
	}

	return (
		<ul className="divide-y">
			{projects.data.map((p) => (
				<li key={p.id} className="space-y-1.5 px-4 py-3">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<Link
							href={workspaceUrl(`/projects/${p.id}`)}
							className="font-medium hover:underline"
						>
							{p.name}
						</Link>
						{p.roles.length > 0 ? (
							<span className="text-muted-foreground text-xs uppercase">
								{p.roles.join(" · ")}
							</span>
						) : null}
						<span className="ml-auto text-muted-foreground text-sm">
							{[p.city, p.stateCode].filter(Boolean).join(", ")}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						<StatusIndicator
							tone={projectStageTone(p.stage as ProjectStage)}
							label={projectStageLabel(p.stage as ProjectStage)}
						/>
						<StatusIndicator
							tone={leadStatusTone(p.leadStatus as LeadStatus)}
							label={leadStatusLabel(p.leadStatus as LeadStatus)}
						/>
						{formatProjectValue(p.value) ? (
							<span className="tabular-nums">
								{formatProjectValue(p.value)}
							</span>
						) : null}
						{p.floors !== null ? (
							<span className="text-muted-foreground">{p.floors} fl</span>
						) : null}
						{p.bidDate ? (
							<span className="text-muted-foreground">
								Bid <LocalDay date={p.bidDate} />
							</span>
						) : null}
					</div>
					{p.people.length > 0 ? (
						<ul className="text-sm">
							{p.people.map((person) => (
								<li
									key={`${p.id}-${person.id}`}
									className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
								>
									<Link
										href={`${workspaceUrl("/contacts")}?record=contact:${person.id}`}
										className="hover:underline"
									>
										{person.name}
									</Link>
									<span className="text-muted-foreground text-xs uppercase">
										{person.role}
									</span>
									<span className="ml-auto flex gap-3 text-muted-foreground">
										{person.phone ? (
											<a
												href={`tel:${person.phone}`}
												className="hover:underline"
											>
												{person.phone}
											</a>
										) : null}
										{person.email ? (
											<a
												href={`mailto:${person.email}`}
												className="hover:underline"
											>
												{person.email}
											</a>
										) : null}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs">
							Nobody assigned on this one yet — open the project to pick who to
							ask for.
						</p>
					)}
				</li>
			))}
		</ul>
	);
}
