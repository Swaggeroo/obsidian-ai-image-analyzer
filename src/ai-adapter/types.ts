export type Models = {
	name: string;
	model: string;
	imageReady: boolean;
	provider: Providers;
};

export type Providers = "ollama" | "gemini" | "llama-cpp" | "ai-providers"; // | "example" [NEW PROVIDER]

export const providerNames: Providers[] = [
	"ollama",
	"gemini",
	"llama-cpp",
	"ai-providers",
]; //, "example"]; [NEW PROVIDER]
