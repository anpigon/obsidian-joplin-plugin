import * as Diff from "diff";
import {
	MarkdownFileInfo,
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
import parseFrontMatter from "./helpers/parseFrontMatter";

export default class JoplinPlugin extends Plugin {
	settings: JoplinPluginSettings;

	async onload() {
		console.log("loaded joplin plugin");
		await this.loadSettings();

		this.addCommand({
			id: "sync-this-note-two-way",
			name: "Two-way sync this note",
			editorCallback: async (editor, ctx) => {
				try {
					if (!this.checkPluginSetting() || !this.checkNoteFile(ctx))
						return;

					await this.sync(ctx.file);
				} catch (error) {
					new Notice(error.message || error);
				}
			},
		});

		this.addCommand({
			id: "update-this-note-to-joplin",
			name: "Update this note to Joplin",
			editorCallback: async (editor, ctx) => {
				try {
					if (!this.checkPluginSetting() || !this.checkNoteFile(ctx))
						return;

					await this.updateToJoplin(ctx.file);
				} catch (error) {
					new Notice(error.message || error);
				}
			},
		});

		this.addSettingTab(new JoplinSettingTab(this.app, this));
	}

	checkPluginSetting() {
		if (!this.settings.token)
			throw new Error(
				"Please enter your Joplin access token in Settings."
			);
		return true;
	}

	checkNoteFile(
		ctx: MarkdownFileInfo
	): ctx is MarkdownFileInfo & { file: TFile } {
		if (!ctx.file) throw new Error("This note is not saved yet.");
		return true;
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

			const joplinYaml = parseFrontMatter(frontmatter);
			const joplinId = joplinYaml.joplinId;
			const obsidianNoteTitle = joplinYaml.title || file.basename;
			const obsidianNoteBody = contents.slice(contentStart);
			const obsidianNoteUpdatedTime = file.stat.mtime;

			if (joplinId) {
				const notes = await joplinClient.getJoplinNote(joplinId);
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
					joplinId,
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

	async updateToJoplin(file: TFile) {
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

			const joplinYaml = parseFrontMatter(frontmatter);
			const joplinId = joplinYaml.joplinId;
			const obsidianNoteTitle = joplinYaml.title || file.basename;
			const obsidianNoteBody = contents.slice(contentStart);

			if (joplinId) {
				await joplinClient.updateJoplinNote(
					joplinId,
					obsidianNoteTitle,
					obsidianNoteBody
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
