// eslint.config.mjs
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		ignores: ["node_modules/**", "main.js", "cache/**"],
	},
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*", "*.mjs"],
				},
			},
		},
		rules: {
			// example: turn off a rule from the recommended set
			//"obsidianmd/sample-names": "off",
		},
	},
]);
