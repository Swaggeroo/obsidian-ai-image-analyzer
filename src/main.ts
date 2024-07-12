import {App, Editor, MenuItem, Notice, Plugin, PluginSettingTab, Setting, TFile} from 'obsidian';
import {ChatResponse, Ollama} from 'ollama';
import {clearCache, isInCache, readCache, removeFromCache, writeCache} from "./cache";

let debugMode = false;
let ollama: Ollama;

interface MyPluginSettings {
	debug: boolean;
	ollamaHost: string;
	ollamaPort: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	debug: false,
	ollamaHost: '127.0.0.1',
	ollamaPort: 11434,
}

const promt = 'Describe the image. Just use Keywords. For example: cat, dog, tree. This must be Computer readable. It will be used to search for the image later.';

export type AIImageAnalyzerAPI = {
	analyzeImage: (file: TFile) => Promise<string>;
	canBeAnalyzed: (file: TFile) => boolean;
	isInCache: (file: TFile) => boolean;
}

export default class AIImageAnalyzerPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBarItemEl: HTMLElement;

	public api: AIImageAnalyzerAPI = {
		analyzeImage: analyzeImage,
		canBeAnalyzed: isImageFile,
		isInCache: (file: TFile) => false, //TODO Implement cache
	}

	async onload() {
		debugLog('loading ai image analyzer plugin');
		await this.loadSettings();
		ollama = new Ollama({host: '127.0.0.1:11434'})

		// Check if ollama is running
		try {
			const models = await ollama.list();
			debugLog(models);
			if (!models.models.some(model => model.name === 'llava:latest')) {
				new Notice('No llava model found, please make sure you have pulled llava (you can pull llava over the settings tab)');
			}
		} catch (e) {
			debugLog(e);
			new Notice('Failed to connect to Ollama.');
		}

		this.addCommand({
			id: 'analyze-image-to-clipboard',
			name: 'Analyze image to clipboard',
			callback: () => {
				const file = getActiveFile(this.app)
				if (file != null && isImageFile(file)) {
					analyzeToClipboard(file);
				} else {
					new Notice('No image found');
				}
			}
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, _source) => {
				if (file instanceof TFile && isImageFile(file)) {
					menu.addItem((item: MenuItem) => {
						item.setTitle('AI Analyze Image');

						const submenu = item.setSubmenu();

						submenu.addItem((item: MenuItem) =>
							item.setTitle('Analyze Image to clipboard')
								.setIcon('clipboard')
								.onClick(() => {
									analyzeToClipboard(file);
								})
						);

						submenu.addItem((item: MenuItem) =>
							item.setTitle('Analyze Image')
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
		debugMode = this.settings.debug;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AIImageAnalyzerSettingsTab extends PluginSettingTab {
	plugin: AIImageAnalyzerPlugin;

	constructor(app: App, plugin: AIImageAnalyzerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'AI Image Analyzer - Settings'})

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
					debugMode = value;
				}));

		new Setting(containerEl).setName('Ollama server settings').setHeading()

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

function getActiveFile(app: App): TFile | null {
	return app.workspace.activeEditor?.file ?? app.workspace.getActiveFile();
}

function isImageFile(file: TFile): boolean {
	const path = file.path;

	return (
		path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') ||
		path.endsWith('.webp')
	)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

async function analyzeImage(file: TFile): Promise<string> {
	if (!isImageFile(file)) {
		return Promise.reject('File is not an image');
	}

	if (await isInCache(file)) {
		let text = await readCache(file);
		if (text) {
			debugLog('Reading from cache');
			return Promise.resolve(text.text);
		} else {
			debugLog('Failed to read cache');
			debugLog('Removing from cache');
			await removeFromCache(file);
		}
	}

	debugLog(file);

	try {
		const data: string = arrayBufferToBase64(await this.app.vault.readBinary(file));

		const response: ChatResponse = await ollama.chat({
			model: 'llava',
			messages: [{role: 'user', content: promt, images: [data]}],
		});

		debugLog(response);

		await writeCache(file, response.message.content);

		return Promise.resolve(response.message.content);
	} catch (e) {
		debugLog(e);
		return Promise.reject('Failed to analyze image');
	}
}

async function analyzeImageWithNotice(file: TFile): Promise<string> {
	try {
		new Notice('Analyzing image');
		let text = await analyzeImage(file);
		new Notice('Image analyzed');
		return text;
	} catch (e) {
		debugLog(e);
		new Notice('Failed to analyze image');
		return '';
	}
}

async function analyzeToClipboard(file: TFile) {
	try {
		const {clipboard} = require('electron')
		const text = await analyzeImageWithNotice(file);
		await clipboard.writeText(text);
		new Notice('Text copied to clipboard');
	} catch (e) {
		debugLog(e);
	}
}


async function pullImage() {
	try {
		new Notice('Pulling llava model started, this may take a while...');
		const response = await ollama.pull({model: 'llava', stream: true});
		const progressNotice = new Notice('Pulling llava model 0%', 0);
		for await (const part of response) {
			debugLog(part);
			if (part.total !== null && part.completed !== null) {
				const percentage = (part.completed / part.total) * 100;
				if (!isNaN(percentage) && percentage !== Infinity && percentage !== -Infinity) {
					const roundedNumber = percentage.toFixed(2);
					const completed = (part.completed / 1000000000).toFixed(2);
					const total = (part.total / 1000000000).toFixed(2);
					progressNotice.setMessage(`Pulling llava model ${roundedNumber}% (${completed}GB/${total}GB)`);
				}
			}
		}
		progressNotice.hide();
		new Notice('llava model pulled successfully');
	} catch (e) {
		debugLog(e);
		new Notice('Failed to pull llava model');
	}
}

function debugLog(message: object | string) {
	if (debugMode) {
		console.log(message);
	}
}
