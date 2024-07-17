import {arrayBufferToBase64, Notice, TFile} from "obsidian";
import {isInCache, readCache, removeFromCache, writeCache} from "./cache";
import {ChatResponse, Ollama} from "ollama";
import {debugLog, isImageFile} from "./util";

const promt = 'Describe the image. Just use Keywords. For example: cat, dog, tree. This must be Computer readable. The provided pictures are used in an notebook. Please provide at least 5 Keywords. It will be used to search for the image later.';
let ollama: Ollama;

export async function analyzeImage(file: TFile): Promise<string> {
	if (!isImageFile(file)) {
		return Promise.reject('File is not an image');
	}

	if (await isInCache(file)) {
		const text = await readCache(file);
		if (text) {
			debugLog('Reading from cache');
			return Promise.resolve(text.text);
		} else {
			debugLog('Failed to read cache');
			debugLog('Removing from cache');
			await removeFromCache(file);
		}
	}

	debugLog(file);

	try {
		const data: string = arrayBufferToBase64(await this.app.vault.readBinary(file));

		const response: ChatResponse = await ollama.chat({
			model: 'llava', //llava:13b or llava or llava-llama3
			messages: [{role: 'user', content: promt, images: [data]}],
		});

		debugLog(response);

		await writeCache(file, response.message.content);

		return Promise.resolve(response.message.content);
	} catch (e) {
		debugLog(e);
		return Promise.reject('Failed to analyze image');
	}
}

export async function analyzeImageWithNotice(file: TFile): Promise<string> {
	try {
		new Notice('Analyzing image');
		const text = await analyzeImage(file);
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
		new Notice('Pulling llava model started, this may take a while...');
		const response = await ollama.pull({model: 'llava', stream: true});
		const progressNotice = new Notice('Pulling llava model 0%', 0);
		for await (const part of response) {
			debugLog(part);
			if (part.total !== null && part.completed !== null) {
				const percentage = (part.completed / part.total) * 100;
				if (!isNaN(percentage) && percentage !== Infinity && percentage !== -Infinity) {
					const roundedNumber = percentage.toFixed(2);
					const completed = (part.completed / 1000000000).toFixed(2);
					const total = (part.total / 1000000000).toFixed(2);
					progressNotice.setMessage(`Pulling llava model ${roundedNumber}% (${completed}GB/${total}GB)`);
				}
			}
		}
		progressNotice.hide();
		new Notice('llava model pulled successfully');
	} catch (e) {
		debugLog(e);
		new Notice('Failed to pull llava model');
	}
}

export async function checkOllama() {
	try {
		const models = await ollama.list();
		debugLog(models);
		if (!models.models.some(model => model.name === 'llava:latest')) {
			new Notice('No llava model found, please make sure you have pulled llava (you can pull llava over the settings tab)');
		}
	} catch (e) {
		debugLog(e);
		new Notice('Failed to connect to Ollama.');
	}
}

export function setOllama(ollamaInstance: Ollama) {
	ollama = ollamaInstance;
}
