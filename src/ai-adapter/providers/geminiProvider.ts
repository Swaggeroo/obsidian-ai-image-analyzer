import AIImageAnalyzerPlugin from "../../main";
import { Notice, Setting } from "obsidian";
import { Provider } from "../provider";
import { Models } from "../types";
import { notifyModelsChange, possibleModels } from "../globals";
import { saveSettings, settings } from "../../settings";
import { GoogleGenAI } from "@google/genai";
import { debugLog } from "../../util";

const context = "ai-adapter/providers/geminiProvider";

let gemini: GoogleGenAI;

export type GeminiSettings = {
	lastModel: Models;
	lastImageModel: Models;
	apiKey: string;
};

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
	lastModel: possibleModels[13],
	lastImageModel: possibleModels[12],
	apiKey: "",
};

export class GeminiProvider extends Provider {
	constructor() {
		super();
		this.lastModel = settings.aiAdapterSettings.geminiSettings.lastModel;
		this.lastImageModel =
			settings.aiAdapterSettings.geminiSettings.lastImageModel;
		GeminiProvider.restartSession();
		this.checkGemini().then((success) => {
			debugLog(context, "Gemini check success: " + success);
		});
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		new Setting(containerEl).setName("Gemini").setHeading();

		new Setting(containerEl)
			.setName("Gemini API key")
			.setDesc("Set your gemini API token")
			.addText((text) =>
				text
					.setValue(
						settings.aiAdapterSettings.geminiSettings.apiKey !== ""
							? "••••••••••"
							: "",
					)
					.onChange(async (value) => {
						if (value.contains("•")) {
							return;
						}
						settings.aiAdapterSettings.geminiSettings.apiKey =
							value;
						GeminiProvider.restartSession();
						this.checkGemini().then((success) => {
							debugLog(
								context,
								"Gemini check success: " + success,
							);
						});
						await saveSettings(plugin);
					}),
			);
	}

	async queryHandling(prompt: string): Promise<string> {
		const response = await gemini.models.generateContent({
			model: settings.aiAdapterSettings.selectedModel.model,
			contents: [
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			],
		});

		if (response.text === undefined) {
			return "[AI-ERROR] No response from Gemini API";
		}

		return response.text;
	}

	async queryWithImageHandling(
		prompt: string,
		image: string,
	): Promise<string> {
		const response = await gemini.models.generateContent({
			model: settings.aiAdapterSettings.selectedImageModel.model,
			contents: [
				{
					role: "user",
					parts: [
						{ text: prompt },
						{ inlineData: { mimeType: "image/png", data: image } },
					],
				},
			],
		});

		if (response.text === undefined) {
			return "[AI-ERROR] No response from Gemini API";
		}

		return response.text;
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		settings.aiAdapterSettings.geminiSettings.lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		settings.aiAdapterSettings.geminiSettings.lastImageModel = model;
	}

	static restartSession() {
		gemini = new GoogleGenAI({
			apiKey: settings.aiAdapterSettings.geminiSettings.apiKey,
		});
	}

	private async checkGemini() {
		try {
			let updated = false;

			for await (const model of await gemini.models.list()) {
				if (model.supportedActions?.includes("generateContent")) {
					const modelName = model.displayName ?? "unknown";
					const modelId = model.name ?? "unknown";

					const geminiModel: Models = {
						name: modelName,
						model: modelId,
						imageReady: true,
						provider: "gemini",
					};

					if (
						!possibleModels.some(
							(m) =>
								m.model === geminiModel.model && m.imageReady,
						)
					) {
						possibleModels.push(geminiModel);
						debugLog(context, "Added model: " + geminiModel.name);
						updated = true;
					}

					const geminiTextModel: Models = {
						name: modelName,
						model: modelId,
						imageReady: false,
						provider: "gemini",
					};

					if (
						!possibleModels.some(
							(m) =>
								m.model === geminiModel.model && !m.imageReady,
						)
					) {
						possibleModels.push(geminiTextModel);
						debugLog(
							context,
							"Added model: " + geminiTextModel.name,
						);
						updated = true;
					}
				}
			}

			if (updated) {
				debugLog(context, "Models updated, notifying settings tab");
				notifyModelsChange();
			}
			return true;
		} catch (e) {
			debugLog(context, e);
			new Notice(
				"Error connecting to gemini API. Please check your gemini API key.",
			);
			new Notice(e.toString());
			return false;
		}
	}
}
