import {
	App,
	ButtonComponent,
	Notice,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { clearCache } from "./cache";
import AIImageAnalyzerPlugin from "./main";
import { pullImage, setOllama } from "./ollamaManager";
import { fallbackGeminiModels, possibleModels } from "./globals";
import { GeminiModel, Model, Provider } from "./types";
import { Ollama } from "ollama";
import {
	checkGeminiAPI,
	fetchAvailableGeminiModels,
	setGeminiAPI,
} from "./geminiManager";

interface AIImageAnalyzerPluginSettings {
	debug: boolean;
	activeProvider: Provider;

	// Ollama settings
	ollamaURL: string;
	ollamaToken: string;
	ollamaModel: Model;

	// Gemini settings
	geminiApiKey: string;
	geminiModel: GeminiModel;
	availableGeminiModels: GeminiModel[];

	// Common settings
	prompt: string;
	autoClearCache: boolean;
}

const DEFAULT_SETTINGS: AIImageAnalyzerPluginSettings = {
	debug: false,
	activeProvider: "ollama",

	// Ollama defaults
	ollamaURL: "http://127.0.0.1:11434",
	ollamaToken: "",
	ollamaModel: possibleModels[0],

	// Gemini defaults
	geminiApiKey: "",
	geminiModel: fallbackGeminiModels[0],
	availableGeminiModels: [],

	prompt: "Describe the image. Just use Keywords. For example: cat, dog, tree. This must be Computer readable. The provided pictures are used in an notebook. Please provide at least 5 Keywords. It will be used to search for the image later.",
	autoClearCache: true,
};

export let settings: AIImageAnalyzerPluginSettings = Object.assign(
	{},
	DEFAULT_SETTINGS,
);

export async function loadSettings(plugin: AIImageAnalyzerPlugin) {
	settings = Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());

	// Initialize the active provider
	if (settings.activeProvider === "ollama") {
		setOllama(
			new Ollama({
				host: settings.ollamaURL,
				headers: {
					Authorization: `Bearer ${settings.ollamaToken}`,
				},
			}),
		);
	} else if (settings.activeProvider === "gemini" && settings.geminiApiKey) {
		setGeminiAPI(settings.geminiApiKey);

		// Fetch available Gemini models if we have an API key
		if (settings.geminiApiKey) {
			try {
				settings.availableGeminiModels =
					await fetchAvailableGeminiModels(settings.geminiApiKey);

				// If the current model isn't in the list, set it to the first available model
				if (settings.availableGeminiModels.length > 0) {
					const modelExists = settings.availableGeminiModels.some(
						(model) => model.model === settings.geminiModel.model,
					);

					if (!modelExists) {
						settings.geminiModel =
							settings.availableGeminiModels[0];
					}
				}
				await plugin.saveData(settings);
			} catch (e) {
				console.error("Failed to fetch Gemini models:", e);
			}
		}
	}
}

export async function saveSettings(plugin: AIImageAnalyzerPlugin) {
	// Initialize the active provider
	if (settings.activeProvider === "ollama") {
		setOllama(
			new Ollama({
				host: settings.ollamaURL,
				headers: {
					Authorization: `Bearer ${settings.ollamaToken}`,
				},
			}),
		);
	} else if (settings.activeProvider === "gemini" && settings.geminiApiKey) {
		setGeminiAPI(settings.geminiApiKey);
	}

	await plugin.saveData(settings);
}

export class AIImageAnalyzerSettingsTab extends PluginSettingTab {
	plugin: AIImageAnalyzerPlugin;
	private geminiModelsDropdown: Setting | null = null;
	private fetchingModels = false;

	constructor(app: App, plugin: AIImageAnalyzerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// General settings section
		containerEl.createEl("h2", { text: "General Settings" });

		// Provider selection
		new Setting(containerEl)
			.setName("AI Provider")
			.setDesc("Select which AI provider to use for image analysis")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("ollama", "Ollama (Local)")
					.addOption("gemini", "Google Gemini")
					.setValue(settings.activeProvider)
					.onChange(async (value: Provider) => {
						settings.activeProvider = value;
						await saveSettings(this.plugin);
						if (settings.autoClearCache) {
							await clearCache();
						}
						// Force refresh the settings tab to show/hide relevant settings
						this.display();
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

		new Setting(containerEl)
			.setName("Clear cache")
			.setDesc("Clear the cache, reanalyzing images could take a while")
			.addButton((button) =>
				button.setButtonText("Clear cache").onClick(async () => {
					await clearCache();
					new Notice("Cache cleared");
				}),
			);

		// Show settings based on the active provider
		if (settings.activeProvider === "ollama") {
			this.displayOllamaSettings(containerEl);
		} else if (settings.activeProvider === "gemini") {
			this.displayGeminiSettings(containerEl);
		}

		// Common settings section
		containerEl.createEl("h2", { text: "Common Settings" });

		new Setting(containerEl)
			.setName("Prompt")
			.setDesc("Set the prompt for the AI model")
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

	displayOllamaSettings(containerEl: HTMLElement): void {
		containerEl.createEl("h2", { text: "Ollama Settings" });

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Select the Ollama model to use")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(
						possibleModels.reduce(
							(acc, model) => {
								acc[model.name] = model.name;
								return acc;
							},
							{} as Record<string, string>,
						),
					)
					.setValue(
						possibleModels.find(
							(model) =>
								model.model === settings.ollamaModel.model,
						)!.name,
					)
					.onChange(async (value) => {
						settings.ollamaModel = possibleModels.find(
							(model) => model.name === value,
						)!;
						await saveSettings(this.plugin);
						if (settings.autoClearCache) {
							await clearCache();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Pull Model")
			.setDesc("Pull the selected model")
			.addButton((button) =>
				button
					.setButtonText("Pull Model")
					.onClick(async () => await pullImage()),
			);

		new Setting(containerEl)
			.setName("Ollama URL")
			.setDesc("Set the URL for the Ollama server")
			.addText((text) =>
				text
					.setPlaceholder("Enter the host (http://127.0.0.1:11434)")
					.setValue(settings.ollamaURL)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_SETTINGS.ollamaURL;
						}
						settings.ollamaURL = value;
						await saveSettings(this.plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Ollama Token (Optional)")
			.setDesc("Set the token for authentication with the Ollama server")
			.addText((text) =>
				text
					.setValue(settings.ollamaToken !== "" ? "••••••••••" : "")
					.onChange(async (value) => {
						if (value.includes("•")) {
							return;
						}
						settings.ollamaToken = value;
						await saveSettings(this.plugin);
					}),
			);
	}

	displayGeminiSettings(containerEl: HTMLElement): void {
		containerEl.createEl("h2", { text: "Google Gemini Settings" });

		// API Key
		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Your Google AI Studio API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your Gemini API key")
					.setValue(settings.geminiApiKey !== "" ? "••••••••••" : "")
					.onChange(async (value) => {
						if (value.includes("•")) {
							return;
						}
						settings.geminiApiKey = value;
						await saveSettings(this.plugin);

						// When the API key changes, fetch available models
						if (value) {
							this.fetchAvailableModels(value);
						}
					}),
			);

		// Test Connection and Fetch Models button
		new Setting(containerEl)
			.setName("API Connection")
			.setDesc(
				"Test the connection to the Gemini API and fetch available models",
			)
			.addButton((button) => {
				this.setupFetchModelsButton(button);
				return button;
			});

		// Create the model selection dropdown
		this.geminiModelsDropdown = new Setting(containerEl)
			.setName("Model")
			.setDesc("Select the Gemini model to use");

		// Populate the dropdown with available models or fallback models
		this.updateGeminiModelDropdown();
	}

	private setupFetchModelsButton(button: ButtonComponent): void {
		button.setButtonText(
			this.fetchingModels ? "Fetching Models..." : "Test & Fetch Models",
		);

		button.onClick(async () => {
			if (this.fetchingModels) return;

			if (!settings.geminiApiKey) {
				new Notice("Please enter an API key first");
				return;
			}

			// Set up the Gemini API with the current key
			setGeminiAPI(settings.geminiApiKey);

			// Test the API connection
			const isConnected = await checkGeminiAPI();
			if (!isConnected) {
				return;
			}

			// If connection is successful, fetch models
			await this.fetchAvailableModels(settings.geminiApiKey);
		});
	}

	private async fetchAvailableModels(apiKey: string): Promise<void> {
		this.fetchingModels = true;

		if (this.geminiModelsDropdown) {
			this.geminiModelsDropdown.setDesc("Fetching available models...");
		}

		try {
			// Fetch available models
			const models = await fetchAvailableGeminiModels(apiKey);

			// Update settings with available models
			settings.availableGeminiModels = models;

			// Ensure the current model is in the list or select the first one
			if (models.length > 0) {
				const modelExists = models.some(
					(model) => model.model === settings.geminiModel.model,
				);
				if (!modelExists) {
					settings.geminiModel = models[0];
				}
			}

			// Save settings
			await saveSettings(this.plugin);

			// Update the dropdown with the new models
			this.updateGeminiModelDropdown();

			new Notice(`Found ${models.length} available Gemini models`);
		} catch (error) {
			console.error("Error fetching models:", error);
			new Notice(`Error fetching models: ${error}`);
		} finally {
			this.fetchingModels = false;
			if (this.geminiModelsDropdown) {
				this.geminiModelsDropdown.setDesc(
					"Select the Gemini model to use",
				);
			}
		}
	}

	private updateGeminiModelDropdown(): void {
		if (!this.geminiModelsDropdown) return;

		// Clear existing component
		this.geminiModelsDropdown.components = [];

		// Get the models to use - either available models or fallback
		const modelsToUse =
			settings.availableGeminiModels.length > 0
				? settings.availableGeminiModels
				: fallbackGeminiModels;

		// Add dropdown component
		this.geminiModelsDropdown.addDropdown((dropdown) => {
			// Add options for each model
			const options = modelsToUse.reduce(
				(acc, model) => {
					acc[model.model] = model.name;
					return acc;
				},
				{} as Record<string, string>,
			);

			dropdown.addOptions(options);

			// Set current value
			dropdown.setValue(settings.geminiModel.model);

			// Handle change
			dropdown.onChange(async (value) => {
				const selectedModel = modelsToUse.find(
					(model) => model.model === value,
				);
				if (selectedModel) {
					settings.geminiModel = selectedModel;
					await saveSettings(this.plugin);

					if (settings.autoClearCache) {
						await clearCache();
					}
				}
			});

			return dropdown;
		});
	}
}
