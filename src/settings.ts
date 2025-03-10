import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {clearCache} from "./cache";
import AIImageAnalyzerPlugin from "./main";
import {pullImage, setOllama} from "./ollamaManager";
import {possibleModels} from "./globals";
import {Model} from "./types";
import {Ollama} from "ollama";

interface AIImageAnalyzerPluginSettings {
	debug: boolean;
	ollamaURL: string;
	ollamaToken: string;
	ollamaModel: Model;
	prompt: string;
	autoClearCache: boolean;
}

const DEFAULT_SETTINGS: AIImageAnalyzerPluginSettings = {
	debug: false,
	ollamaURL: 'http://127.0.0.1:11434',
	ollamaToken: '',
	ollamaModel: possibleModels[0],
	prompt: 'Describe the image. Just use Keywords. For example: cat, dog, tree. This must be Computer readable. The provided pictures are used in an notebook. Please provide at least 5 Keywords. It will be used to search for the image later.',
	autoClearCache: true,
};

export let settings: AIImageAnalyzerPluginSettings = Object.assign({}, DEFAULT_SETTINGS);

export async function loadSettings(plugin: AIImageAnalyzerPlugin) {
	settings = Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
}

export async function saveSettings(plugin: AIImageAnalyzerPlugin) {
	setOllama(new Ollama({
		host: settings.ollamaURL,
		headers: {
			'Authorization': `Bearer ${settings.ollamaToken}`
		}
	}));
	await plugin.saveData(settings);
}

export class AIImageAnalyzerSettingsTab extends PluginSettingTab {
	plugin: AIImageAnalyzerPlugin;

	constructor(app: App, plugin: AIImageAnalyzerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Select the model to use')
			.addDropdown(dropdown => dropdown
				.addOptions(possibleModels.reduce((acc, model) => {
					acc[model.name] = model.name;
					return acc;
				}, {} as Record<string, string>))
				.setValue(possibleModels.find(model => model.model === settings.ollamaModel.model)!.name)
				.onChange(async (value) => {
					settings.ollamaModel = possibleModels.find(model => model.name === value)!;
					await saveSettings(this.plugin);
					if (settings.autoClearCache) {
						await clearCache();
					}
				}));

		new Setting(containerEl)
			.setName('Pull Model')
			.setDesc('Pull the selected model')
			.addButton(button => button
				.setButtonText('Pull Model')
				.onClick(async () => await pullImage()));

		new Setting(containerEl)
			.setName('Clear cache')
			.setDesc('Clear the cache, reanalyzing images could take a while')
			.addButton(button => button
				.setButtonText('Clear cache')
				.onClick(async () => {
					await clearCache();
					new Notice('Cache cleared');
				}));

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug mode to see logs in the console')
			.addToggle(toggle => toggle
				.setValue(settings.debug)
				.onChange(async (value) => {
					settings.debug = value;
					await saveSettings(this.plugin);
				}));

		new Setting(containerEl).setName('Ollama server').setHeading();

		new Setting(containerEl)
			.setName('Ollama URL')
			.setDesc('Set the URL for the Ollama server')
			.addText(text => text
				.setPlaceholder('Enter the host (http://127.0.0.1:11434)')
				.setValue(settings.ollamaURL)
				.onChange(async (value) => {
					if (value.length === 0) {
						value = DEFAULT_SETTINGS.ollamaURL;
					}
					settings.ollamaURL = value;
					await saveSettings(this.plugin);
				}));

		new Setting(containerEl)
			.setName('Ollama Token (Optional)')
			.setDesc('Set the token for authentication with the Ollama server')
			.addText(text => text
				.setValue(settings.ollamaToken !== '' ? '••••••••••' : '')
				.onChange(async (value) => {
					if (value.contains('•')) {
						return;
					}
					settings.ollamaToken = value;
					await saveSettings(this.plugin);
				}));

		new Setting(containerEl).setName('Advanced').setHeading();

		new Setting(containerEl)
			.setName('Prompt')
			.setDesc('Set the prompt for the Ollama model')
			.addTextArea(text => {
				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
				return text
					.setPlaceholder('Enter the prompt')
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
			.setName('Auto clear cache')
			.setDesc('Clear the cache after changing the model or the prompt to reanalyze images (if toggled on the cache will be cleared)')
			.addToggle(toggle => toggle
				.setValue(settings.autoClearCache)
				.onChange(async (value) => {
					settings.autoClearCache = value;
					if (value) {
						await clearCache();
						new Notice('Cache cleared');
					}
					await saveSettings(this.plugin);
				}));

	}
}
