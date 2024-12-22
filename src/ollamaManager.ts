import {arrayBufferToBase64, Notice, TFile} from "obsidian";
import {isInCache, readCache, removeFromCache, writeCache} from "./cache";
import {ChatResponse, Ollama} from "ollama";
import {debugLog, isImageFile} from "./util";
import {settings} from "./settings";
import {imagesProcessQueue} from "./globals";

let ollama: Ollama;

export async function analyzeImage(file: TFile): Promise<string> {
	try {
		return await imagesProcessQueue.add(() => analyzeImageHandling(file)) ?? ''
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
		// @ts-ignore
		const data: string = arrayBufferToBase64(await app.vault.readBinary(file)); //must be global app ref to be used externally

		const response: ChatResponse = await ollama.chat({
			model: settings.ollamaModel.model, //llava:13b or llava or llava-llama3
			messages: [{role: 'user', content: settings.prompt, images: [data]}],
		});

		debugLog(response);

		await writeCache(file, response.message.content);

		debugLog(`Image analyzed ${file.name}`);

		return Promise.resolve(response.message.content);
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
		new Notice('Image analyzed');
		return text;
	} catch (e) {
		debugLog(e);
		new Notice('Failed to analyze image');
		return '';
	}
}

export async function analyzeToClipboard(file: TFile) {
	try {
		const text = await analyzeImageWithNotice(file);
		await activeWindow.navigator.clipboard.writeText(text);
		new Notice('Text copied to clipboard');
	} catch (e) {
		debugLog(e);
	}
}

export async function pullImage() {
	try {
		new Notice(`Pulling ${settings.ollamaModel.name} model started, this may take a while...`);
		const response = await ollama.pull({model: settings.ollamaModel.model, stream: true});
		const progressNotice = new Notice(`Pulling ${settings.ollamaModel.name} model 0%`, 0);
		for await (const part of response) {
			debugLog(part);
			if (part.total !== null && part.completed !== null) {
				const percentage = (part.completed / part.total) * 100;
				if (!isNaN(percentage) && percentage !== Infinity && percentage !== -Infinity) {
					const roundedNumber = percentage.toFixed(2);
					const completed = (part.completed / 1000000000).toFixed(2);
					const total = (part.total / 1000000000).toFixed(2);
					progressNotice.setMessage(`Pulling ${settings.ollamaModel.name} model ${roundedNumber}% (${completed}GB/${total}GB)`);
				}
			}
		}
		progressNotice.hide();
		new Notice(`${settings.ollamaModel.name} model pulled successfully`);
	} catch (e) {
		debugLog(e);
		new Notice('Failed to pull ${model.name} model');
	}
}

export async function checkOllama() {
	try {
		const models = await ollama.list();
		debugLog(models);
		if (!models.models.some(model => model.name === settings.ollamaModel.model)) {
			new Notice(`No ${settings.ollamaModel.name} model found, please make sure you have pulled it (you can pull it over the settings tab or choose another model)`);
		}
	} catch (e) {
		debugLog(e);
		new Notice('Failed to connect to Ollama.');
	}
}

export function setOllama(ollamaInstance: Ollama) {
	ollama = ollamaInstance;
}
