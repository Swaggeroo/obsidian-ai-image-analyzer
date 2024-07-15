import {TFile} from "obsidian";

let debugMode = false;

export function setDebugMode(value: boolean) {
	debugMode = value;
}

export function debugLog(message: object | string) {
	if (debugMode) {
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
