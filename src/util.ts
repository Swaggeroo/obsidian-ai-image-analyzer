import { arrayBufferToBase64, TFile } from "obsidian";
import { settings } from "./settings";

const context = "util";

function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		// keep hash in 32-bit signed range
		hash |= 0;
	}
	const hue = ((hash % 360) + 360) % 360;
	return `hsl(${hue}, 70%, 50%)`;
}

export function debugLog(context: string, message: object | string) {
	if (settings.debug) {
		const color = stringToColor(context);

		console.log(
			`[AIImageAnalyzer] %c[${context}]`,
			`color: ${color}; font-weight: bold;`,
			message,
		);
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
		debugLog(context, "Converting SVG to PNG");

		try {
			const svgData: string = await this.app.vault.adapter.read(
				file.path,
			);

			return await new Promise<string>((resolve, reject) => {
				const canvas = document.createElement("canvas");
				canvas.width = 1000;
				canvas.height = 1000;
				const context = canvas.getContext("2d");

				if (!context) {
					reject(new Error("Could not get canvas context"));
					return;
				}

				const image = new Image();
				image.onload = () => {
					try {
						context.drawImage(image, 0, 0, 1000, 1000);
						const dataUrl = canvas.toDataURL("image/png");
						resolve(dataUrl.split(",")[1]);
					} catch (err) {
						reject(err);
					}
				};
				image.onerror = (error) => {
					console.error("Error loading SVG image:", error);
					reject(error);
				};

				// Use a data URL; btoa is fine for typical SVG content — if you expect
				// Unicode in SVG, consider using a proper base64 encoder.
				image.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
			});
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
