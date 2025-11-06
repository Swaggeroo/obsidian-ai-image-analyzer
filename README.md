# Obsidian AI Image Analyser Plugin

This plugin allows you to analyze images in Obsidian using the Ollama API.
Because of this it requires Ollama to be installed and running on some machine.
Ensure you have the newest version of Ollama installed.
[Ollama download](https://ollama.com/download)

## Features

It analyses images and returns a keyword list of the image.

Currently it supports:

- `jpg`
- `jpeg`
- `png`
- `webp`

### How to use

To analyze an image, right-click on the image and select `Ai analyze image`.
Or use the command palette and search for `AI image analyzer`.

### Models

The plugin uses the `llava-llama3` model from Ollama as the default model.

Other models can be used by changing the `model` setting in the plugin settings:

- `llava-llama3`
- `llava`
- `llava:13b`
- `llava:34b`

If you have a really powerful Computer I recommend using the `llava:13b` or `llava:34b` model, in my testing they were the most accurate.
`llava` for me was the worst model, but it is a little bit smaller than the `llava-llama3` model.

### OmniSearch

The plugin is integrated with the Obsidian [OmniSearch](https://github.com/scambier/obsidian-omnisearch) Plugin.
You can enable `Image AI Indexing` in the settings of the OmniSearch plugin to index the results of the image analysis.

### Cache & Sync

The plugin caches the results of the analysis, so it doesn't have to be done every time.
It caches the result in a json file inside the plugin folder.
Those files can be synced between devices.

### Ollama Proxys

Just use the Ollama URL in the settings. For example using [Open Web UI](https://docs.openwebui.com/) you can use the URL `http://[URL:PORT]/ollama` to access Ollama. You probably need to set a token (See Auth)

#### Auth

If your Proxy requires a token, you can set it in the settings.
It sets a `Authorization` header with the value of the token: `'Authorization': 'Bearer [Token]'`

### Limitations

The prompt to analyze the image will sometimes deliver varying results.
In the future, I will improve on the prompt to make it more consistent.
You can also modify the prompt in the settings.

## Installation

This plugin is available on the [Obsidian community plugins repository](https://obsidian.md/plugins?id=ai-image-analyzer).
You also can download the latest release from the GitHub [releases page](https://github.com/swaggeroo/obsidian-ai-image-analyser/releases) and install it manually in Obsidian.

## Using AI image analyser as a dependency for your plugin

The exposed API:

```typescript
// Add this type somewhere in your code
export type AIImageAnalyzerAPI = {
	analyzeImage: (file: TFile) => Promise<string>;
	canBeAnalyzed: (file: TFile) => boolean;
	isInCache: (file: TFile) => Promise<boolean>;
};

// Then, you can just use this function to get the API
export function getAIImageAnalyser(): AIImageAnalyzerAPI | undefined {
	return (app as any).plugins?.plugins?.["ai-image-analyzer"]?.api;
}

// And use it like this
const text = await getAIImageAnalyser()?.analyzeImage(file);
```

## Contributing

If you want to contribute to this plugin, you can do so by creating a pull request or an issue on the GitHub repository.

### Adding new providers
You can find a example provider in `src/providers/exampleProvider.ts`.
Just create a new file in the `src/providers` folder and implement the `Provider` interface like in the example.
Then search for `[NEW PROVIDER]` in the codebase and modify the code accordingly.

## Thanks

This plugin is heavily inspired by the [Obsidian Text Extractor Plugin](https://github.com/scambier/obsidian-text-extractor).
