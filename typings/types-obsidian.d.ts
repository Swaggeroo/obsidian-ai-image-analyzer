import type { Menu, App } from "obsidian";

declare module "obsidian" {
	interface MenuItem {
		setSubmenu(): Menu;
	}
	interface App {
		plugins?: {
			enabledPlugins: Set<string>;
			enablePlugin: (id: string) => Promise<void>;
			disablePlugin: (id: string) => Promise<void>;
		};
	}
}

declare global {
	const app: App;
}
