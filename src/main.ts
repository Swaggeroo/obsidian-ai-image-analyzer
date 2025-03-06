import { MenuItem, Notice, Plugin, TFile } from "obsidian";
import { Ollama } from "ollama";
import { isInCache, removeFromCache } from "./cache";
import { analyzeImage, analyzeImageWithNotice, analyzeToClipboard, checkOllama, setOllama, } from "./ollamaManager";
import { analyzeImageWithGemini, checkGeminiAPI, fetchAvailableGeminiModels, setGeminiAPI, } from "./geminiManager";
import { debugLog, isImageFile, convertToSnakeCase } from "./util";
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

		this.addCommand({
			id: "analyze-and-rename-image",
			name: "Analyze image and rename with tags",
			checkCallback: (checking: boolean) => {
				const file = getActiveFile();
				if (file && isImageFile(file)) {
					if (!checking) {
						analyzeAndRenameFile(file);
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

					menu.addItem((item: MenuItem) => {
						item.setTitle("AI analyze and rename with tags");
						item.setIcon("text-cursor-input");
						item.onClick(async () => {
							analyzeAndRenameFile(file);
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

// Add this function to handle analyzing and renaming
async function analyzeAndRenameFile(file: TFile) {
	new Notice(`Analyzing ${file.name} for renaming...`);
	
	// Use the appropriate analysis function based on the active provider
	const analysisText = settings.activeProvider === "ollama"
		? await analyzeImage(file)
		: await analyzeImageWithGemini(file);
	
	if (!analysisText) {
		new Notice(`Could not analyze ${file.name}`);
		return;
	}
	
	// Convert analysis to snake_case
	const snakeCaseName = convertToSnakeCase(analysisText);
	
	// Get file extension
	const extension = file.extension;
	
	// Get the directory path
	const dirPath = file.parent?.path || "";
	
	// Create base filename
	const baseFilename = `${snakeCaseName}.${extension}`;
	let newFilename = baseFilename;
	let newPath = dirPath ? `${dirPath}/${newFilename}` : newFilename;
	
	// Check if file exists and create a unique name if needed
	let counter = 1;
	while (await this.app.vault.adapter.exists(newPath)) {
		// Skip if it's the same file (same path)
		if (newPath === file.path) {
			break;
		}
		
		// Create a new filename with a counter
		newFilename = `${snakeCaseName}_${counter}.${extension}`;
		newPath = dirPath ? `${dirPath}/${newFilename}` : newFilename;
		counter++;
	}
	
	try {
		// Rename the file
		await this.app.fileManager.renameFile(file, newPath);
		new Notice(`Renamed to: ${newFilename}`);
	} catch (error) {
		debugLog(`Error renaming file: ${error}`);
		new Notice(`Error renaming file: ${error}`);
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
