import {TFile} from "obsidian";
import {settings} from "./settings";

export function debugLog(message: object | string) {
	if (settings.debug) {
		console.log(message);
	}
}

export function isImageFile(file: TFile): boolean {
	const path = file.path;

	return (
		path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') ||
		path.endsWith('.webp')
	)
}
