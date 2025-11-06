import { Setting } from "obsidian";
import { Models, providerNames, Providers } from "./types";
import {
	DEFAULT_OLLAMA_SETTINGS,
	OllamaSettings,
} from "./providers/ollamaProvider";
import {
	possibleModels,
	setProvider,
	provider,
	notifyModelsChange,
} from "./globals";
import { initProvider } from "./util";
import {
	DEFAULT_GEMINI_SETTINGS,
	GeminiSettings,
} from "./providers/geminiProvider";
import AIImageAnalyzerPlugin from "../main";
import { saveSettings, settings } from "../settings";
// import {DEFAULT_EXAMPLE_SETTINGS, ExampleSettings} from "./exampleProvider"; [NEW PROVIDER]

export type AIAdapterPluginSettings = {
	provider: Providers;
	selectedModel: Models;
	selectedImageModel: Models;
	ollamaSettings: OllamaSettings;
	geminiSettings: GeminiSettings;
	// exampleSettings: ExampleSettings; [NEW PROVIDER]
};

export const DEFAULT_SETTINGS: AIAdapterPluginSettings = {
	provider: "ollama",
	selectedModel: possibleModels[8],
	selectedImageModel: possibleModels[0],
	ollamaSettings: DEFAULT_OLLAMA_SETTINGS,
	geminiSettings: DEFAULT_GEMINI_SETTINGS,
	// exampleSettings: DEFAULT_EXAMPLE_SETTINGS [NEW PROVIDER]
};

export function generateSettings(
	containerEl: HTMLElement,
	plugin: AIImageAnalyzerPlugin,
) {
	new Setting(containerEl)
		.setName("Provider")
		.setDesc("Select the provider to use")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions(
					providerNames.reduce(
						(acc, provider) => {
							acc[provider] = provider;
							return acc;
						},
						{} as Record<Providers, string>,
					),
				)
				.setValue(settings.aiAdapterSettings.provider)
				.onChange(async (value: Providers) => {
					settings.aiAdapterSettings.provider = value;
					setProvider(initProvider());

					settings.aiAdapterSettings.selectedModel =
						provider.lastModel ?? possibleModels[0];

					settings.aiAdapterSettings.selectedImageModel =
						provider.lastImageModel ?? possibleModels[0];

					await saveSettings(plugin);
					notifyModelsChange();
				}),
		);

	new Setting(containerEl)
		.setName("Image model")
		.setDesc("Select the image model to use")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions(
					possibleModels
						.filter(
							(model: Models) =>
								model.provider ==
									settings.aiAdapterSettings.provider &&
								model.imageReady,
						)
						.reduce(
							(acc, model) => {
								acc[model.name] = model.name;
								return acc;
							},
							{} as Record<string, string>,
						),
				)
				.setValue(settings.aiAdapterSettings.selectedImageModel.name)
				.onChange(async (value) => {
					settings.aiAdapterSettings.selectedImageModel =
						possibleModels.find((model) => model.name === value)!;
					provider.setLastImageModel(
						settings.aiAdapterSettings.selectedImageModel,
					);
					await saveSettings(plugin);
				}),
		);

	provider.generateSettings(containerEl, plugin);
}
