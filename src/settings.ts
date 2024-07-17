import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {clearCache} from "./cache";
import AIImageAnalyzerPlugin from "./main";
import {pullImage, setOllama} from "./ollamaManager";
import {possibleModels} from "./globals";
import {Model} from "./types";
import {Ollama} from "ollama";

interface AIImageAnalyzerPluginSettings {
	debug: boolean;
	ollamaHost: string;
	ollamaPort: number;
	ollamaModel: Model;
}

const DEFAULT_SETTINGS: AIImageAnalyzerPluginSettings = {
	debug: false,
	ollamaHost: '127.0.0.1',
	ollamaPort: 11434,
	ollamaModel: possibleModels[0],
}

export let settings: AIImageAnalyzerPluginSettings = Object.assign({}, DEFAULT_SETTINGS);

export async function loadSettings() {
	settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

export async function saveSettings() {
	setOllama(new Ollama({host: `${settings.ollamaHost}:${settings.ollamaPort}`}));
	await this.saveData(settings);
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
					await saveSettings();
				}));

		new Setting(containerEl)
			.setName('Pull Model')
			.setDesc('Pull the selected model')
			.addButton(button => button
				.setButtonText('Pull llava')
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
					await saveSettings();
				}));

		new Setting(containerEl).setName('Ollama server').setHeading();

		new Setting(containerEl)
			.setName('Ollama host')
			.setDesc('Set the host for the Ollama server')
			.addText(text => text
				.setPlaceholder('Enter the host (127.0.0.1)')
				.setValue(settings.ollamaHost)
				.onChange(async (value) => {
					if (value.length === 0) {
						settings.ollamaHost = '127.0.0.1';
						await saveSettings();
						return;
					}
					settings.ollamaHost = value;
					await saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ollama port')
			.setDesc('Set the port for the Ollama server')
			.addText(text => text
				.setPlaceholder('Enter the port (11434)')
				.setValue(settings.ollamaPort.toString())
				.onChange(async (value) => {
					if (isNaN(parseInt(value))) {
						settings.ollamaPort = 11434;
						await saveSettings();
						return;
					}
					settings.ollamaPort = parseInt(value);
					await saveSettings();
				}));
	}
}
