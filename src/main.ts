import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	getFrontMatterInfo,
	stringifyYaml,
} from "obsidian";
import JoplinClient from "./helpers/joplin";

interface JoplinPluginSettings {
	baseUrl: string;
	token: string;
}

const DEFAULT_SETTINGS: JoplinPluginSettings = {
	baseUrl: "http://localhost:41184",
	token: "",
};

export default class JoplinPlugin extends Plugin {
	settings: JoplinPluginSettings;

	async onload() {
		console.log("loaded joplin plugin");
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "sync-this-note",
			name: "sync this note",
			editorCheckCallback: (checking, editor, ctx) => {
				// Conditions to check
				if (!this.settings.token) {
					new Notice(
						"Please enter your Joplin access token in Settings."
					);
					return false;
				}

				if (!ctx.file) {
					return false;
				}

				if (!checking) {
					this.sync(ctx.file);
				}

				// This command will only show up in Command Palette when the check function returns true
				return true;
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
				await joplinClient.updateJoplinNote(joplinYaml.joplinId, title, body);
			} else {
				console.log("joplin -> obsidian");
				const newTitle = notes["title"] ?? title;
				const newBody = notes["body"]?.replace(/&nbsp;/g, " ") ?? body;
				const newYaml = {
					...joplinYaml,
					title: newTitle,
				};
				const newContents = `---\n${stringifyYaml(newYaml)}---\n${newBody}`;
				await this.app.vault.modify(file, newContents);
			}
		} else {
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

class JoplinSettingTab extends PluginSettingTab {
	plugin: JoplinPlugin;

	constructor(app: App, plugin: JoplinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Displays the Joplin Authorization token setting in the plugin's container element.
	 */
	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Joplin Base Url")
			.setDesc(
				"The base path of the joplin web service, defaults to http://localhost:41184"
			)
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:41184")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Joplin Authorization token")
			.setDesc("Enter your Joplin Authorization token")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Enter your token")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
