import {MenuItem, Notice, Plugin, TFile} from 'obsidian';
import {Ollama} from 'ollama';
import {isInCache, removeFromCache} from "./cache";
import {analyzeImage, analyzeImageWithNotice, analyzeToClipboard, checkOllama, setOllama} from "./ollamaManager";
import {debugLog, isImageFile, setDebugMode} from "./util";
import {AIImageAnalyzerSettingsTab} from "./settings";
import {Model} from "./types";
import {possibleModels, setSelectedModel} from "./globals";

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

export type AIImageAnalyzerAPI = {
	analyzeImage: (file: TFile) => Promise<string>;
	canBeAnalyzed: (file: TFile) => boolean;
	isInCache: (file: TFile) => Promise<boolean>;
}

export default class AIImageAnalyzerPlugin extends Plugin {
	settings: AIImageAnalyzerPluginSettings;

	public api: AIImageAnalyzerAPI = {
		analyzeImage: analyzeImage,
		canBeAnalyzed: isImageFile,
		isInCache: isInCache,
	}

	async onload() {
		debugLog('loading ai image analyzer plugin');
		await this.loadSettings();
		setOllama(new Ollama({host: `${this.settings.ollamaHost}:${this.settings.ollamaPort}`}));

		await checkOllama();

		this.addCommand({
			id: 'analyze-image-to-clipboard',
			name: 'Analyze image to clipboard',
			checkCallback: (checking: boolean) => {
				const file = getActiveFile()

				if (file != null && isImageFile(file)) {
					if (!checking){
						analyzeToClipboard(file);
					}
					return true;
				}

				return false;
			}
		});

		this.addCommand({
			id: 'analyze-image',
			name: 'Analyze image',
			checkCallback: (checking: boolean) => {
				const file = getActiveFile()
				if (file != null && isImageFile(file)) {
					if (!checking) {
						analyzeImageWithNotice(file);
					}
					return true;
				}

				return false;
			}
		});

		this.addCommand({
			id: 'clear-cache-of-active-image',
			name: 'Clear cache of active image',
			checkCallback: (checking: boolean) => {
				const file = getActiveFile()
				if (file != null && isImageFile(file)) {
					if (!checking) {
						removeFromCache(file);
						new Notice('Cache cleared');
					}
					return true;
				}

				return false;
			}
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, _source) => {
				if (file instanceof TFile && isImageFile(file)) {
					menu.addItem((item: MenuItem) => {
						item.setTitle('AI analyze image');

						const submenu = item.setSubmenu();

						submenu.addItem((item: MenuItem) =>
							item.setTitle('Analyze image to clipboard')
								.setIcon('clipboard')
								.onClick(() => {
									analyzeToClipboard(file);
								})
						);

						submenu.addItem((item: MenuItem) =>
							item.setTitle('Analyze image')
								.setIcon('search')
								.onClick(async () => {
									await removeFromCache(file);
									await analyzeImageWithNotice(file);
								})
						);

						submenu.addItem((item: MenuItem) =>
							item.setTitle('Clear cache')
								.setIcon('trash')
								.onClick(async () => {
									await removeFromCache(file);
									new Notice('Cache cleared');
								})
						);
					});
				}
			})
		)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIImageAnalyzerSettingsTab(this.app, this));
	}

	onunload() {
		debugLog('unloading ai image analyzer plugin')
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		setSelectedModel(this.settings.ollamaModel);
		setDebugMode(this.settings.debug);
	}

	async saveSettings() {
		setOllama(new Ollama({host: `${this.settings.ollamaHost}:${this.settings.ollamaPort}`}));
		setSelectedModel(this.settings.ollamaModel);
		await this.saveData(this.settings);
	}
}

function getActiveFile(): TFile | null {
	return this.app.workspace.activeEditor?.file ?? this.app.workspace.getActiveFile();
}


