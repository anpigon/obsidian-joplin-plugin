export interface JoplinPluginSettings {
	baseUrl: string;
	token: string;
}

export const DEFAULT_SETTINGS: JoplinPluginSettings = {
	baseUrl: "http://localhost:41184",
	token: "",
};
