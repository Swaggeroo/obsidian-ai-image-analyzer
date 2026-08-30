import type { Menu, App } from "obsidian";

declare module "obsidian" {
	interface MenuItem {
		setSubmenu(): Menu;
	}
}

declare global {
	const app: App;
}
