import type {} from "obsidian";

declare module "obsidian" {
	interface MenuItem {
		setSubmenu(): Menu;
	}
}
