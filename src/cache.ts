import { md5 } from 'pure-md5';
import {TFile} from "obsidian";
import { libVersion } from "./globals";
import {AnalyzedText} from "./types";

export function getCacheBasePath(): string {
	return `${this.app.vault.configDir}/plugins/obsidian-ai-image-analyzer/cache`
}

function getCachePath(file: TFile): string {
	const hash = md5(file.path)

	const folder = `${getCacheBasePath()}`
	const filename = `${hash}.json`
	return `${folder}/${filename}`;
}

export function isInCache(file: TFile): boolean {
	const path = getCachePath(file);
	return this.app.vault.adapter.exists(path);
}

export async function writeCache(file: TFile, text: string): Promise<void> {
	const path = getCachePath(file);

	if (!await this.app.vault.adapter.exists(getCacheBasePath())) {
		await this.app.vault.adapter.mkdir(getCacheBasePath());
	}

	const data: AnalyzedText = {
		path: file.path,
		text,
		libVersion: libVersion,
	}
	await this.app.vault.adapter.write(path, JSON.stringify(data));
}

export async function readCache(file: TFile): Promise<AnalyzedText | null> {
	const path = getCachePath(file);
	try {
		if (await this.app.vault.adapter.exists(path)) {
			const raw = await this.app.vault.adapter.read(path);
			return JSON.parse(raw) as AnalyzedText;
		}
	}catch (e) {
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
