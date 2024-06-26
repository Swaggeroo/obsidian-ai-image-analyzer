import {App, Editor, Notice, Plugin, PluginSettingTab, Setting, TFile} from 'obsidian';
import {Ollama} from 'ollama'

// Remember to rename these classes and interfaces!

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

const promt = 'Describe the image';

export default class HelloWorldPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBarItemEl: HTMLElement;
	ollama: Ollama = new Ollama({ host: '127.0.0.1:11434' })

	async onload() {
		await this.loadSettings();
		this.debugLog('loading plugin');

		// Check if ollama is running
		try {
			const models = await this.ollama.list();
			this.debugLog(models);
			if (!models.models.some(model => model.name === 'llava:latest')) {
				new Notice('No llava model found, please make sure you have pulled llava (you can pull llava over the settings tab)');
			}
		}catch (e) {
			this.debugLog(e);
			new Notice('Failed to connect to Ollama.');
		}

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.setText("olllaaaaaama");

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor) => {
				this.debugLog(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		this.addCommand({
			id: 'extract-image-to-cache',
			name: 'Extract image to cache',
			callback: async () => {
				const file = getActiveFile(this.app)
				if (file != null && isFileImage(file.path)) {
					this.debugLog(file);
					const basePath = getCacheBasePath();
					this.debugLog(basePath);
					const data = arrayBufferToBase64(await this.app.vault.readBinary(file));
					const response = await this.ollama.chat({
						model: 'llava',
						messages: [{role: 'user', content: promt, images: [data]}],
					})
					this.debugLog(response);
					//TODO Save the image to the cache
					new Notice('Image extracted to cache');
				}
			}
		});

		this.addCommand({
			id: 'sample-ollama-response',
			name: 'Sample ollama response',
			editorCallback: async (editor: Editor) => {
				try {
					const selectedText = editor.getSelection();
					if (selectedText.length === 0) {
						new Notice('No text selected');
						return;
					}

					const response = await this.ollama.chat({
						model: 'llama3',
						messages: [{role: 'user', content: selectedText}],
						stream: true
					})
					for await (const part of response) {
						this.debugLog(part);
						editor.replaceSelection(part.message.content);
					}
				}catch (e) {
					console.error(e)
					new Notice('Failed to get response from Ollama, have you pulled llava? (check console for details)');
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		//this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		//	this.debugLog('click', evt);
		//});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => this.debugLog('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		this.debugLog('unloading plugin')
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	debugLog(message: object | string) {
		if (this.settings.debug) {
			console.log(message);
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: HelloWorldPlugin;

	constructor(app: App, plugin: HelloWorldPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'AI Image Analyzer - Settings' })

		new Setting(containerEl)
			.setName('Pull llava')
			.setDesc('Pull the llava model')
			.addButton(button => button
				.setButtonText('Pull llava')
				.onClick(async () => {
					try {
						new Notice('Pulling llava model started, this may take a while...');
						const respone = await this.plugin.ollama.pull({model: 'llava', stream: true});
						const progressNotice = new Notice('Pulling llava model 0%', 0);
						for await (const part of respone) {
							this.plugin.debugLog(part);
							if (part.status !== 'pulling manifest' && part.total !== null && part.completed !== null) {
								const number = (part.completed/part.total)*100;
								const roundedNumber = number.toFixed(2);
								if (!isNaN(number) && number !== Infinity && number !== -Infinity) {
									progressNotice.setMessage(`Pulling llava model ${roundedNumber}% (${(part.completed/1000000000).toFixed(2)}GB/${(part.total/1000000000).toFixed(2)}GB)`);
								}
							}
						}
						progressNotice.hide();
						new Notice('llava model pulled successfully');
					}catch (e) {
						this.plugin.debugLog(e);
						new Notice('Failed to pull llava model, check console for details');
					}
				}));

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug mode to see logs in the console')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debug)
				.onChange(async (value) => {
					this.plugin.settings.debug = value;
					await this.plugin.saveSettings();
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
						new Notice('Invalid host - resetting to default');
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
						new Notice('Port must be a number - resetting to default');
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

function isFileImage(path: string): boolean {
	return (
		path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') ||
		path.endsWith('.webp')
	)
}

function getCacheBasePath(): string {
	return `${this.app.vault.configDir}/plugins/obsidian-ai-image-analyzer/cache`
}

function arrayBufferToBase64( buffer: ArrayBuffer ): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode( bytes[ i ] );
	}
	return window.btoa( binary );
}
