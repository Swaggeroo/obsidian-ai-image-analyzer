import * as packageJson from '../package.json';
import {Model} from "./types"; // Adjust the path as necessary

export const libVersion = packageJson.version;

export const possibleModels: Model[] = [
	{name: 'llava-llama3 (8B) [default]', model: 'llava-llama3:latest'},
	{name: 'llava (7B)', model: 'llava:latest'},
	{name: 'llava (13B)', model: 'llava:13b'},
	{name: 'llava (34B)', model: 'llava:34b'}
];
