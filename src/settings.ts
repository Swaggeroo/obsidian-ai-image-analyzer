import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { clearCache } from "./cache";
import AIImageAnalyzerPlugin, { getAIAdapter } from "./main";
import { htmlDescription } from "./util";

interface AIImageAnalyzerPluginSettings {
	debug: boolean;
	prompt: string;
	autoClearCache: boolean;
}

const DEFAULT_SETTINGS: AIImageAnalyzerPluginSettings = {
	debug: false,
	prompt: "Describe the image. Just use Keywords. For example: cat, dog, tree. This must be Computer readable. The provided pictures are used in an notebook. Please provide at least 5 Keywords. It will be used to search for the image later.",
	autoClearCache: true,
};

export let settings: AIImageAnalyzerPluginSettings = Object.assign(
	{},
	DEFAULT_SETTINGS,
);

export async function loadSettings(plugin: AIImageAnalyzerPlugin) {
	settings = Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
}

export async function saveSettings(plugin: AIImageAnalyzerPlugin) {
	await plugin.saveData(settings);
}

export class AIImageAnalyzerSettingsTab extends PluginSettingTab {
	plugin: AIImageAnalyzerPlugin;

	constructor(app: App, plugin: AIImageAnalyzerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Indexing")
			.setHeading()
			.setDesc(
				htmlDescription(
					getAIAdapter()
						? `<br/>👍 You have installed <a href="https://github.com/Swaggeroo/obsidian-ai-adapter">AI Adapter</a>, it is required for this plugin to function.`
						: `<br/>⚠️ AI image analyzer requires <a href="https://github.com/Swaggeroo/obsidian-ai-adapter">AI Adapter</a>`,
				),
			);

		new Setting(containerEl)
			.setName("Clear cache")
			.setDesc("Clear the cache, reanalyzing images could take a while")
			.addButton((button) =>
				button.setButtonText("Clear cache").onClick(async () => {
					await clearCache();
					new Notice("Cache cleared");
				}),
			);

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Enable debug mode to see logs in the console")
			.addToggle((toggle) =>
				toggle.setValue(settings.debug).onChange(async (value) => {
					settings.debug = value;
					await saveSettings(this.plugin);
				}),
			);

		new Setting(containerEl).setName("Advanced").setHeading();

		new Setting(containerEl)
			.setName("Prompt")
			.setDesc("Set the prompt to use alongside the image")
			.addTextArea((text) => {
				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
				return text
					.setPlaceholder("Enter the prompt")
					.setValue(settings.prompt)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_SETTINGS.prompt;
						}
						settings.prompt = value;
						await saveSettings(this.plugin);

						if (settings.autoClearCache) {
							await clearCache();
						}
					});
			});

		new Setting(containerEl)
			.setName("Auto clear cache")
			.setDesc(
				"Clear the cache after changing the model or the prompt to reanalyze images (if toggled on the cache will be cleared)",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.autoClearCache)
					.onChange(async (value) => {
						settings.autoClearCache = value;
						if (value) {
							await clearCache();
							new Notice("Cache cleared");
						}
						await saveSettings(this.plugin);
					}),
			);
	}
}
