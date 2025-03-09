import { createHash } from "crypto";
import { TFile } from "obsidian";
import { libVersion } from "./globals";
import { AnalyzedText } from "./types";

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
	const path = getCachePath(file);

	if (!(await this.app.vault.adapter.exists(getCacheBasePath()))) {
		await this.app.vault.adapter.mkdir(getCacheBasePath());
	}

	const data: AnalyzedText = {
		path: file.path,
		text,
		libVersion: libVersion,
	};
	await this.app.vault.adapter.write(path, JSON.stringify(data));
}

export async function readCache(file: TFile): Promise<AnalyzedText | null> {
	const path = getCachePath(file);
	try {
		if (await this.app.vault.adapter.exists(path)) {
			const raw = await this.app.vault.adapter.read(path);
			return JSON.parse(raw) as AnalyzedText;
		}
	} catch (e) {
		console.error(e);
	}

	return null;
}

export async function removeFromCache(file: TFile): Promise<void> {
	const path = getCachePath(file);
	if (await isInCache(file)) {
		return await this.app.vault.adapter.remove(path);
	}
}

export async function clearCache(): Promise<void> {
	const path = getCacheBasePath();
	if (await this.app.vault.adapter.exists(path)) {
		return await this.app.vault.adapter.rmdir(path, true);
	}
}
