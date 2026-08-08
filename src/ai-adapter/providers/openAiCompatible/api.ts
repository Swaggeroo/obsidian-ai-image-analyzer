// Pure request and response shaping for the OpenAI compatible API.
// Deliberately free of obsidian imports and of plugin state.
import type { Models } from "../../types";

export type ChatMessage = {
	role: string;
	content: unknown;
};

export const CONNECTION_TIMEOUT_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 300_000;
export const MAX_ERROR_BODY = 500;

// shown until the server answers with its model list
export const PLACEHOLDER_MODEL: Models = {
	name: "No model loaded",
	model: "",
	imageReady: true,
	provider: "openai-compatible",
};

// GET /v1/models -> the entries shown in the model dropdowns.
// The endpoint carries no vision capability flag, so every model is offered
// for image analysis and the server rejects the ones that cannot handle it.
export function modelsFromApi(payload: unknown): Models[] {
	const data = (payload as { data?: unknown })?.data;
	if (!Array.isArray(data)) {
		return [];
	}

	return data
		.map((entry) => (entry as { id?: unknown })?.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0)
		.map((id) => ({
			name: id,
			model: id,
			imageReady: true,
			provider: "openai-compatible" as const,
		}));
}

export function textMessage(prompt: string): ChatMessage {
	return { role: "user", content: prompt };
}

export function imageMessage(prompt: string, image: string): ChatMessage {
	return {
		role: "user",
		content: [
			{ type: "text", text: prompt },
			{
				type: "image_url",
				image_url: { url: `data:image/png;base64,${image}` },
			},
		],
	};
}

export function chatCompletionBody(
	model: string,
	messages: ChatMessage[],
	temperature: number,
): string {
	return JSON.stringify({
		model,
		messages,
		temperature,
		// some servers stream by default, the response parsing expects a
		// single JSON body
		stream: false,
	});
}

export function contentFromApi(payload: unknown): string {
	const choices = (payload as { choices?: unknown })?.choices;
	if (!Array.isArray(choices)) {
		return "";
	}
	const content = (choices[0] as { message?: { content?: unknown } })?.message
		?.content;
	return typeof content === "string" ? content : "";
}

// a model saved in an earlier session may be gone from the server
export function resolveSelection(models: Models[], selected: Models): Models {
	return models.find((model) => model.model === selected.model) ?? models[0];
}

export function authHeaders(
	token: string,
	base: Record<string, string> = {},
): Record<string, string> {
	return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}
