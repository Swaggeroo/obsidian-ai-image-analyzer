import { createHash } from "crypto";
import { TFile } from "obsidian";
import { libVersion } from "./globals";
import { AnalyzedText } from "./types";
import { debugLog } from "./util";

const context = "cache";

export function getCacheBasePath(): string {
	// @ts-ignore
	return `${app.vault.configDir}/plugins/ai-image-analyzer/cache`; //must be global app ref to be used externally
}

function getCachePath(file: TFile): string {
	const hash = createHash("md5").update(file.path).digest("hex");

	const folder = `${getCacheBasePath()}`;
	const filename = `${hash}.json`;
	return `${folder}/${filename}`;
}

export async function isInCache(file: TFile): Promise<boolean> {
	const path = getCachePath(file);
	// @ts-ignore
	return await app.vault.adapter.exists(path); //must be global app ref to be used externally
}

export async function writeCache(file: TFile, text: string): Promise<void> {
	if (text.length === 0) {
		return;
	}

	const path = getCachePath(file);

	if (!(await this.app.vault.adapter.exists(getCacheBasePath()))) {
		await this.app.vault.adapter.mkdir(getCacheBasePath());
	}

	const data: AnalyzedText = {
		path: file.path,
		text,
		libVersion: libVersion,
	};

	debugLog(context, `Writing cache entry for ${file.path}`);
	await this.app.vault.adapter.write(path, JSON.stringify(data));
}

export async function readCache(file: TFile): Promise<AnalyzedText | null> {
	try {
		if (await isInCache(file)) {
			const path = getCachePath(file);
			const raw = await this.app.vault.adapter.read(path);
			const text = JSON.parse(raw) as AnalyzedText;
			if (text.text.length === 0) {
				debugLog(context, "Cache entry is empty, removing");
				await removeFromCache(file);
				return null;
			}
			debugLog(context, `Read cache entry for ${file.path}`);
			return text;
		}
	} catch (e) {
		console.error(e);
	}

	return null;
}

export async function removeFromCache(file: TFile): Promise<void> {
	const path = getCachePath(file);
	if (await isInCache(file)) {
		debugLog(context, `Removing cache entry for ${file.path}`);
		return await this.app.vault.adapter.remove(path);
	}
}

export async function clearCache(): Promise<void> {
	const path = getCacheBasePath();
	if (await this.app.vault.adapter.exists(path)) {
		debugLog(context, `Clearing cache`);
		return await this.app.vault.adapter.rmdir(path, true);
	}
}
