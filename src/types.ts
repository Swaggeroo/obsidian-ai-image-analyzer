export type AnalyzedText = {
	path: string;
	text: string;
	libVersion: string;
};

export type Model = {
	name: string;
	model: string;
};

export type Provider = "ollama" | "gemini";

export type GeminiModel = {
	name: string;
	model: string;
};
