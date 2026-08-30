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
			"obsidianmd/rule-custom-message": [
				"error",
				{
					"no-console": {
						"messages": {
							"Unexpected console statement. Only these console methods are allowed: warn, error, debug, log, info.": "Avoid unnecessary logging to console. See https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Avoid+unnecessary+logging+to+console"
						},
						"options": [
							{
								"allow": ["warn", "error", "debug", "log", "info"]
							}
						]
					},
				}
			]
		},
	},
]);
