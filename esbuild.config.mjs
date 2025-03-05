import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins,
		"path"
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	platform: "node",
	loader: { ".node": "file" },
	plugins: [
		{
			name: "node-modules-polyfill",
			setup(build) {
				build.onResolve({ filter: /^node:/ }, (args) => {
					const moduleName = args.path.replace(/^node:/, "");
					if (moduleName === "fs") {
						return {
							path: "empty:" + moduleName,
							namespace: "empty-module",
						};
					}
				});
				build.onLoad(
					{ filter: /^empty:/, namespace: "empty-module" },
					() => {
						return {
							contents:
								"export default {}; export const promises = {};",
							loader: "js",
						};
					},
				);
			},
		},
		{
			name: "node-builtins-polyfill",
			setup(build) {
				build.onResolve({ filter: /^node:(.*)$/ }, (args) => {
					return {
						path: args.path.replace(/^node:/, ""),
						external: true,
					};
				});
			},
		},
	],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
