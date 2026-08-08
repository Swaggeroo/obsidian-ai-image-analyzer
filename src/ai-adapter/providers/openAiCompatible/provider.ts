import { Provider } from "../../provider";
import { debugLog } from "../../../util";
import { Models } from "../../types";
import { notifyModelsChange, possibleModels } from "../../globals";
import AIImageAnalyzerPlugin from "../../../main";
import { settings } from "../../../settings";
import { extractErrorMessage } from "../../../errorUtil";
import {
	authHeaders,
	ChatMessage,
	chatCompletionBody,
	CONNECTION_TIMEOUT_MS,
	contentFromApi,
	imageMessage,
	MAX_ERROR_BODY,
	modelsFromApi,
	PLACEHOLDER_MODEL,
	REQUEST_TIMEOUT_MS,
	resolveSelection,
	textMessage,
} from "./api";
import {
	generateOpenAiCompatibleSettings,
	getOpenAiCompatibleSettings,
} from "./settings";

const context = "ai-adapter/providers/openAiCompatible/provider";

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
		generateOpenAiCompatibleSettings(containerEl, plugin, () =>
			this.checkConnection(),
		);
	}

	async queryHandling(prompt: string): Promise<string> {
		return this.chatCompletion(
			[textMessage(prompt)],
			settings.aiAdapterSettings.selectedModel.model,
		);
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		return this.chatCompletion(
			[imageMessage(prompt, image)],
			settings.aiAdapterSettings.selectedImageModel.model,
		);
	}

	private async chatCompletion(
		messages: ChatMessage[],
		model: string,
	): Promise<string> {
		const openAiCompatibleSettings = getOpenAiCompatibleSettings();
		const url = `${openAiCompatibleSettings.url}/v1/chat/completions`;

		if (!model) {
			throw new Error(
				"No model selected. Open the settings, test the connection and pick a model.",
			);
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
				headers: authHeaders(openAiCompatibleSettings.token, {
					"Content-Type": "application/json",
				}),
				body: chatCompletionBody(
					model,
					messages,
					openAiCompatibleSettings.temperature,
				),
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

			return contentFromApi(await response.json());
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

		// the plugin awaits this on load, an unresponsive server must not hold
		// the whole startup
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			CONNECTION_TIMEOUT_MS,
		);

		try {
			const response = await fetch(url, {
				headers: authHeaders(openAiCompatibleSettings.token),
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

			const models = modelsFromApi(await response.json());
			this.replaceModels(models);

			debugLog(context, `Connected, ${models.length} models available`);
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
			const imageModel = resolveSelection(
				available,
				settings.aiAdapterSettings.selectedImageModel,
			);
			settings.aiAdapterSettings.selectedImageModel = imageModel;
			this.setLastImageModel(imageModel);

			const textModel = resolveSelection(
				available,
				settings.aiAdapterSettings.selectedModel,
			);
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
