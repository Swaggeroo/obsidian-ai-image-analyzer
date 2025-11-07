import { MenuItem, Notice, Plugin, TFile } from "obsidian";
import { isInCache, removeFromCache } from "./cache";
import {
	analyzeImage,
	analyzeImageWithNotice,
	analyzeToClipboard,
} from "./analyserManager";
import { debugLog, isImageFile } from "./util";
import { AIImageAnalyzerSettingsTab, loadSettings } from "./settings";
import { imagesProcessQueue } from "./globals";
import {
	provider,
	setProvider,
	unsubscribeFunctionSetting,
} from "./ai-adapter/globals";
import { initProvider } from "./ai-adapter/util";

const context = "main";

export type AIImageAnalyzerAPI = {
	analyzeImage: (file: TFile) => Promise<string>;
	canBeAnalyzed: (file: TFile) => boolean;
	isInCache: (file: TFile) => Promise<boolean>;
};

export default class AIImageAnalyzerPlugin extends Plugin {
	public api: AIImageAnalyzerAPI = {
		analyzeImage: analyzeImage,
		canBeAnalyzed: isImageFile,
		isInCache: isInCache,
	};

	async onload() {
		debugLog(context, "loading ai image analyzer plugin");
		await loadSettings(this);

		setProvider(initProvider());

		this.addCommand({
			id: "analyze-image-to-clipboard",
			name: "Analyze image to clipboard",
			checkCallback: (checking: boolean) => {
				const file = getActiveFile();

				if (file != null && isImageFile(file)) {
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
				if (file != null && isImageFile(file)) {
					if (!checking) {
						analyzeImageWithNotice(file);
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
				if (file != null && isImageFile(file)) {
					if (!checking) {
						removeFromCache(file);
						new Notice("Cache cleared");
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

						const submenu = item.setSubmenu();

						submenu.addItem((item: MenuItem) =>
							item
								.setTitle("Analyze image to clipboard")
								.setIcon("clipboard")
								.onClick(() => {
									analyzeToClipboard(file);
								}),
						);

						submenu.addItem((item: MenuItem) =>
							item
								.setTitle("Analyze image")
								.setIcon("search")
								.onClick(async () => {
									await removeFromCache(file);
									await analyzeImageWithNotice(file);
								}),
						);

						submenu.addItem((item: MenuItem) =>
							item
								.setTitle("Clear cache")
								.setIcon("trash")
								.onClick(async () => {
									await removeFromCache(file);
									new Notice("Cache cleared");
								}),
						);
					});
				}
			}),
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIImageAnalyzerSettingsTab(this.app, this));
	}

	onunload() {
		imagesProcessQueue.clear();
		provider.shutdown();
		if (unsubscribeFunctionSetting) {
			unsubscribeFunctionSetting();
		}
		debugLog(context, "unloading ai image analyzer plugin");
	}
}

function getActiveFile(): TFile | null {
	return (
		this.app.workspace.activeEditor?.file ??
		this.app.workspace.getActiveFile()
	);
}
