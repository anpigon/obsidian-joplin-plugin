import { Api, NoteProperties, joplinDataApi } from "joplin-api";
import { TFile, parseYaml, stringifyYaml } from "obsidian";

const joplinNoteFields: (keyof NoteProperties)[] = [
	"parent_id",
	"id",
	"title",
	"body",
	"created_time",
	"updated_time",
	"user_created_time",
	"user_updated_time",
	"is_conflict",
	"latitude",
	"longitude",
	"altitude",
	"author",
	"source_url",
	"is_todo",
	"todo_due",
	"todo_completed",
	"source",
	"source_application",
	"application_data",
	"order",
] as const;

export interface JoplinFrontMatter {
	joplinId?: string;
	title?: string;
}

export default class JoplinClient {
	client: Api;

	constructor(baseUrl: string, token: string) {
		this.client = joplinDataApi({
			type: "rest",
			baseUrl,
			token,
		});
	}

	parseFrontMatter(frontmatter: string): JoplinFrontMatter {
		const yml = parseYaml(frontmatter) ?? {};
		const joplinId = yml?.["joplin_id"];
		const title = yml?.["title"];
		return {
			joplinId,
			title,
		};
	}

	async syncExistingJoplinNote(
		file: TFile,
		joplinId: string,
		title: string,
		body: string,
		frontmatter: JoplinFrontMatter
	) {
		const notes = await this.client.note.get(joplinId, joplinNoteFields);
		console.log(notes);

		const joplinUpdatedTime = notes?.["updated_time"];
		const obsidianUpdatedTime = file?.stat.mtime;

		if (joplinUpdatedTime < obsidianUpdatedTime) {
			console.log("obsidian -> joplin");
			const results = await this.client.note.update({
				id: joplinId,
				title,
				body,
			});
			console.log(results);
			return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
		} else {
			console.log("joplin -> obsidian");
			const newTitle = notes?.["title"] ?? title;
			const newBody = notes?.["body"]?.replace(/&nbsp;/g, " ") ?? body;
			frontmatter["title"] = newTitle;
			return `---\n${stringifyYaml(frontmatter)}---\n${newBody}`;
		}
	}

	async updateJoplinNote(id: string, title: string, body: string) {
		return await this.client.note.update({
			id,
			title,
			body,
		});
	}

	async getJoplinNote(joplinId: string) {
		return await this.client.note.get(joplinId, joplinNoteFields);
	}

	async createNewJoplinNote(title: string, body: string) {
		return await this.client.note.create({ title, body });
	}
}
