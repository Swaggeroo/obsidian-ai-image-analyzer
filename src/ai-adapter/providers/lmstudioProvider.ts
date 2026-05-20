import AIImageAnalyzerPlugin from "../../main";
import { Notice, Setting } from "obsidian";
import { Provider } from "../provider";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import { saveSettings, settings } from "../../settings";
import { debugLog } from "../../util";

const context = "ai-adapter/providers/lmstudioProvider";

export type LmStudioSettings = {
	lastModel: Models;
	lastImageModel: Models;
	url: string;
};

export const DEFAULT_LMSTUDIO_SETTINGS: LmStudioSettings = {
	lastModel: possibleModels[0],
	lastImageModel: possibleModels[0],
	url: "http://localhost:1234",
};

export class LmStudioProvider extends Provider {
	private currentController: AbortController | undefined;

	constructor() {
		super();
		this.lastModel =
			settings.aiAdapterSettings.lmstudioSettings.lastModel;
		this.lastImageModel =
			settings.aiAdapterSettings.lmstudioSettings.lastImageModel;
		this.checkLmStudio().then((success) => {
			debugLog(context, "LM Studio check success: " + success);
		});
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		new Setting(containerEl).setName("LM Studio").setHeading();

		new Setting(containerEl)
			.setName("LM Studio URL")
			.setDesc("Set the URL for the LM Studio server (OpenAI-compatible API)")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("Enter the host (http://localhost:1234)")
					.setValue(settings.aiAdapterSettings.lmstudioSettings.url)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_LMSTUDIO_SETTINGS.url;
						}
						settings.aiAdapterSettings.lmstudioSettings.url = value;
						this.checkLmStudio().then((success) => {
							debugLog(
								context,
								"LM Studio check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Image model name")
			.setDesc("Enter the model ID to use for image analysis (e.g. google/gemma-4-e2b)")
			.addText((text) =>
				text
					.setPlaceholder("google/gemma-4-e2b")
					.setValue(settings.aiAdapterSettings.selectedImageModel.model)
					.onChange(async (value) => {
						if (value.length === 0) return;
						const model: Models = {
							name: `${value} (LM Studio)`,
							model: value,
							imageReady: true,
							provider: "lmstudio",
						};
						if (!possibleModels.some((pm) => pm.model === value && pm.imageReady)) {
							possibleModels.push(model);
						}
						settings.aiAdapterSettings.selectedImageModel = model;
						this.setLastImageModel(model);
						await saveSettings(plugin);
					}),
			);
	}

	async queryHandling(prompt: string): Promise<string> {
		const url = settings.aiAdapterSettings.lmstudioSettings.url;
		const model = settings.aiAdapterSettings.selectedModel.model;

		const controller = new AbortController();
		this.currentController = controller;

		try {
			const response = await fetch(`${url}/v1/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: prompt }],
				}),
			});

			if (!response.ok) {
				const errText = await response.text();
				return `[AI-ERROR] LM Studio API error (${response.status}): ${errText}`;
			}

			const data = await response.json();
			const content = data?.choices?.[0]?.message?.content;
			if (!content) {
				return "[AI-ERROR] No response from LM Studio API";
			}
			return content;
		} finally {
			if (this.currentController === controller) {
				this.currentController = undefined;
			}
		}
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		const url = settings.aiAdapterSettings.lmstudioSettings.url;
		const model = settings.aiAdapterSettings.selectedImageModel.model;

		const controller = new AbortController();
		this.currentController = controller;

		try {
			const response = await fetch(`${url}/v1/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: JSON.stringify({
					model,
					messages: [
						{
							role: "user",
							content: [
								{ type: "text", text: prompt },
								{
									type: "image_url",
									image_url: {
										url: `data:image/png;base64,${image}`,
									},
								},
							],
						},
					],
				}),
			});

			if (!response.ok) {
				const errText = await response.text();
				return `[AI-ERROR] LM Studio API error (${response.status}): ${errText}`;
			}

			const data = await response.json();
			const content = data?.choices?.[0]?.message?.content;
			if (!content) {
				return "[AI-ERROR] No response from LM Studio API";
			}
			return content;
		} finally {
			if (this.currentController === controller) {
				this.currentController = undefined;
			}
		}
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		settings.aiAdapterSettings.lmstudioSettings.lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		settings.aiAdapterSettings.lmstudioSettings.lastImageModel = model;
	}

	shutdown(): void {
		debugLog(context, "Shutting down LM Studio provider");
		if (this.currentController) {
			try {
				this.currentController.abort();
			} catch {
				// ignore
			} finally {
				this.currentController = undefined;
			}
		}
	}

	private async checkLmStudio(): Promise<boolean> {
		const url = settings.aiAdapterSettings.lmstudioSettings.url;
		try {
			const response = await fetch(`${url}/v1/models`);
			if (!response.ok) {
				throw new Error(
					`LM Studio returned HTTP ${response.status}`,
				);
			}

			const data = await response.json();
			const models: { id: string }[] = data?.data ?? [];
			let updated = false;

			for (const m of models) {
				const modelId = m.id;
				const modelName = `${modelId} (LM Studio)`;

				// Add as image-capable model (multimodal)
				if (
					!possibleModels.some(
						(pm) => pm.model === modelId && pm.imageReady,
					)
				) {
					possibleModels.push({
						name: modelName,
						model: modelId,
						imageReady: true,
						provider: "lmstudio",
					});
					debugLog(context, "Added image model: " + modelName);
					updated = true;
				}

				// Add as text model
				if (
					!possibleModels.some(
						(pm) => pm.model === modelId && !pm.imageReady,
					)
				) {
					possibleModels.push({
						name: modelName,
						model: modelId,
						imageReady: false,
						provider: "lmstudio",
					});
					debugLog(context, "Added text model: " + modelName);
					updated = true;
				}
			}

			if (updated) {
				debugLog(context, "Models updated, notifying settings tab");
				notifyModelsChange();
			}

			return true;
		} catch (e) {
			const errMsg =
				e instanceof Error
					? e.message
					: typeof e === "string"
						? e
						: JSON.stringify(e);
			debugLog(context, errMsg);
			new Notice(
				"Error connecting to LM Studio. Please check the URL and make sure LM Studio is running.",
			);
			new Notice(errMsg);
			return false;
		}
	}
}
