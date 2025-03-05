import { arrayBufferToBase64, TFile } from "obsidian";
import { settings } from "./settings";


export function debugLog(message: object | string) {
	if (settings.debug) {
		console.log(message);
	}
}

export function getTempBasePath(): string {
	// @ts-ignore
	return `${app.vault.configDir}/plugins/ai-image-analyzer/tmp`; //must be global app ref to be used externally
}

export function getTempPath(file: TFile): string {
	const folder = `${getTempBasePath()}`;
	const filename = `${file.path.replace(/\//g, "_")}`;
	return `${folder}/${filename}`;
}

export function isImageFile(file: TFile): boolean {
	const path = file.path;

	return (
		path.endsWith(".png") ||
		path.endsWith(".jpg") ||
		path.endsWith(".jpeg") ||
		path.endsWith(".webp")
	);
}

export async function readFile(file: TFile): Promise<string> {
    // Use a single approach for all image types
    return arrayBufferToBase64(await this.app.vault.readBinary(file));
}
