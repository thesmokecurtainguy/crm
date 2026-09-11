import type { Db } from "@crm/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class SkillsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list() {
		const rows = await this.db.agentSkill.findMany({
			orderBy: { title: "asc" },
		});
		return rows.map((row) => ({
			...row,
			edited: row.body !== row.defaultBody,
		}));
	}

	async update(slug: string, body: string) {
		const existing = await this.db.agentSkill.findUnique({ where: { slug } });
		if (!existing) throw new NotFoundException("No such skill.");
		const row = await this.db.agentSkill.update({
			where: { slug },
			data: { body },
		});
		return { ...row, edited: row.body !== row.defaultBody };
	}

	async reset(slug: string) {
		const existing = await this.db.agentSkill.findUnique({ where: { slug } });
		if (!existing) throw new NotFoundException("No such skill.");
		const row = await this.db.agentSkill.update({
			where: { slug },
			data: { body: existing.defaultBody },
		});
		return { ...row, edited: false };
	}
}
