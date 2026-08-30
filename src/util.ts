import { arrayBufferToBase64, TFile, App } from "obsidian";
import { settings } from "./settings";

const context = "util";
export function getApp(): App {
	return (window as unknown as { app: App }).app;
}

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

function svgToBase64(svgData: string): string {
	const bytes = new TextEncoder().encode(svgData);
	let binary = "";
	const chunkSize = 0x8000;

	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}

	return btoa(binary);
}

export function getTempBasePath(): string {
	return `${getApp().vault.configDir}/plugins/ai-image-analyzer/tmp`; //must be global app ref to be used externally
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
			const svgData: string = await getApp().vault.adapter.read(file.path);

			return await new Promise<string>((resolve, reject) => {
				const timeoutId = window.setTimeout(() => {
					reject(
						new Error(
							"SVG loading timeout - SVG may be malformed or too complex",
						),
					);
				}, 5000); // 5 second timeout

				const canvas = createEl("canvas");
				let width = 1000;
				let height = 1000;

				// Try to extract viewBox to preserve aspect ratio
				try {
					const viewBoxMatch = svgData.match(
						/viewBox\s*=\s*["']([^"']+)["']/,
					);
					if (viewBoxMatch) {
						const [, , , vWidth, vHeight] =
							viewBoxMatch[1].split(/[\s,]+/);
						if (vWidth && vHeight) {
							const ratio =
								parseFloat(vWidth) / parseFloat(vHeight);
							if (!isNaN(ratio) && isFinite(ratio)) {
								// Adjust canvas to maintain aspect ratio
								if (ratio > 1) {
									height = Math.round(1000 / ratio);
								} else {
									width = Math.round(1000 * ratio);
								}
								debugLog(
									context,
									`SVG viewBox detected, adjusted canvas to ${width}x${height}`,
								);
							}
						}
					}
				} catch {
					debugLog(
						context,
						"Could not parse viewBox, using default size",
					);
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");

				if (!ctx) {
					window.clearTimeout(timeoutId);
					reject(new Error("Could not get canvas context"));
					return;
				}

				const image = new Image();

				image.onload = () => {
					try {
						window.clearTimeout(timeoutId);
						ctx.drawImage(image, 0, 0, width, height);
						const dataUrl = canvas.toDataURL("image/png");
						resolve(dataUrl.split(",")[1]);
					} catch (err) {
						window.clearTimeout(timeoutId);
						reject(
							err instanceof Error ? err : new Error(String(err)),
						);
					}
				};

				image.onerror = (error) => {
					window.clearTimeout(timeoutId);
					console.error("Error loading SVG image:", error);
					reject(new Error("Failed to load SVG."));
				};

				try {
					const encoded = svgToBase64(svgData);
					image.src = `data:image/svg+xml;base64,${encoded}`;
				} catch (e) {
					window.clearTimeout(timeoutId);
					console.error("Error encoding SVG:", e);
					reject(new Error("Failed to encode SVG: " + String(e)));
				}
			});
		} catch (error) {
			console.error("Error converting SVG to PNG:", error);
			throw error;
		}
	} else {
		return arrayBufferToBase64(await getApp().vault.readBinary(file)); //must be global app ref to be used externally
	}
}
