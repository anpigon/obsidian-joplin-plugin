export interface JoplinPluginSettings {
	baseUrl: string;
	token: string;
	syncDirection: "obsidian-to-joplin" | "joplin-to-obsidian" | "two-way"; // 동기화 방향 설정
}

export const DEFAULT_SETTINGS: JoplinPluginSettings = {
	baseUrl: "http://localhost:41184",
	token: "",
	syncDirection: "obsidian-to-joplin", // 기본값을 옵시디언에서 Joplin으로 동기화로 설정
};
