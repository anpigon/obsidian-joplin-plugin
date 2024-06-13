import {
	Notice,
	Plugin,
	TFile,
	getFrontMatterInfo,
	stringifyYaml,
} from "obsidian";
import * as Diff from "diff";
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

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "sync-this-note",
			name: "sync this note",
			editorCallback: (editor, ctx) => {
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

				this.sync(ctx.file);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
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
		const contents = await this.app.vault.read(file);
		console.log("contents", contents);

		const { contentStart, frontmatter } = getFrontMatterInfo(contents);

		const joplinClient = new JoplinClient(
			this.settings.baseUrl || DEFAULT_SETTINGS.baseUrl,
			this.settings.token
		);

		const joplinYaml = joplinClient.parseFrontMatter(frontmatter);
		console.log("frontmatter", joplinYaml);

		const title = joplinYaml.title || file.basename;
		const body = contents.slice(contentStart);

		if (joplinYaml.joplinId) {
			const notes = await joplinClient.getJoplinNote(joplinYaml.joplinId);
			const joplinUpdatedTime = notes["updated_time"];
			const obsidianUpdatedTime = file?.stat.mtime;

			if (joplinUpdatedTime < obsidianUpdatedTime) {
				console.log("obsidian -> joplin");
				await joplinClient.updateJoplinNote(
					joplinYaml.joplinId,
					title,
					body
				);
			} else {
				console.log("joplin -> obsidian");
				const newTitle = notes["title"] ?? title;
				const joplinBody = notes["body"]?.replace(/&nbsp;/g, " ") ?? "";
				const diff = Diff.diffChars(joplinBody, body);
				console.log("diff", diff);
				const newBody = diff.reduce(
					(fragment, part) => fragment + part.value,
					""
				);
				console.log("newBody", newBody);

				const newYaml = {
					...joplinYaml,
					title: newTitle,
				};
				const newContents = `---\n${stringifyYaml(
					newYaml
				)}---\n${newBody}`;
				await this.app.vault.modify(file, newContents);
			}
		} else {
			// create new note to joplin
			const results = await joplinClient.createNewJoplinNote(title, body);
			const newYaml = {
				...joplinYaml,
				joplinId: results.id,
				title,
			};
			const newContents = `---\n${stringifyYaml(newYaml)}---\n${body}`;
			await this.app.vault.modify(file, newContents);
		}

		new Notice("The sync was successful.");
	}
}
