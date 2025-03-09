import {Notice, TFile} from "obsidian";
import {isInCache, readCache, removeFromCache, writeCache} from "./cache";
import {debugLog, isImageFile, readFile} from "./util";
import {settings} from "./settings";
import {imagesProcessQueue} from "./globals";
import {getAIAdapter} from "./main";

export async function analyzeImage(file: TFile): Promise<string> {
	try {
		return await imagesProcessQueue.add(() => analyzeImageHandling(file)) ?? '';
	}catch (e) {
		debugLog(e);
		return '';
	}
}

async function analyzeImageHandling(file: TFile): Promise<string> {
	debugLog(`Analyzing image ${file.name}`);
	if (!isImageFile(file)) {
		return Promise.reject('File is not an image');
	}

	if (await isInCache(file)) {
		debugLog('Cache hit');
		const text = await readCache(file);
		if (text && text.text !== '') {
			debugLog('Reading from cache');
			debugLog(`Image analyzed ${file.name}`);
			return Promise.resolve(text.text);
		} else {
			debugLog('Failed to read cache');
			debugLog('Removing from cache');
			await removeFromCache(file);
		}
	}

	debugLog(file);

	try {
		const data: string = await readFile(file);

		const response = await getAIAdapter()?.queryWithImage(settings.prompt, data);
		debugLog(response ?? 'No response');

		if (!response){
			return Promise.reject('Failed to analyze image');
		}

		await writeCache(file, response);

		debugLog(`Image analyzed ${file.name}`);

		return Promise.resolve(response);
	} catch (e) {
		debugLog(e);
		return Promise.reject('Failed to analyze image');
	}
}

export async function analyzeImageWithNotice(file: TFile): Promise<string> {
	try {
		const notice = new Notice('Analyzing image', 0);
		const text = await analyzeImage(file);
		notice.hide();
		if (text == ''){
			new Notice('Failed to analyze image');
			return '';
		}
		new Notice('Image analyzed');
		return text;
	} catch (e) {
		debugLog(e);
		new Notice('Failed to analyze image');
		new Notice(e.toString());
		return '';
	}
}

export async function analyzeToClipboard(file: TFile) {
	try {
		const text = await analyzeImageWithNotice(file);
		if (text == ''){
			return;
		}
		await activeWindow.navigator.clipboard.writeText(text);
		new Notice('Text copied to clipboard');
	} catch (e) {
		debugLog(e);
	}
}
