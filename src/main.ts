import { MenuItem, Notice, Plugin, TFile } from "obsidian";
import { Ollama } from "ollama";
import { isInCache, removeFromCache } from "./cache";
import { analyzeImage, analyzeImageWithNotice, analyzeToClipboard, checkOllama, setOllama, } from "./ollamaManager";
import { analyzeImageWithGemini, checkGeminiAPI, fetchAvailableGeminiModels, setGeminiAPI, } from "./geminiManager";
import { debugLog, isImageFile } from "./util";
import { AIImageAnalyzerSettingsTab, loadSettings, saveSettings, settings, } from "./settings";
import { imagesProcessQueue } from "./globals";

export type AIImageAnalyzerAPI = {
	analyzeImage: (file: TFile) => Promise<string>;
	canBeAnalyzed: (file: TFile) => boolean;
	isInCache: (file: TFile) => Promise<boolean>;
};

export default class AIImageAnalyzerPlugin extends Plugin {
	public api: AIImageAnalyzerAPI = {
		analyzeImage: async (file: TFile) => {
			// Return the appropriate analysis based on the active provider
			return settings.activeProvider === "ollama"
				? analyzeImage(file)
				: analyzeImageWithGemini(file);
		},
		canBeAnalyzed: isImageFile,
		isInCache: isInCache,
	};

	async onload() {
		debugLog("loading ai image analyzer plugin");
		await loadSettings(this);

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
			await checkOllama();
		} else if (
			settings.activeProvider === "gemini" &&
			settings.geminiApiKey
		) {
			setGeminiAPI(settings.geminiApiKey);

			// Fetch available models after setting the API key
			try {
				if (settings.availableGeminiModels.length === 0) {
					debugLog("Fetching available Gemini models on plugin load");
					settings.availableGeminiModels =
						await fetchAvailableGeminiModels(settings.geminiApiKey);
					await saveSettings(this);
				}

				await checkGeminiAPI();
			} catch (e) {
				debugLog(`Error initializing Gemini API: ${e}`);
			}
		}

		this.addCommand({
			id: "analyze-image-to-clipboard",
			name: "Analyze image to clipboard",
			checkCallback: (checking: boolean) => {
				const file = getActiveFile();
				if (file && isImageFile(file)) {
					if (!checking) {
						analyzeToClipboard(file);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: "analyze-image",
			name: "Analyze image",
			checkCallback: (checking: boolean) => {
				const file = getActiveFile();
				if (file && isImageFile(file)) {
					if (!checking) {
						if (settings.activeProvider === "ollama") {
							analyzeImageWithNotice(file);
						} else {
							analyzeImageWithGeminiAndNotice(file);
						}
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: "clear-cache-of-active-image",
			name: "Clear cache of active image",
			checkCallback: (checking: boolean) => {
				const file = getActiveFile();
				if (file && isImageFile(file)) {
					if (!checking) {
						removeFromCache(file).then(() => {
							new Notice(`Cache of ${file.name} cleared`);
						});
					}
					return true;
				}
				return false;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, _source) => {
				if (file instanceof TFile && isImageFile(file)) {
					menu.addItem((item: MenuItem) => {
						item.setTitle("AI analyze image");
						item.setIcon("image-file");
						item.onClick(async () => {
							if (settings.activeProvider === "ollama") {
								analyzeImageWithNotice(file);
							} else {
								analyzeImageWithGeminiAndNotice(file);
							}
						});
					});

					menu.addItem((item: MenuItem) => {
						item.setTitle("AI analyze image to clipboard");
						item.setIcon("clipboard-copy");
						item.onClick(async () => {
							analyzeToClipboard(file);
						});
					});

					menu.addItem((item: MenuItem) => {
						item.setTitle("Clear cache of image");
						item.setIcon("trash");
						item.onClick(async () => {
							await removeFromCache(file);
							new Notice(`Cache of ${file.name} cleared`);
						});
					});
				}
			}),
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIImageAnalyzerSettingsTab(this.app, this));
	}

	onunload() {
		debugLog("unloading ai image analyzer plugin");
		// Clear the queue to prevent hanging operations
		imagesProcessQueue.clear();
	}
}

// Helper function for analyzing images with Gemini and showing the result in a notice
async function analyzeImageWithGeminiAndNotice(file: TFile) {
	new Notice(`Analyzing ${file.name}...`);
	const text = await analyzeImageWithGemini(file);
	if (text) {
		new Notice(`Analysis of ${file.name}: ${text}`);
	} else {
		new Notice(`Could not analyze ${file.name}`);
	}
}

function getActiveFile(): TFile | null {
	const activeView = this.app.workspace.getActiveViewOfType(
		this.app.workspace.getViewCreator("markdown"),
	);
	if (activeView) {
		return activeView.file;
	}

	const file = this.app.workspace.getActiveFile();
	if (file) {
		return file;
	}

	return null;
}
