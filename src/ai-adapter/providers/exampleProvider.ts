import { Setting } from "obsidian";
import { Provider } from "../provider";
import { Models } from "../types";
import { possibleModels } from "../globals";
import AIImageAnalyzerPlugin from "../../main";
// import { settings } from "../settings";

export type ExampleSettings = {
	lastModel: Models;
	lastImageModel: Models;
};

export const DEFAULT_EXAMPLE_SETTINGS: ExampleSettings = {
	lastModel: possibleModels[13],
	lastImageModel: possibleModels[12],
};

export class ExampleProvider extends Provider {
	constructor() {
		super();
		// this.lastModel = settings.exampleSettings.lastModel;
		// this.lastImageModel = settings.exampleSettings.lastImageModel;
	}

	generateSettings(containerEl: HTMLElement, plugin: AIImageAnalyzerPlugin) {
		new Setting(containerEl).setName("Testing").setHeading();
	}

	queryHandling(prompt: string): Promise<string> {
		return Promise.resolve("");
	}

	queryWithImageHandling(prompt: string, image: string): Promise<string> {
		return Promise.resolve("");
	}

	setLastModel(model: Models) {
		super.setLastModel(model);
		// settings.exampleSettings.lastModel = model;
	}

	setLastImageModel(model: Models) {
		super.setLastImageModel(model);
		// settings.exampleSettings.lastImageModel = model;
	}
}
