import { parseYaml } from "obsidian";
import { JoplinFrontMatter } from "./joplin";

export default function parseFrontMatter(
	frontmatter: string
): JoplinFrontMatter {
	const yml = parseYaml(frontmatter) ?? {};
	const joplinId = yml?.["joplinId"];
	const title = yml?.["title"];
	return {
		joplinId,
		title,
	};
}
