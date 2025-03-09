export type AnalyzedText = {
	path: string
	text: string
	libVersion: string
}

export type AIAdapterAPI = {
	query: (prompt: string) => Promise<string>;
	queryWithImage: (prompt: string, image: string) => Promise<string>;
};
