import { Models } from "./types";
import { Provider } from "./provider";

export function setProvider(p: Provider): void {
	provider = p;
}

export let provider: Provider;

export const possibleModels: Models[] = [
	{
		name: "llava-llama3 (8B) [default]",
		model: "llava-llama3:latest",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llama3.2-vision (11B)",
		model: "llama3.2-vision:11b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llama3.2-vision (90B)",
		model: "llama3.2-vision:90b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llava (7B)",
		model: "llava:latest",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llava (13B)",
		model: "llava:13b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llava (34B)",
		model: "llava:34b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "llama3.3 (70B)",
		model: "llama3.3",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "deepseek-r1 (7B)",
		model: "deepseek-r1",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "llama3.2 (3B)",
		model: "llama3.2",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "llama3.2 (1B)",
		model: "llama3.2:1b",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "llama3.1 (8B)",
		model: "llama3.1",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "llama3.1 (70B)",
		model: "llama3.1:70b",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "gemma3 (1B)",
		model: "gemma3:1b",
		imageReady: false,
		provider: "ollama",
	},
	{
		name: "gemma3 (4B)",
		model: "gemma3:4b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "gemma3 (12B)",
		model: "gemma3:12b",
		imageReady: true,
		provider: "ollama",
	},
	{
		name: "gemma3 (27B)",
		model: "gemma3:27b",
		imageReady: true,
		provider: "ollama",
	},
	// { [NEW PROVIDER]
	// 	name: "EXAMPLE IMAGE",
	// 	model: "exampleimage",
	// 	imageReady: true,
	// 	provider: "testing",
	// },
	// {
	// 	name: "TESTING",
	// 	model: "test",
	// 	imageReady: false,
	// 	provider: "testing",
	// },
];

export let unsubscribeFunctionSetting: (() => void) | null = null;
export function setUnsubscribeFunctionSetting(fn: (() => void) | null) {
	unsubscribeFunctionSetting = fn;
}

const modelsChangeListeners: Array<() => void> = [];

export function subscribeModelsChange(cb: () => void) {
	modelsChangeListeners.push(cb);
	return () => {
		const idx = modelsChangeListeners.indexOf(cb);
		if (idx > -1) modelsChangeListeners.splice(idx, 1);
	};
}

export function notifyModelsChange() {
	modelsChangeListeners.forEach((cb) => cb());
}
