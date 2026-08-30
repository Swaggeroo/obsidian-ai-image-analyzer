import { Notice, TFile } from "obsidian";
import { isInCache, readCache, writeCache } from "./cache";
import { debugLog, isImageFile, readFile } from "./util";
import { settings } from "./settings";
import { imagesProcessQueue, runWithTimeout } from "./globals";
import { queryWithImage, abortCurrentRequest } from "./ai-adapter/api";
import { provider } from "./ai-adapter/globals";
import { OllamaProvider } from "./ai-adapter/providers/ollamaProvider";
import { extractErrorMessage } from "./errorUtil";

const context = "analyserManager";

const retriedImages = new Set<string>();
const ANALYZE_TIMEOUT_MS = 120000;

export async function analyzeImage(file: TFile): Promise<string> {
	try {
		return (
			(await imagesProcessQueue.add(() => analyzeImageTask(file))) ?? ""
		);
	} catch (e) {
		const errMsg = extractErrorMessage(e);
		debugLog(context, errMsg);
		return "";
	}
}

async function analyzeImageTask(file: TFile): Promise<string> {
	const key = file.path;
	try {
		return await runWithTimeout(
			analyzeImageHandling(file),
			ANALYZE_TIMEOUT_MS,
		);
	} catch (e) {
		const errMsg = extractErrorMessage(e);
		debugLog(context, `analyzeImageHandling failed for ${key}:`);
		debugLog(context, errMsg);
		if (!retriedImages.has(key)) {
			retriedImages.add(key);
			if (provider instanceof OllamaProvider) {
				OllamaProvider.refreshInstance();
			}
			abortCurrentRequest();
			debugLog(context, `Retrying image once: ${key}`);
			try {
				return await runWithTimeout(
					analyzeImageHandling(file),
					ANALYZE_TIMEOUT_MS,
				);
			} catch (e2) {
				const errMsg2 = extractErrorMessage(e2);
				debugLog(context, `Retry also failed for ${key}:`);
				debugLog(context, errMsg2);
				throw e2;
			}
		}
		throw e;
	}
}

async function analyzeImageHandling(file: TFile): Promise<string> {
	debugLog(context, `Analyzing image ${file.name}`);
	if (!isImageFile(file)) {
		throw new Error("File is not an image");
	}

	if (await isInCache(file)) {
		debugLog(context, "Cache hit");
		const text = await readCache(file);
		if (text && text.text !== "") {
			debugLog(context, "Reading from cache");
			debugLog(context, `Image analyzed ${file.name}`);
			return text.text;
		} else {
			debugLog(context, "Failed to read cache");
		}
	}

	try {
		const data: string = await readFile(file);

		const response = await queryWithImage(settings.prompt, data);
		debugLog(context, "Response: " + (response ?? "null"));

		await writeCache(file, response);

		debugLog(context, `Image analyzed ${file.name}`);

		return response;
	} catch (e) {
		const errMsg = extractErrorMessage(e);
		debugLog(context, errMsg);
		throw e instanceof Error ? e : new Error(String(e));
	}
}

export async function analyzeImageWithNotice(file: TFile): Promise<string> {
	try {
		const notice = new Notice("Analyzing image", 0);
		const text = await analyzeImage(file);
		notice.hide();
		if (text == "") {
			new Notice("Failed to analyze image");
			return "";
		}
		new Notice("Image analyzed");
		return text;
	} catch (e) {
		const errMsg = extractErrorMessage(e);
		debugLog(context, errMsg);
		new Notice("Failed to analyze image");
		new Notice(errMsg);
		return "";
	}
}

export async function analyzeToClipboard(file: TFile) {
	try {
		const text = await analyzeImageWithNotice(file);
		if (text == "") {
			return;
		}
		await activeWindow.navigator.clipboard.writeText(text);
		new Notice("Text copied to clipboard");
	} catch (e) {
		const errMsg = extractErrorMessage(e);
		debugLog(context, errMsg);
	}
}
