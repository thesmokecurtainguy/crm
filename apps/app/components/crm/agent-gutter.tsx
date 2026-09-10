"use client";

import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@crm/ui/components/button";
import Logo from "@crm/ui/components/logo";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { AgentPanel } from "@/components/crm/agent-panel";
import { useRecordStack } from "@/components/crm/record-sheet/record-stack";
import { type AgentRecord, recordCopy } from "@/lib/agent-record";
import { useTRPC } from "@/lib/trpc/client";

type GutterState = { open: boolean; setOpen: (open: boolean) => void };

const GutterContext = createContext<GutterState | null>(null);

export function AgentGutterProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(true);
	const value = useMemo(() => ({ open, setOpen }), [open]);
	return (
		<GutterContext.Provider value={value}>{children}</GutterContext.Provider>
	);
}

function useGutter(): GutterState {
	const ctx = useContext(GutterContext);
	if (!ctx) throw new Error("AgentGutter needs AgentGutterProvider.");
	return ctx;
}

function useCurrentRecord(): AgentRecord | null {
	const pathname = usePathname();
	const { stack } = useRecordStack();
	return useMemo(() => {
		const top = stack[stack.length - 1];
		if (top) return { kind: top.kind, id: top.id };
		const match = /\/projects\/([^/?#]+)/.exec(pathname ?? "");
		if (match?.[1]) return { kind: "project", id: match[1] };
		return null;
	}, [stack, pathname]);
}

export function AgentGutter() {
	const { open, setOpen } = useGutter();
	const record = useCurrentRecord();

	if (!open) {
		return (
			<Button
				variant="outline"
				size="sm"
				className="fixed right-4 bottom-4 z-30 hidden gap-2 shadow-md lg:inline-flex"
				onClick={() => setOpen(true)}
			>
				<Logo className="size-4" />
				Agent
			</Button>
		);
	}

	return (
		<aside className="hidden w-[400px] shrink-0 flex-col border-l bg-background lg:flex">
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<Logo className="size-4" />
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium text-sm">
						{record ? recordCopy(record.kind).title : "Agent"}
					</div>
					{record ? <RecordName record={record} /> : null}
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Hide agent"
					onClick={() => setOpen(false)}
				>
					<ChevronRight />
				</Button>
			</div>
			<div className="min-h-0 flex-1">
				{record ? (
					<AgentPanel key={`${record.kind}:${record.id}`} record={record} />
				) : (
					<div className="p-4 text-muted-foreground text-sm">
						Open a project, a company, a contact or a deal and the agent follows
						you here. It reads the record first, then does what you ask: who to
						call, draft an email, put a follow-up on the calendar.
					</div>
				)}
			</div>
		</aside>
	);
}

function RecordName({ record }: { record: AgentRecord }) {
	const trpc = useTRPC();
	const project = useQuery({
		...trpc.projects.byId.queryOptions({ id: record.id }),
		enabled: record.kind === "project",
	});
	const company = useQuery({
		...trpc.companies.byId.queryOptions({ id: record.id }),
		enabled: record.kind === "company",
	});
	const contact = useQuery({
		...trpc.contacts.byId.queryOptions({ id: record.id }),
		enabled: record.kind === "contact",
	});
	const deal = useQuery({
		...trpc.deals.byId.queryOptions({ id: record.id }),
		enabled: record.kind === "deal",
	});

	const name =
		record.kind === "project"
			? project.data?.name
			: record.kind === "company"
				? company.data?.name
				: record.kind === "contact"
					? [contact.data?.firstName, contact.data?.lastName]
							.filter(Boolean)
							.join(" ")
					: deal.data?.name;

	if (!name) return null;
	return <div className="truncate text-muted-foreground text-xs">{name}</div>;
}
