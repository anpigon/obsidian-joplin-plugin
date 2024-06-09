import { joplinDataApi } from "joplin-api";
import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	getFrontMatterInfo,
	parseYaml,
	stringifyYaml,
} from "obsidian";

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
		const yml = parseYaml(frontmatter) ?? {};
		console.log("frontmatter", yml);

		const title = yml?.["title"] || file.basename;
		const joplinId = yml?.["joplin_id"];
		const body = contents.slice(contentStart);

		const api = joplinDataApi({
			type: "rest",
			baseUrl: this.settings.baseUrl || DEFAULT_SETTINGS.baseUrl,
			token: this.settings.token,
		});

		if (joplinId) {
			// TODO: 최근 업데이트 날짜 비교하여 동기화 하기
			const notes = await api.note.get(joplinId, [
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
			]);
			console.log(notes);

			const joplinUpdatedTime = notes?.["updated_time"];
			const obsidianUpdatedTime = file?.stat.mtime;
			if (joplinUpdatedTime < obsidianUpdatedTime) {
				console.log("obsidian -> joplin");
				const results = await api.note.update({
					id: joplinId,
					title,
					body,
				});
				console.log(results);
			} else {
				console.log("joplin -> obsidian");
				const newTitleFromJoplin = notes?.["title"] ?? yml?.["title"] ?? file.basename;
				const newBodyFromJoplin = (notes?.["body"] ?? body).replace(/&nbsp;/g, " ");
				yml["title"] = newTitleFromJoplin;
				await this.app.vault.modify(
					file,
					`---\n${stringifyYaml(yml)}---\n${newBodyFromJoplin}`
				);
			}
		} else {
			const results = await api.note.create({ title, body });
			yml["joplin_id"] = results.id;
			yml["title"] = title
			await this.app.vault.modify(
				file,
				`---\n${stringifyYaml(yml)}---\n${body}`
			);
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
