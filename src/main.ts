import * as Diff from "diff";
import {
	Notice,
	Plugin,
	TFile,
	getFrontMatterInfo,
	stringifyYaml,
} from "obsidian";
import JoplinClient from "./helpers/joplin";
import {
	DEFAULT_SETTINGS,
	JoplinPluginSettings,
	JoplinSettingTab,
} from "./settings";

export default class JoplinPlugin extends Plugin {
	settings: JoplinPluginSettings;

	async onload() {
		console.log("loaded joplin plugin");
		await this.loadSettings();

		this.addCommand({
			id: "sync-this-note",
			name: "Sync this note",
			editorCallback: async (editor, ctx) => {
				if (!this.settings.token) {
					new Notice(
						"Please enter your Joplin access token in Settings."
					);
					return;
				}

				if (!ctx.file) {
					new Notice("This note is not saved yet.");
					return;
				}

				await this.sync(ctx.file);
			},
		});

		this.addSettingTab(new JoplinSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async sync(file: TFile) {
		try {
			const contents = await this.app.vault.read(file);
			const { contentStart, frontmatter } = getFrontMatterInfo(contents);

			if (contentStart === undefined || frontmatter === undefined) {
				throw new Error("Invalid front matter format");
			}

			const joplinClient = new JoplinClient(
				this.settings.baseUrl || DEFAULT_SETTINGS.baseUrl,
				this.settings.token
			);

			const joplinYaml = joplinClient.parseFrontMatter(frontmatter);

			const obsidianNoteTitle = joplinYaml.title || file.basename;
			const obsidianNoteBody = contents.slice(contentStart);
			const obsidianNoteUpdatedTime = file.stat.mtime;

			if (joplinYaml.joplinId) {
				const notes = await joplinClient.getJoplinNote(
					joplinYaml.joplinId
				);

				const joplinNoteBody =
					notes.body?.replace(/&nbsp;/g, " ") || "";
				const joplinNoteTitle = notes.title || "";
				const joplinNoteUpdatedTime = notes.updated_time;

				const newTitle =
					obsidianNoteUpdatedTime > joplinNoteUpdatedTime
						? obsidianNoteTitle
						: joplinNoteTitle;

				const diffBody = Diff.diffChars(
					obsidianNoteUpdatedTime > joplinNoteUpdatedTime
						? joplinNoteBody
						: obsidianNoteBody,
					obsidianNoteUpdatedTime > joplinNoteUpdatedTime
						? obsidianNoteBody
						: joplinNoteBody
				);

				const newBody = diffBody
					.filter((e) => !e.removed)
					.reduce((fragment, part) => fragment + part.value, "");

				await joplinClient.updateJoplinNote(
					joplinYaml.joplinId,
					newTitle,
					newBody
				);

				const newYaml = {
					...joplinYaml,
					title: newTitle,
				};
				await this.app.vault.modify(
					file,
					`---\n${stringifyYaml(newYaml)}---\n${newBody}`
				);
			} else {
				const results = await joplinClient.createNewJoplinNote(
					obsidianNoteTitle,
					obsidianNoteBody
				);
				const newYaml = {
					...joplinYaml,
					joplinId: results.id,
					title: obsidianNoteTitle,
				};
				const newContents = `---\n${stringifyYaml(
					newYaml
				)}---\n${obsidianNoteBody}`;
				await this.app.vault.modify(file, newContents);
			}

			new Notice("The sync was successful.");
		} catch (error) {
			const errorMessage =
				error.message ||
				error.toString() ||
				"An unknown error occurred.";
			if (errorMessage.startsWith("status: 404")) {
				new Notice(
					"No notes were found in Joplin, try checking joplinId."
				);
			} else {
				new Notice(errorMessage);
			}
		}
	}
}
