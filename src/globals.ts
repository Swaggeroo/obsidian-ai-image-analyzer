import * as packageJson from '../package.json';
import {Model} from "./types";
import PQueue from "p-queue"; // Adjust the path as necessary

export const libVersion = packageJson.version;

export const possibleModels: Model[] = [
	{name: 'llava-llama3 (8B) [default]', model: 'llava-llama3:latest'},
	{name: 'llama3.2-vision (11B)', model: 'llama3.2-vision:11b'},
	{name: 'llama3.2-vision (90B)', model: 'llama3.2-vision:90b'},
	{name: 'llava (7B)', model: 'llava:latest'},
	{name: 'llava (13B)', model: 'llava:13b'},
	{name: 'llava (34B)', model: 'llava:34b'}
];

export const imagesProcessQueue = new PQueue({concurrency: 1, timeout: 600000})
