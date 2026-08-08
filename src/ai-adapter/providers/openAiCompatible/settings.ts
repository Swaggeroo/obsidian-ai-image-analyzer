import { Notice, Setting } from "obsidian";
import { Models } from "../../types";
import AIImageAnalyzerPlugin from "../../../main";
import { saveSettings, settings } from "../../../settings";
import { debugLog } from "../../../util";
import { PLACEHOLDER_MODEL } from "./api";

const context = "ai-adapter/providers/openAiCompatible/settings";

export type OpenAiCompatibleSettings = {
	lastModel: Models;
	lastImageModel: Models;
	url: string;
	token: string;
	temperature: number;
};

export const DEFAULT_OPEN_AI_COMPATIBLE_SETTINGS: OpenAiCompatibleSettings = {
	lastModel: PLACEHOLDER_MODEL,
	lastImageModel: PLACEHOLDER_MODEL,
	url: "http://127.0.0.1:8000",
	token: "",
	temperature: 0.7,
};

// data.json of a user upgrading from an older version has no entry for this
// provider, and the plugin merges saved settings shallowly
export function getOpenAiCompatibleSettings(): OpenAiCompatibleSettings {
	if (!settings.aiAdapterSettings.openAiCompatibleSettings) {
		settings.aiAdapterSettings.openAiCompatibleSettings = {
			...DEFAULT_OPEN_AI_COMPATIBLE_SETTINGS,
		};
	}

	return settings.aiAdapterSettings.openAiCompatibleSettings;
}

export function generateOpenAiCompatibleSettings(
	containerEl: HTMLElement,
	plugin: AIImageAnalyzerPlugin,
	checkConnection: () => Promise<boolean>,
) {
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
					openAiCompatibleSettings.url = value.replace(/\/+$/, "");
					checkConnection().then((success) => {
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
					openAiCompatibleSettings.token !== "" ? "••••••••••" : "",
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
				const success = await checkConnection();
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
