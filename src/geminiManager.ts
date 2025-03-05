import {Notice, TFile} from "obsidian";
import {isInCache, readCache, writeCache} from "./cache";
import {GoogleGenerativeAI, HarmCategory, HarmBlockThreshold} from "@google/generative-ai";
import {debugLog, isImageFile, readFile} from "./util";
import {settings} from "./settings";
import {imagesProcessQueue} from "./globals";
import {GeminiModel} from "./types";

let genAI: GoogleGenerativeAI;

export async function analyzeImageWithGemini(file: TFile): Promise<string> {
    try {
        return await imagesProcessQueue.add(() => analyzeImageHandlingGemini(file)) ?? '';
    } catch (e) {
        debugLog(e);
        return '';
    }
}

async function analyzeImageHandlingGemini(file: TFile): Promise<string> {
    debugLog(`Analyzing image with Gemini: ${file.name}`);
    if (!isImageFile(file)) {
        return '';
    }

    // Check if the image is in the cache
    if (await isInCache(file)) {
        debugLog(`Image ${file.name} found in cache`);
        const cachedText = await readCache(file);
        if (cachedText) {
            return cachedText.text;
        }
    }

    try {
        // Prepare the image data
        const imgData = await readFile(file);

        // Set up the model
        const model = genAI.getGenerativeModel({ model: settings.geminiModel.model });

        // Set up the generation config with safety settings
        const generationConfig = {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1024,
        };

        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];

        // Generate the content
        const geminiPrompt = settings.prompt;
        const result = await model.generateContent([
            geminiPrompt,
            {
                inlineData: {
                    data: imgData,
                    mimeType: "image/jpeg"
                }
            }
        ], { generationConfig, safetySettings });

        const response = result.response;
        const text = response.text();
        
        // Cache the result
        await writeCache(file, text);
        
        return text;
    } catch (e) {
        debugLog(`Error analyzing image with Gemini: ${e}`);
        new Notice(`Error analyzing image: ${e}`);
        return '';
    }
}

/**
 * Fetches available Gemini models from the Google AI API
 * @param apiKey Google AI API key
 * @returns Array of GeminiModel objects
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<GeminiModel[]> {
    try {
        if (!apiKey) {
            return [];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        debugLog(`Fetching available Gemini models from: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog(`Error fetching models: ${errorText}`);
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        
        const data = await response.json();
        debugLog("API response for models:", data);
        
        if (!data.models || !Array.isArray(data.models)) {
            debugLog("No models found in API response");
            return [];
        }
        
        // Filter for Gemini vision-capable models and format them
        const geminiModels = data.models
            .filter((model: any) => {
                // Filter for models that have "gemini" in their name
                // and are capable of vision/multimodal tasks
                return model.name && 
                       model.name.toLowerCase().includes('gemini') &&
                       ((model.supportedGenerationMethods && 
                        model.supportedGenerationMethods.includes('generateContent')) ||
                        model.name.toLowerCase().includes('vision'));
            })
            .map((model: any) => {
                // Format the display name to be more user-friendly
                let displayName = model.displayName || model.name;
                // If no display name is available, create one from the model name
                if (!displayName) {
                    displayName = model.name.split('/').pop();
                    // Convert "gemini-pro-vision" to "Gemini Pro Vision"
                    displayName = displayName
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                }
                
                return {
                    name: displayName,
                    model: model.name
                };
            });
        
        debugLog(`Found ${geminiModels.length} Gemini models:`, geminiModels);
        
        // If no Gemini models were found, return a fallback list
        if (geminiModels.length === 0) {
            debugLog("No Gemini models found, using fallback models");
            return [
                {name: 'Gemini 1.5 Pro', model: 'gemini-1.5-pro-vision'},
                {name: 'Gemini 1.5 Flash', model: 'gemini-1.5-flash-vision'},
                {name: 'Gemini Pro Vision', model: 'gemini-pro-vision'}
            ];
        }
        
        return geminiModels;
    } catch (error) {
        debugLog(`Error fetching Gemini models: ${error}`);
        // Return fallback models in case of error
        return [
            {name: 'Gemini 1.5 Pro', model: 'gemini-1.5-pro-vision'},
            {name: 'Gemini 1.5 Flash', model: 'gemini-1.5-flash-vision'},
            {name: 'Gemini Pro Vision', model: 'gemini-pro-vision'}
        ];
    }
}

export async function checkGeminiAPI() {
    try {
        if (!settings.geminiApiKey) {
            new Notice("No Gemini API key provided. Please add an API key in the settings.");
            return false;
        }
        
        // Test API connection
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, please respond with 'API working' to test the connection");
        const text = result.response.text();
        
        if (text.includes("API working")) {
            debugLog("Gemini API connection successful");
            return true;
        } else {
            new Notice("Gemini API connection test failed. Please check your API key and connection.");
            return false;
        }
    } catch (e) {
        debugLog(`Gemini API connection error: ${e}`);
        new Notice(`Failed to connect to Gemini API: ${e}`);
        return false;
    }
}

export function setGeminiAPI(apiKey: string) {
    genAI = new GoogleGenerativeAI(apiKey);
} 