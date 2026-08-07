import { Provider } from "../provider";
import { Notice, Setting } from "obsidian";
import { debugLog } from "../../util";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import AIImageAnalyzerPlugin from "../../main";
import { saveSettings, settings } from "../../settings";
import {
	waitForAI,
	IAIProvider,
	IAIProvidersService,
} from "@obsidian-ai-providers/sdk";

const context = "ai-adapter/providers/aiProvidersProvider";

export type AiProvidersSettings = {
	lastModel: Models;
	lastImageModel: Models;
};

// Placeholder shown until the AI Providers plugin reports its configured providers
const AI_PROVIDERS_FALLBACK_MODEL: Models = {
	name: "AI Providers (not loaded)",
	model: "",
	imageReady: true,
	provider: "ai-providers",
};

export const DEFAULT_AI_PROVIDERS_SETTINGS: AiProvidersSettings = {
	lastModel: AI_PROVIDERS_FALLBACK_MODEL,
	lastImageModel: AI_PROVIDERS_FALLBACK_MODEL,
};

function getAiProvidersSettings(): AiProvidersSettings {
	if (!settings.aiAdapterSettings.aiProvidersSettings) {
		settings.aiAdapterSettings.aiProvidersSettings = {
			...DEFAULT_AI_PROVIDERS_SETTINGS,
		};
	}

	return settings.aiAdapterSettings.aiProvidersSettings;
}

function providerDisplayName(p: IAIProvider): string {
	return p.model ? `${p.name} (${p.model})` : p.name;
}

export class AiProvidersProvider extends Provider {
	private static currentController: AbortController | undefined;

	constructor() {
		super();
		const aiProvidersSettings = getAiProvidersSettings();
		this.lastModel = aiProvidersSettings.lastModel;
		this.lastImageModel = aiProvidersSettings.lastImageModel;
	}

	async initialize(): Promise<boolean> {
		try {
			const service = await AiProvidersProvider.getService();
			this.refreshModels(service);
			debugLog(
				context,
				`AI Providers loaded with ${service.providers.length} provider(s)`,
			);
			return service.providers.length > 0;
		} catch (e) {
			debugLog(context, "Failed to load AI Providers plugin: " + e);
			return false;
		}
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "AI Providers" is a plugin name
		new Setting(containerEl).setName("AI Providers").setHeading();

		new Setting(containerEl)
			.setName("Providers")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "AI Providers" is a plugin name
				"Providers are configured in the AI Providers plugin and listed in the image model dropdown above. Select a provider whose model supports vision.",
			)
			.addButton((button) =>
				button.setButtonText("Reload providers").onClick(async () => {
					try {
						const service = await AiProvidersProvider.getService();
						this.refreshModels(service);
						new Notice(
							`Loaded ${service.providers.length} provider(s) from AI Providers`,
						);
					} catch (e) {
						debugLog(
							context,
							"Failed to reload providers: " + e,
						);
						new Notice(
							// eslint-disable-next-line obsidianmd/ui/sentence-case -- "AI Providers" is a plugin name
							"Could not reach the AI Providers plugin. Is it installed and enabled?",
						);
					}
					await saveSettings(plugin);
				}),
			);
	}

	async queryHandling(prompt: string): Promise<string> {
		return this.executeQuery(prompt, undefined, this.lastModel);
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		return this.executeQuery(
			prompt,
			`data:image/png;base64,${image}`,
			this.lastImageModel,
		);
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		getAiProvidersSettings().lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		getAiProvidersSettings().lastImageModel = model;
	}

	shutdown(): void {
		debugLog(context, "Shutting down AI Providers provider");
		AiProvidersProvider.abortCurrentRequest();
	}

	private async executeQuery(
		prompt: string,
		imageDataUrl: string | undefined,
		model: Models,
	): Promise<string> {
		const service = await AiProvidersProvider.getService();
		const aiProvider = service.providers.find(
			(p: IAIProvider) => p.id === model.model,
		);

		if (!aiProvider) {
			throw new Error(
				"No provider selected. Pick one in the image model dropdown (configured via the AI Providers plugin).",
			);
		}

		AiProvidersProvider.abortCurrentRequest();
		const controller = new AbortController();
		AiProvidersProvider.currentController = controller;

		try {
			const response = await service.execute({
				provider: aiProvider,
				prompt,
				...(imageDataUrl ? { images: [imageDataUrl] } : {}),
				abortController: controller,
			});
			return typeof response === "string" ? response : "";
		} catch (e) {
			const errMsg =
				e instanceof Error
					? e.message
					: typeof e === "string"
						? e
						: (JSON.stringify(e) ?? String(e));
			debugLog(context, errMsg);
			if (e instanceof Error && e.name === "AbortError") {
				const abortErr = new Error("Request was aborted");
				abortErr.name = "AbortError";
				(abortErr as unknown as { cause?: unknown }).cause = e;
				throw abortErr;
			}
			const reErr = new Error(errMsg);
			(reErr as unknown as { cause?: unknown }).cause = e;
			throw reErr;
		} finally {
			// Only clear if no newer request has replaced this controller
			if (AiProvidersProvider.currentController === controller) {
				AiProvidersProvider.currentController = undefined;
			}
		}
	}

	private refreshModels(service: IAIProvidersService) {
		// Replace previously registered ai-providers entries with the current list
		for (let i = possibleModels.length - 1; i >= 0; i--) {
			if (possibleModels[i].provider === "ai-providers") {
				possibleModels.splice(i, 1);
			}
		}

		for (const p of service.providers) {
			possibleModels.push({
				name: providerDisplayName(p),
				model: p.id,
				imageReady: true,
				provider: "ai-providers",
			});
		}

		if (service.providers.length === 0) {
			possibleModels.push(AI_PROVIDERS_FALLBACK_MODEL);
		}

		notifyModelsChange();
	}

	private static async getService(): Promise<IAIProvidersService> {
		const aiResolver = await waitForAI();

		// waitForAI resolves only once the AI Providers plugin announces itself;
		// cancel after a timeout so a missing plugin fails fast instead of hanging.
		const timeout = setTimeout(() => aiResolver.cancel(), 5000);
		try {
			return await aiResolver.promise;
		} finally {
			clearTimeout(timeout);
		}
	}

	static abortCurrentRequest(): void {
		if (AiProvidersProvider.currentController) {
			try {
				AiProvidersProvider.currentController.abort();
			} catch {
				// ignore
			} finally {
				AiProvidersProvider.currentController = undefined;
			}
		}
	}
}
