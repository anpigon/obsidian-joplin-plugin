import { App, PluginSettingTab, Setting } from "obsidian";
import JoplinPlugin from "src/main";

export class JoplinSettingTab extends PluginSettingTab {
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
