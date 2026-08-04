import { Provider } from "../provider";
import { Notice, Setting } from "obsidian";
import { debugLog } from "../../util";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import AIImageAnalyzerPlugin from "../../main";
import { saveSettings, settings } from "../../settings";
import { extractErrorMessage } from "../../errorUtil";

const context = "ai-adapter/providers/openAiCompatibleProvider";

export type OpenAiCompatibleSettings = {
	lastModel: Models;
	lastImageModel: Models;
	url: string;
	token: string;
	temperature: number;
};

const CONNECTION_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_ERROR_BODY = 500;

// shown until the gateway answers with its model list
const PLACEHOLDER_MODEL: Models = {
	name: "No model loaded",
	model: "",
	imageReady: true,
	provider: "openai-compatible",
};

export const DEFAULT_OPEN_AI_COMPATIBLE_SETTINGS: OpenAiCompatibleSettings = {
	lastModel: PLACEHOLDER_MODEL,
	lastImageModel: PLACEHOLDER_MODEL,
	url: "http://127.0.0.1:8000",
	token: "",
	temperature: 0.7,
};

function getOpenAiCompatibleSettings(): OpenAiCompatibleSettings {
	if (!settings.aiAdapterSettings.openAiCompatibleSettings) {
		settings.aiAdapterSettings.openAiCompatibleSettings = {
			...DEFAULT_OPEN_AI_COMPATIBLE_SETTINGS,
		};
	}

	return settings.aiAdapterSettings.openAiCompatibleSettings;
}

export class OpenAiCompatibleProvider extends Provider {
	private static currentController: AbortController | undefined;

	constructor() {
		super();
		const openAiCompatibleSettings = getOpenAiCompatibleSettings();
		this.lastModel = openAiCompatibleSettings.lastModel;
		this.lastImageModel = openAiCompatibleSettings.lastImageModel;
	}

	async initialize(): Promise<boolean> {
		const success = await this.checkConnection();
		debugLog(context, "OpenAI compatible check success: " + success);
		return success;
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		const openAiCompatibleSettings = getOpenAiCompatibleSettings();

		new Setting(containerEl).setName("OpenAI compatible API").setHeading();

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc(
				"Base URL of the server, without the /v1 suffix. Any gateway that speaks the OpenAI chat completions API works here.",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("http://127.0.0.1:8000")
					.setValue(openAiCompatibleSettings.url)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_OPEN_AI_COMPATIBLE_SETTINGS.url;
						}
						openAiCompatibleSettings.url = value.replace(
							/\/+$/,
							"",
						);
						this.checkConnection().then((success) => {
							debugLog(
								context,
								"OpenAI compatible check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("API key (optional)")
			.setDesc(
				"Sent as a bearer token, leave empty for servers without authentication",
			)
			.addText((text) =>
				text
					.setValue(
						openAiCompatibleSettings.token !== ""
							? "••••••••••"
							: "",
					)
					.onChange(async (value) => {
						if (value.includes("•")) {
							return;
						}
						openAiCompatibleSettings.token = value;
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Test the connection and reload the model list")
			.addButton((button) =>
				button.setButtonText("Test").onClick(async () => {
					const success = await this.checkConnection();
					// the model list may have resolved a new selection
					await saveSettings(plugin);
					if (success) {
						new Notice("Successfully connected to the server!");
					} else {
						new Notice("Failed to connect to the server.");
					}
				}),
			);

		let tempSpan: HTMLSpanElement;
		new Setting(containerEl)
			.setName("Temperature")
			.setDesc(
				"Controls randomness in model output (0–2). Lower values produce more deterministic responses.",
			)
			.addSlider((slider) => {
				slider
					.setLimits(0, 2, 0.1)
					.setValue(openAiCompatibleSettings.temperature)
					.onChange(async (value) => {
						openAiCompatibleSettings.temperature = value;
						await saveSettings(plugin);
					});
				tempSpan = slider.sliderEl.parentElement!.createEl("span");
				tempSpan.textContent =
					openAiCompatibleSettings.temperature.toFixed(1);
				slider.sliderEl.addEventListener("input", () => {
					tempSpan.textContent = parseFloat(
						slider.sliderEl.value,
					).toFixed(1);
				});
			});
	}

	async queryHandling(prompt: string): Promise<string> {
		return this.chatCompletion(
			[{ role: "user", content: prompt }],
			settings.aiAdapterSettings.selectedModel.model,
		);
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		return this.chatCompletion(
			[
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
			settings.aiAdapterSettings.selectedImageModel.model,
		);
	}

	private async chatCompletion(
		messages: unknown[],
		model: string,
	): Promise<string> {
		const openAiCompatibleSettings = getOpenAiCompatibleSettings();
		const url = `${openAiCompatibleSettings.url}/v1/chat/completions`;
		const token = openAiCompatibleSettings.token;

		if (!model) {
			throw new Error(
				"No model selected. Open the settings, test the connection and pick a model.",
			);
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		OpenAiCompatibleProvider.abortCurrentRequest();
		const controller = new AbortController();
		OpenAiCompatibleProvider.currentController = controller;

		// an analysis can legitimately run for minutes, this only bounds a
		// server that never answers at all
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					messages,
					temperature: openAiCompatibleSettings.temperature,
					// some gateways stream by default, the parsing below
					// expects a single JSON body
					stream: false,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				// an error page can be arbitrarily long, this ends up in a
				// notice
				const errorText = (await response.text()).slice(
					0,
					MAX_ERROR_BODY,
				);
				throw new Error(
					`HTTP error! status: ${response.status}, ${errorText}`,
				);
			}

			const data = await response.json();
			return data.choices?.[0]?.message?.content || "";
		} catch (e) {
			const errMsg = extractErrorMessage(e);
			debugLog(context, errMsg);
			if (timedOut) {
				const timeoutErr = new Error(
					`The server did not answer within ${REQUEST_TIMEOUT_MS / 1000} seconds`,
				);
				(timeoutErr as unknown as { cause?: unknown }).cause = e;
				throw timeoutErr;
			}
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
			clearTimeout(timeout);
			OpenAiCompatibleProvider.currentController = undefined;
		}
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		getOpenAiCompatibleSettings().lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		getOpenAiCompatibleSettings().lastImageModel = model;
	}

	shutdown(): void {
		debugLog(context, "Shutting down OpenAI compatible provider");
		OpenAiCompatibleProvider.abortCurrentRequest();
	}

	private async checkConnection(): Promise<boolean> {
		const openAiCompatibleSettings = getOpenAiCompatibleSettings();
		const url = `${openAiCompatibleSettings.url}/v1/models`;
		const token = openAiCompatibleSettings.token;

		const headers: Record<string, string> = {};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		// the plugin awaits this on load, an unresponsive server must not hold
		// the whole startup
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			CONNECTION_TIMEOUT_MS,
		);

		try {
			const response = await fetch(url, {
				headers,
				signal: controller.signal,
			});
			if (!response.ok) {
				debugLog(
					context,
					"Failed to connect to the server: status " +
						response.status,
				);
				return false;
			}

			const data = await response.json();
			const ids: string[] = (data.data ?? [])
				.map((entry: { id?: string }) => entry.id)
				.filter((id: string | undefined): id is string => !!id);

			// the models endpoint carries no vision flag, so every model is
			// offered for image analysis and the server rejects the ones that
			// cannot handle it
			this.replaceModels(
				ids.map((id) => ({
					name: id,
					model: id,
					imageReady: true,
					provider: "openai-compatible" as const,
				})),
			);

			debugLog(context, `Connected, ${ids.length} models available`);
			return true;
		} catch (e) {
			debugLog(context, "Failed to connect to the server: " + e);
			return false;
		} finally {
			clearTimeout(timeout);
		}
	}

	private replaceModels(models: Models[]): void {
		for (let i = possibleModels.length - 1; i >= 0; i--) {
			if (possibleModels[i].provider === "openai-compatible") {
				possibleModels.splice(i, 1);
			}
		}
		const available = models.length > 0 ? models : [PLACEHOLDER_MODEL];
		possibleModels.push(...available);

		if (settings.aiAdapterSettings.provider === "openai-compatible") {
			// a model saved in an earlier session may be gone from the server
			const keep = (selected: Models) =>
				available.find((m) => m.model === selected.model) ??
				available[0];

			const imageModel = keep(
				settings.aiAdapterSettings.selectedImageModel,
			);
			settings.aiAdapterSettings.selectedImageModel = imageModel;
			this.setLastImageModel(imageModel);

			const textModel = keep(settings.aiAdapterSettings.selectedModel);
			settings.aiAdapterSettings.selectedModel = textModel;
			this.setLastModel(textModel);
		}

		notifyModelsChange();
	}

	static abortCurrentRequest(): void {
		if (OpenAiCompatibleProvider.currentController) {
			try {
				OpenAiCompatibleProvider.currentController.abort();
			} catch {
				// ignore
			} finally {
				OpenAiCompatibleProvider.currentController = undefined;
			}
		}
	}
}
