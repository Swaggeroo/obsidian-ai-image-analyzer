import { Provider } from "../provider";
import { Notice, Setting } from "obsidian";
import { debugLog } from "../../util";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import AIImageAnalyzerPlugin from "../../main";
import { saveSettings, settings } from "../../settings";

const context = "ai-adapter/providers/llamaCppProvider";

export type LlamaCppSettings = {
	lastModel: Models;
	lastImageModel: Models;
	url: string;
	token: string;
};

// llama.cpp use local model
const LLAMA_CPP_MODEL: Models = {
	name: "llama.cpp (GGUF)",
	model: "local-gguf-model",
	imageReady: true,
	provider: "llama-cpp",
};

export const DEFAULT_LLAMA_CPP_SETTINGS: LlamaCppSettings = {
	lastModel: LLAMA_CPP_MODEL,
	lastImageModel: LLAMA_CPP_MODEL,
	url: "http://127.0.0.1:8080",
	token: "",
};

function getLlamaCppSettings(): LlamaCppSettings {
	if (!settings.aiAdapterSettings.llamaCppSettings) {
		settings.aiAdapterSettings.llamaCppSettings = {
			...DEFAULT_LLAMA_CPP_SETTINGS,
		};
	}

	return settings.aiAdapterSettings.llamaCppSettings;
}

export class LlamaCppProvider extends Provider {
	private static currentController: AbortController | undefined;

	constructor() {
		super();
		const llamaCppSettings = getLlamaCppSettings();
		this.lastModel = llamaCppSettings.lastModel;
		this.lastImageModel = llamaCppSettings.lastImageModel;

		// ensure model list include llama.cpp's model
		if (!possibleModels.some((m) => m.provider === "llama-cpp")) {
			possibleModels.push(LLAMA_CPP_MODEL);
		}

		this.checkConnection().then((success) => {
			debugLog(context, "llama.cpp check success: " + success);
		});
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		const llamaCppSettings = getLlamaCppSettings();

		new Setting(containerEl)
			.setName("Llama.cpp (llama-server)")
			.setHeading();

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc(
				"Set the URL for the llama-server (by default use `http://127.0.0.1:8080`)",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("http://127.0.0.1:8080")
					.setValue(llamaCppSettings.url)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_LLAMA_CPP_SETTINGS.url;
						}
						llamaCppSettings.url = value;
						this.checkConnection().then((success) => {
							debugLog(
								context,
								"llama.cpp check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("API token (optional)")
			.setDesc(
				"Set the token used to authenticate with the llama-server (if required)",
			)
			.addText((text) =>
				text
					.setValue(
						llamaCppSettings.token !== ""
							? "••••••••••"
							: "",
					)
					.onChange(async (value) => {
						if (value.contains("•")) {
							return;
						}
						llamaCppSettings.token = value;
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Test the connection to llama-server")
			.addButton((button) =>
				button.setButtonText("Test").onClick(async () => {
					const success = await this.checkConnection();
					if (success) {
						new Notice("Successfully connected to llama-server!");
					} else {
						new Notice("Failed to connect to llama-server.");
					}
				}),
			);
	}

	async queryHandling(prompt: string): Promise<string> {
		const llamaCppSettings = getLlamaCppSettings();
		const url = `${llamaCppSettings.url}/v1/chat/completions`;
		const token = llamaCppSettings.token;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		LlamaCppProvider.abortCurrentRequest();
		const controller = new AbortController();
		LlamaCppProvider.currentController = controller;

		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					messages: [{ role: "user", content: prompt }],
					temperature: 0.7,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`HTTP error! status: ${response.status}, ${errorText}`,
				);
			}

			const data = await response.json();
			return data.choices?.[0]?.message?.content || "";
		} catch (e) {
			const errMsg =
				e instanceof Error
					? e.message
					: typeof e === "string"
						? e
						: (JSON.stringify(e) ?? String(e));
			debugLog(context, errMsg);
			if (e instanceof Error && e.name === "AbortError") {
				return "[AI-ERROR] Request was aborted";
			}
			return `[AI-ERROR] ${errMsg}`;
		} finally {
			LlamaCppProvider.currentController = undefined;
		}
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		const llamaCppSettings = getLlamaCppSettings();
		const url = `${llamaCppSettings.url}/v1/chat/completions`;
		const token = llamaCppSettings.token;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		LlamaCppProvider.abortCurrentRequest();
		const controller = new AbortController();
		LlamaCppProvider.currentController = controller;

		try {
			// base64 picture
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
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
					temperature: 0.7,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`HTTP error! status: ${response.status}, ${errorText}`,
				);
			}

			const data = await response.json();
			return data.choices?.[0]?.message?.content || "";
		} catch (e) {
			const errMsg =
				e instanceof Error
					? e.message
					: typeof e === "string"
						? e
						: (JSON.stringify(e) ?? String(e));
			debugLog(context, errMsg);
			if (e instanceof Error && e.name === "AbortError") {
				return "[AI-ERROR] Request was aborted";
			}
			return `[AI-ERROR] ${errMsg}`;
		} finally {
			LlamaCppProvider.currentController = undefined;
		}
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		getLlamaCppSettings().lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		getLlamaCppSettings().lastImageModel = model;
	}

	shutdown(): void {
		debugLog(context, "Shutting down llama.cpp provider");
		LlamaCppProvider.abortCurrentRequest();
	}

	private async checkConnection(): Promise<boolean> {
		const llamaCppSettings = getLlamaCppSettings();
		const url = `${llamaCppSettings.url}/health`;
		const token = llamaCppSettings.token;

		const headers: Record<string, string> = {};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		try {
			const response = await fetch(url, { headers });
			if (response.ok) {
				debugLog(context, "Successfully connected to llama-server");

				// ensure model list include llama.cpp's model
				if (!possibleModels.some((m) => m.provider === "llama-cpp")) {
					possibleModels.push(LLAMA_CPP_MODEL);
					notifyModelsChange();
				}

				return true;
			}
		} catch (e) {
			debugLog(context, "Failed to connect to llama-server: " + e);
		}
		return false;
	}

	static abortCurrentRequest(): void {
		if (LlamaCppProvider.currentController) {
			try {
				LlamaCppProvider.currentController.abort();
			} catch {
				// ignore
			} finally {
				LlamaCppProvider.currentController = undefined;
			}
		}
	}
}
