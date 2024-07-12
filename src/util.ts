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

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}
