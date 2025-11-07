import * as packageJson from "../package.json";
import PQueue from "p-queue"; // Adjust the path as necessary

export const libVersion = packageJson.version;

export const imagesProcessQueue = new PQueue({
	concurrency: 1,
	timeout: 300000,
});

export function runWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	return Promise.race<T>([
		p,
		new Promise<T>((_, rej) =>
			setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms),
		),
	]);
}
