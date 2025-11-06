import { settings } from "../settings";
import { Provider } from "./provider";
import { OllamaProvider } from "./providers/ollamaProvider";
import { GeminiProvider } from "./providers/geminiProvider";
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
