import { Notice, TFile } from "obsidian";
import { isInCache, readCache, writeCache } from "./cache";
import { debugLog, isImageFile, readFile } from "./util";
import { settings } from "./settings";
import { imagesProcessQueue, runWithTimeout } from "./globals";
import { queryWithImage } from "./ai-adapter/api";

const retriedImages = new Set<string>();
const ANALYZE_TIMEOUT_MS = 120000;

export async function analyzeImage(file: TFile): Promise<string> {
	try {
		return (
			(await imagesProcessQueue.add(() => analyzeImageTask(file))) ?? ""
		);
	} catch (e) {
		debugLog(e);
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
	} catch (err) {
		debugLog(`analyzeImageHandling failed for ${key}:`);
		debugLog(err);
		if (!retriedImages.has(key)) {
			retriedImages.add(key);
			debugLog(`Retrying image once: ${key}`);
			try {
				return await runWithTimeout(
					analyzeImageHandling(file),
					ANALYZE_TIMEOUT_MS,
				);
			} catch (err2) {
				debugLog(`Retry also failed for ${key}:`);
				debugLog(err2);
				throw err2;
			}
		}
		throw err;
	}
}

async function analyzeImageHandling(file: TFile): Promise<string> {
	debugLog(`Analyzing image ${file.name}`);
	if (!isImageFile(file)) {
		return Promise.reject("File is not an image");
	}

	if (await isInCache(file)) {
		debugLog("Cache hit");
		const text = await readCache(file);
		if (text && text.text !== "") {
			debugLog("Reading from cache");
			debugLog(`Image analyzed ${file.name}`);
			return Promise.resolve(text.text);
		} else {
			debugLog("Failed to read cache");
		}
	}

	debugLog(file);

	try {
		const data: string = await readFile(file);

		const response = await queryWithImage(settings.prompt, data);
		debugLog(response ?? "No response");

		if (!response) {
			return Promise.reject("Failed to analyze image");
		}

		await writeCache(file, response);

		debugLog(`Image analyzed ${file.name}`);

		return Promise.resolve(response);
	} catch (e) {
		debugLog(e);
		return Promise.reject("Failed to analyze image");
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
		debugLog(e);
		new Notice("Failed to analyze image");
		new Notice(e.toString());
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
		debugLog(e);
	}
}
