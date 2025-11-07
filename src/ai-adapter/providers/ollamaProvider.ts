import { Provider } from "../provider";
import { Notice, Setting } from "obsidian";
import { debugLog } from "../../util";
import { ChatResponse, Ollama } from "ollama";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import AIImageAnalyzerPlugin from "../../main";
import { saveSettings, settings } from "../../settings";

const context = "ai-adapter/providers/ollamaProvider";

let ollama: Ollama;

export type OllamaSettings = {
	lastModel: Models;
	lastImageModel: Models;
	url: string;
	fallbackUrl: string;
	token: string;
};

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
	lastModel: possibleModels[8],
	lastImageModel: possibleModels[0],
	url: "http://127.0.0.1:11434",
	fallbackUrl: "",
	token: "",
};

export class OllamaProvider extends Provider {
	private static fallback: boolean = false;
	private static currentOllamaController: AbortController | undefined;

	constructor() {
		super();
		this.lastModel = settings.aiAdapterSettings.ollamaSettings.lastModel;
		this.lastImageModel =
			settings.aiAdapterSettings.ollamaSettings.lastImageModel;
		OllamaProvider.refreshInstance();
		this.checkOllama().then((success) => {
			debugLog(context, "Ollama check success: " + success);
		});
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		new Setting(containerEl).setName("Ollama").setHeading();

		new Setting(containerEl)
			.setName("Pull models")
			.setDesc("Pull the selected models")
			.addButton((button) =>
				button.setButtonText("Pull model").onClick(async () => {
					// await OllamaProvider.pullImage(settings.aiAdapterSettings.selectedModel); Currently not needed
					await OllamaProvider.pullImage(
						settings.aiAdapterSettings.selectedImageModel,
					);
				}),
			);

		new Setting(containerEl)
			.setName("Ollama URL")
			.setDesc("Set the URL for the ollama server")
			.addText((text) =>
				text
					.setPlaceholder("Enter the host (http://127.0.0.1:11434)")
					.setValue(settings.aiAdapterSettings.ollamaSettings.url)
					.onChange(async (value) => {
						if (value.length === 0) {
							value = DEFAULT_OLLAMA_SETTINGS.url;
						}
						settings.aiAdapterSettings.ollamaSettings.url = value;
						OllamaProvider.refreshInstance();
						this.checkOllama().then((success) => {
							debugLog(
								context,
								"Ollama check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Fallback URL (optional)")
			.setDesc("Set a fallback URL for the ollama server")
			.addText((text) =>
				text
					.setPlaceholder("Enter the host (http://127.0.0.1:11434)")
					.setValue(
						settings.aiAdapterSettings.ollamaSettings.fallbackUrl,
					)
					.onChange(async (value) => {
						settings.aiAdapterSettings.ollamaSettings.fallbackUrl =
							value;
						OllamaProvider.refreshInstance();
						this.checkOllama().then((success) => {
							debugLog(
								context,
								"Ollama check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);

		new Setting(containerEl)
			.setName("Ollama token (optional)")
			.setDesc(
				"Set the token used to authenticate with the ollama server",
			)
			.addText((text) =>
				text
					.setValue(
						settings.aiAdapterSettings.ollamaSettings.token !== ""
							? "••••••••••"
							: "",
					)
					.onChange(async (value) => {
						if (value.contains("•")) {
							return;
						}
						settings.aiAdapterSettings.ollamaSettings.token = value;
						OllamaProvider.refreshInstance();
						await saveSettings(plugin);
					}),
			);
	}

	async queryHandling(prompt: string): Promise<string> {
		const response: ChatResponse = await ollama.chat({
			model: settings.aiAdapterSettings.selectedModel.model, //llava:13b or llava or llava-llama3
			messages: [{ role: "user", content: prompt }],
		});
		return response.message.content;
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		const response: ChatResponse = await ollama.chat({
			model: settings.aiAdapterSettings.selectedImageModel.model, //llava:13b or llava or llava-llama3
			messages: [{ role: "user", content: prompt, images: [image] }],
		});
		return response.message.content;
	}

	private async checkOllama(): Promise<boolean> {
		try {
			const models = await ollama.list();
			debugLog(context, models);
			let updated = false;
			for (const model of models.models) {
				const capabilities = (await ollama.show({ model: model.name }))
					.capabilities;
				const isImageModel = capabilities.includes("vision");
				const isTextModel = capabilities.includes("completion");
				const name =
					model.name.split(":")[0] +
					" [" +
					model.details.parameter_size +
					"]" +
					" (custom)";

				if (
					isTextModel &&
					!possibleModels.some(
						(m) => m.model === model.name && !m.imageReady,
					)
				) {
					possibleModels.push({
						name,
						model: model.name,
						provider: "ollama",
						imageReady: false,
					});
					debugLog(context, "Added model: " + name);
					updated = true;
				}

				if (
					isImageModel &&
					!possibleModels.some(
						(m) => m.model === model.name && m.imageReady,
					)
				) {
					possibleModels.push({
						name,
						model: model.name,
						provider: "ollama",
						imageReady: true,
					});
					debugLog(context, "Added image model: " + name);
					updated = true;
				}
			}

			if (updated) {
				debugLog(context, "Models updated, notifying settings tab");
				notifyModelsChange();
			}

			if (
				!models.models.some(
					(model) =>
						model.name ===
						settings.aiAdapterSettings.selectedModel.model,
				)
			) {
				debugLog(context, "No text model found (currently not used)");
				// Add Notice when it gets used
			}
			if (
				!models.models.some(
					(model) =>
						model.name ===
						settings.aiAdapterSettings.selectedImageModel.model,
				)
			) {
				new Notice(
					`No ${settings.aiAdapterSettings.selectedImageModel.name} model found, please make sure you have pulled it (you can pull it over the settings tab or choose another model)`,
				);
			}
			return true;
		} catch (e) {
			debugLog(context, e);
			if (
				!OllamaProvider.fallback &&
				settings.aiAdapterSettings.ollamaSettings.fallbackUrl?.length >
					0
			) {
				OllamaProvider.fallback = true;
				debugLog(context, "Falling back to fallback URL");
				OllamaProvider.refreshInstance();
				return await this.checkOllama();
			}
			new Notice("Error connecting to ollama.");
			new Notice(e.toString());
			return false;
		}
	}

	static async pullImage(model: Models) {
		let progressNotice: Notice | undefined;
		try {
			new Notice(
				`Pulling ${model.name} model started, this may take a while...`,
			);
			const response = await ollama.pull({
				model: model.model,
				stream: true,
			});
			progressNotice = new Notice(`Pulling ${model.name} model 0%`, 0);
			for await (const part of response) {
				debugLog(context, part);
				if (part.total !== null && part.completed !== null) {
					const percentage = (part.completed / part.total) * 100;
					if (
						!isNaN(percentage) &&
						percentage !== Infinity &&
						percentage !== -Infinity
					) {
						const roundedNumber = percentage.toFixed(2);
						const completed = (part.completed / 1000000000).toFixed(
							2,
						);
						const total = (part.total / 1000000000).toFixed(2);
						progressNotice.setMessage(
							`Pulling ${model.name} model ${roundedNumber}% (${completed}GB/${total}GB)`,
						);
					}
				}
			}
			progressNotice.hide();
			new Notice(`${model.name} model pulled successfully`);
		} catch (e) {
			debugLog(context, e);
			progressNotice?.hide();
			new Notice(`Failed to pull ${model.name} model`);
			new Notice(e.toString());
		}
	}

	static refreshInstance() {
		debugLog(
			context,
			"Refreshing Ollama instance (fallback: " +
				OllamaProvider.fallback +
				")",
		);

		if (ollama !== undefined) {
			ollama.abort();
		}
		OllamaProvider.abortCurrentOllamaRequest();
		ollama = new Ollama({
			host: !this.fallback
				? settings.aiAdapterSettings.ollamaSettings.url
				: settings.aiAdapterSettings.ollamaSettings.fallbackUrl,
			headers: {
				Authorization: `Bearer ${settings.aiAdapterSettings.ollamaSettings.token}`,
			},
			fetch: OllamaProvider.ollamaFetch,
		});
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		settings.aiAdapterSettings.ollamaSettings.lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		settings.aiAdapterSettings.ollamaSettings.lastImageModel = model;
	}

	shutdown(): void {
		debugLog(context, "Shutting down Ollama instance");
		OllamaProvider.abortCurrentOllamaRequest();
		if (ollama !== undefined) {
			ollama.abort();
		}
	}

	static ollamaFetch(input: never, init?: RequestInit): Promise<Response> {
		const controller = new AbortController();

		// If caller provided a signal, forward its abort to our controller so both work
		if (init?.signal) {
			const callerSignal = init.signal;
			if (callerSignal.aborted) {
				controller.abort();
			} else {
				const onAbort = () => controller.abort();
				callerSignal.addEventListener("abort", onAbort, { once: true });
			}
		}

		OllamaProvider.currentOllamaController = controller;
		const newInit: RequestInit = {
			...(init || {}),
			signal: controller.signal,
		};

		const promise = fetch(input, newInit);

		// Clear stored controller when this request settles (if it's still the same)
		promise
			.finally(() => {
				if (OllamaProvider.currentOllamaController === controller)
					OllamaProvider.currentOllamaController = undefined;
			})
			.catch(() => {
				/* swallow; caller will observe abort/error */
			});

		return promise;
	}

	static abortCurrentOllamaRequest(): void {
		if (OllamaProvider.currentOllamaController) {
			try {
				OllamaProvider.currentOllamaController.abort();
			} catch {
				// ignore
			} finally {
				OllamaProvider.currentOllamaController = undefined;
			}
		}
	}
}
