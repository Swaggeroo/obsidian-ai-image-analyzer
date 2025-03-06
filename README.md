# AI Image Analyzer for Obsidian

This plugin analyzes images using AI to extract keywords and descriptions, making your images more searchable and accessible within Obsidian.

## Features

- Analyze images to extract keywords and descriptions
- Support for both local (Ollama) and cloud (Google Gemini) AI models
- Easy switching between providers through a dropdown in settings
- Dynamic fetching of available Gemini models from the Google API
- Configurable prompt for customized analysis
- Image caching for faster repeated analyses
- Right-click context menu integration for images
- Commands for quick access to image analysis
- Support for multiple image formats (PNG, JPG, JPEG, WEBP, SVG)

## Installation

1. Install the plugin from the Obsidian Community Plugins browser
2. Enable the plugin in your Obsidian settings
3. Configure your preferred AI provider in the settings

## Configuration

### General Settings

- **AI Provider**: Select between Ollama (local) or Google Gemini (cloud-based)
- **Debug Mode**: Enable for detailed logs in the developer console
- **Auto Clear Cache**: Automatically clear the cache when changing models or prompts

### Ollama Configuration

- **Model**: Select from various vision-capable models
- **Pull Model**: Download the selected model to your local machine
- **Ollama URL**: Set the URL for the Ollama server (default: http://127.0.0.1:11434)
- **Ollama Token**: Optional authentication token for the Ollama server

### Google Gemini Configuration

- **API Key**: Your Google AI Studio API key (required for Gemini)
- **Test & Fetch Models**: Test the API connection and fetch available models from Google's API
- **Model**: Select from dynamically fetched Gemini vision models

### Common Settings

- **Prompt**: Customize the prompt sent to the AI model
- **Clear Cache**: Manually clear the image analysis cache

## Usage

### Analyzing Images

1. Right-click on an image in Obsidian
2. Choose "AI analyze image" to view the analysis
3. Or choose "AI analyze image to clipboard" to copy the analysis directly

### Commands

The plugin adds several commands that can be accessed via the command palette:

- **Analyze image**: Analyze the currently selected image and display the result
- **Analyze image to clipboard**: Analyze the currently selected image and copy the result to clipboard
- **Clear cache of active image**: Remove the cached analysis for the current image

## Requirements

### For Ollama

- [Ollama](https://ollama.ai/) installed and running
- A vision-capable model downloaded (llava, llama3.2-vision, etc.)

### For Google Gemini

- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- Internet connection to fetch available models and make API calls

## Development

This plugin is built using TypeScript and the Obsidian API.

```
npm install
npm run dev
```

## License

GPL-3.0
