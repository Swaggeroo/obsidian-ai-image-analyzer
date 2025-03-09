import { arrayBufferToBase64, TFile } from "obsidian";
import { settings } from "./settings";
import { createCanvas, loadImage } from "canvas";

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
		path.endsWith(".webp") ||
		path.endsWith(".svg")
	);
}

export async function readFile(file: TFile): Promise<string> {
	if (file.path.endsWith(".svg")) {
		debugLog("Converting SVG to PNG");

		try {
			// Read the SVG file content
			const svgData: string = await this.app.vault.adapter.read(
				file.path,
			);

			const canvas = createCanvas(1000, 1000);
			const context = canvas.getContext("2d");

			// Load the SVG as an image
			const svgImage = await loadImage(
				`data:image/svg+xml;base64,${Buffer.from(svgData).toString("base64")}`,
			);

			// Draw the SVG onto the canvas
			context.drawImage(svgImage, 0, 0, 1000, 1000);

			return canvas.toDataURL("image/png").split(",")[1];
		} catch (error) {
			console.error("Error converting SVG to PNG:", error);
			throw error;
		}
	} else {
		// @ts-ignore
		return arrayBufferToBase64(await app.vault.readBinary(file)); //must be global app ref to be used externally
	}
}

export function htmlDescription(innerHTML: string): DocumentFragment {
	const desc = new DocumentFragment();
	desc.createSpan({}, (span) => {
		span.innerHTML = innerHTML;
	});
	return desc;
}
