import { Api, NoteProperties, joplinDataApi } from "joplin-api";

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
