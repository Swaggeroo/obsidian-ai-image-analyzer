export type Models = {
	name: string;
	model: string;
	imageReady: boolean;
	provider: Providers;
};

export type Providers = "ollama" | "gemini" | "llama-cpp" | "openai-compatible"; // | "example" [NEW PROVIDER]

export const providerNames: Providers[] = [
	"ollama",
	"gemini",
	"llama-cpp",
	"openai-compatible",
]; //, "example"]; [NEW PROVIDER]
