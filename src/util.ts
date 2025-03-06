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

export function convertToSnakeCase(text: string): string {
    // Extract keywords/tags from the analysis text
    // Look for comma-separated words, or words separated by spaces
    const words = text.split(/[,\s]+/).filter(word => word.trim().length > 0);
    
    // Clean up each word (remove punctuation, lowercase)
    const cleanWords = words.map(word => 
        word.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .trim()
    ).filter(word => word.length > 0);
    
    // Join with underscores to create snake_case
    return cleanWords.join('_');
}
