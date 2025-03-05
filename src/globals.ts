import * as packageJson from '../package.json';
import {GeminiModel, Model} from "./types";
import PQueue from "p-queue"; // Adjust the path as necessary

export const libVersion = packageJson.version;

// Ollama models are defined statically because they need to be pulled locally
export const possibleModels: Model[] = [
	{name: 'llava-llama3 (8B) [default]', model: 'llava-llama3:latest'},
	{name: 'llama3.2-vision (11B)', model: 'llama3.2-vision:11b'},
	{name: 'llama3.2-vision (90B)', model: 'llama3.2-vision:90b'},
	{name: 'llava (7B)', model: 'llava:latest'},
	{name: 'llava (13B)', model: 'llava:13b'},
	{name: 'llava (34B)', model: 'llava:34b'}
];

// Fallback Gemini models to use if API model list fails
export const fallbackGeminiModels: GeminiModel[] = [
	{name: 'Gemini 1.5 Pro', model: 'gemini-1.5-pro-vision'},
	{name: 'Gemini 1.5 Flash', model: 'gemini-1.5-flash-vision'},
	{name: 'Gemini Pro Vision', model: 'gemini-pro-vision'}
];

export const imagesProcessQueue = new PQueue({concurrency: 1, timeout: 600000});
