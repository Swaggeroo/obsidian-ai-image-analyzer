import { Notice, TFile } from "obsidian";
import { isInCache, readCache, writeCache } from "./cache";
import { Ollama } from "ollama";
import { debugLog, isImageFile, readFile } from "./util";
import { settings } from "./settings";
import { imagesProcessQueue } from "./globals";
import { analyzeImageWithGemini } from "./geminiManager";

let ollama: Ollama;

export async function analyzeImage(file: TFile): Promise<string> {
	try {
		return (
			(await imagesProcessQueue.add(() => analyzeImageHandling(file))) ??
			""
		);
	} catch (e) {
		debugLog(e);
		return "";
	}
}

async function analyzeImageHandling(file: TFile): Promise<string> {
	debugLog(`Analyzing image ${file.name}`);
	if (!isImageFile(file)) {
		return "";
	}

	//check if the image is in the cache
	if (await isInCache(file)) {
		debugLog(`Image ${file.name} found in cache`);
		const cachedText = await readCache(file);
		if (cachedText) {
			return cachedText.text;
		}
	}

	try {
		debugLog(`Sending request to Ollama: ${file.name}`);

		//@ts-ignore
		const binaryData = await readFile(file);

		// Format images array for Ollama according to its API requirements
		// @ts-ignore - Ignoring type issues with Ollama API
		const chat = await ollama.chat({
			model: settings.ollamaModel.model,
			messages: [
				{
					role: "user",
					content: settings.prompt,
					images: [binaryData],
				},
			],
		});

		const text = chat.message?.content || "";
		debugLog(`Response from Ollama: ${file.name}`);
		debugLog(text);

		await writeCache(file, text);

		return text;
	} catch (e) {
		debugLog(`Error analyzing image: ${e}`);
		new Notice(`Error analyzing image: ${e}`);
		return "";
	}
}

export async function analyzeImageWithNotice(file: TFile): Promise<string> {
	new Notice(`Analyzing ${file.name}...`);

	const text = await analyzeImage(file);
	if (text) {
		new Notice(`Analysis of ${file.name}: ${text}`);
	} else {
		new Notice(`Could not analyze ${file.name}`);
	}

	return text;
}

export async function analyzeToClipboard(file: TFile) {
	try {
		// Use the appropriate analysis function based on the active provider
		const text =
			settings.activeProvider === "ollama"
				? await analyzeImageWithNotice(file)
				: await analyzeImageWithGemini(file);

		// @ts-ignore
		await navigator.clipboard.writeText(text);
		new Notice("Text copied to clipboard");
	} catch (e) {
		debugLog(e);
		new Notice(`Error copying to clipboard: ${e}`);
	}
}

export async function pullImage() {
	try {
		if (!settings.ollamaModel) {
			return;
		}

		new Notice(
			`Pulling model ${settings.ollamaModel.name} (${settings.ollamaModel.model})`,
		);
		await ollama.pull({
			model: settings.ollamaModel.model,
			stream: false,
		});
		new Notice(
			`Model ${settings.ollamaModel.name} (${settings.ollamaModel.model}) pulled successfully`,
		);
	} catch (e) {
		debugLog(e);
		new Notice(`Error pulling model: ${e}`);
	}
}

export async function checkOllama() {
	try {
		debugLog("Checking Ollama connection");
		const models = await ollama.list();
		debugLog(models);
		if (
			!models.models.some(
				(model) => model.name === settings.ollamaModel.model,
			)
		) {
			new Notice(
				`No ${settings.ollamaModel.name} model found, please make sure you have pulled it (you can pull it over the settings tab or choose another model)`,
			);
		}
	} catch (e) {
		debugLog(e);
		new Notice(`Could not connect to Ollama: ${e}`);
	}
}

export function setOllama(ollamaInstance: Ollama) {
	ollama = ollamaInstance;
}
