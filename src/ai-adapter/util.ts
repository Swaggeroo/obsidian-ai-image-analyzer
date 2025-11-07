import { settings } from "../settings";
import { Provider } from "./provider";
import { OllamaProvider } from "./providers/ollamaProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { provider } from "./globals";
import { Notice } from "obsidian";
// import {ExampleProvider} from "./exampleProvider"; [NEW PROVIDER]

export function debugLog(message: object | string) {
	if (settings.debug) {
		console.debug(message);
	}
}

export function initProvider(): Provider {
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
		debugLog("Provider not initialized");
		new Notice("Provider not initialized");
		throw new Error("Provider not initialized");
	}
}
