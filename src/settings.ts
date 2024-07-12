import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {clearCache} from "./cache";
import AIImageAnalyzerPlugin from "./main";
import {pullImage} from "./ollamaManager";
import {setDebugMode} from "./util";

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
			.setName('Pull llava')
			.setDesc('Pull the llava model')
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
				.setValue(this.plugin.settings.debug)
				.onChange(async (value) => {
					this.plugin.settings.debug = value;
					await this.plugin.saveSettings();
					setDebugMode(value);
				}));

		new Setting(containerEl).setName('Ollama server').setHeading();

		new Setting(containerEl)
			.setName('Ollama host')
			.setDesc('Set the host for the Ollama server')
			.addText(text => text
				.setPlaceholder('Enter the host (127.0.0.1)')
				.setValue(this.plugin.settings.ollamaHost)
				.onChange(async (value) => {
					if (value.length === 0) {
						this.plugin.settings.ollamaHost = '127.0.0.1';
						await this.plugin.saveSettings();
						return;
					}
					this.plugin.settings.ollamaHost = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ollama port')
			.setDesc('Set the port for the Ollama server')
			.addText(text => text
				.setPlaceholder('Enter the port (11434)')
				.setValue(this.plugin.settings.ollamaPort.toString())
				.onChange(async (value) => {
					if (isNaN(parseInt(value))) {
						this.plugin.settings.ollamaPort = 11434;
						await this.plugin.saveSettings();
						return;
					}
					this.plugin.settings.ollamaPort = parseInt(value);
					await this.plugin.saveSettings();
				}));
	}
}
