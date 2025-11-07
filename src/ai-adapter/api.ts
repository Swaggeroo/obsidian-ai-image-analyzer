import { provider } from "./globals";
import { checkProviderReady } from "./util";
import { debugLog } from "../util";
import { Notice } from "obsidian";
import { OllamaProvider } from "./providers/ollamaProvider";

const context = "ai-adapter/api";

export async function query(prompt: string): Promise<string> {
	checkProviderReady();

	try {
		const response = await provider.queryHandling(prompt);
		if (response.length === 0) {
			debugLog(context, "Empty response from provider");
			return Promise.reject("Empty response from provider");
		}

		if (response.startsWith("[AI-ERROR]")) {
			new Notice(response.replace("[AI-ERROR]", ""));
			debugLog(context, "AI Error: " + response);
			return Promise.reject(response);
		}
		return response;
	} catch (e) {
		if (provider instanceof OllamaProvider) {
			OllamaProvider.refreshInstance();
		}
		debugLog(context, e);
		return Promise.reject(e);
	}
}

export async function queryWithImage(
	prompt: string,
	image: string,
): Promise<string> {
	checkProviderReady();

	try {
		const response = await provider.queryWithImageHandling(prompt, image);
		if (response.length === 0) {
			debugLog(context, "Empty response from provider");
			return Promise.reject("Empty response from provider");
		}

		return response;
	} catch (e) {
		if (provider instanceof OllamaProvider) {
			OllamaProvider.refreshInstance();
		}
		debugLog(context, e);
		return Promise.reject(e);
	}
}
