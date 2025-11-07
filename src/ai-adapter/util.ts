import { settings } from "../settings";
import { Provider } from "./provider";
import { OllamaProvider } from "./providers/ollamaProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { provider } from "./globals";
import { Notice } from "obsidian";
import { debugLog } from "../util";
// import {ExampleProvider} from "./exampleProvider"; [NEW PROVIDER]

const context = "ai-adapter/util";

export function initProvider(): Provider {
	debugLog(
		context,
		"Initializing provider: " + settings.aiAdapterSettings.provider,
	);
	switch (settings.aiAdapterSettings.provider) {
		case "ollama": {
			return new OllamaProvider();
		}
		case "gemini": {
			return new GeminiProvider();
		}
		// case "testing": { [NEW PROVIDER]
		// 	return new ExampleProvider();
		// }
	}
}

export function checkProviderReady() {
	if (!provider) {
		debugLog(context, "Provider not initialized");
		new Notice("Provider not initialized");
		throw new Error("Provider not initialized");
	}
}
