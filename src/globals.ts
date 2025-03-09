import * as packageJson from '../package.json';
import PQueue from "p-queue"; // Adjust the path as necessary

export const libVersion = packageJson.version;

export const imagesProcessQueue = new PQueue({concurrency: 1, timeout: 600000});
