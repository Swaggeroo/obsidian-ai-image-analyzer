/**
 * Error classification and extraction utility
 */

export type ErrorType =
	| "timeout"
	| "network"
	| "auth"
	| "rate_limit"
	| "abort"
	| "config"
	| "parse"
	| "unknown";

export interface ClassifiedError {
	type: ErrorType;
	message: string;
	userMessage: string; // Friendly message for end users
	cause?: unknown; // Original error
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(e: unknown): string {
	if (e instanceof Error) {
		return e.message;
	}
	if (typeof e === "string") {
		return e;
	}
	try {
		return JSON.stringify(e);
	} catch {
		return String(e);
	}
}

/**
 * Classify an error and provide user-friendly message
 */
export function classifyError(e: unknown): ClassifiedError {
	const message = extractErrorMessage(e);
	const lowerMessage = message.toLowerCase();

	// Timeout detection
	if (
		lowerMessage.includes("timeout") ||
		lowerMessage.includes("timed out")
	) {
		return {
			type: "timeout",
			message,
			userMessage:
				"Analysis took too long. The provider may be slow or unresponsive.",
			cause: e,
		};
	}

	// Abort detection
	if (e instanceof Error && e.name === "AbortError") {
		return {
			type: "abort",
			message,
			userMessage: "Analysis was cancelled.",
			cause: e,
		};
	}

	// Network error detection
	if (
		lowerMessage.includes("network") ||
		lowerMessage.includes("econnrefused") ||
		lowerMessage.includes("enotfound") ||
		lowerMessage.includes("failed to fetch") ||
		lowerMessage.includes("connection refused")
	) {
		return {
			type: "network",
			message,
			userMessage:
				"Cannot connect to the AI provider. Check if it's running and the URL is correct.",
			cause: e,
		};
	}

	// Auth/API key detection
	if (
		lowerMessage.includes("unauthorized") ||
		lowerMessage.includes("401") ||
		lowerMessage.includes("forbidden") ||
		lowerMessage.includes("403") ||
		lowerMessage.includes("invalid api key") ||
		lowerMessage.includes("api key")
	) {
		return {
			type: "auth",
			message,
			userMessage:
				"Authentication failed. Check your API key or credentials in settings.",
			cause: e,
		};
	}

	// Rate limit detection
	if (
		lowerMessage.includes("rate limit") ||
		lowerMessage.includes("429") ||
		lowerMessage.includes("too many requests")
	) {
		return {
			type: "rate_limit",
			message,
			userMessage:
				"Rate limit exceeded. The provider is receiving too many requests. Try again later.",
			cause: e,
		};
	}

	// Parse error detection
	if (
		lowerMessage.includes("json") ||
		lowerMessage.includes("parse") ||
		lowerMessage.includes("syntax")
	) {
		return {
			type: "parse",
			message,
			userMessage:
				"Provider returned invalid data. Check provider logs or try a different model.",
			cause: e,
		};
	}

	// Config/validation error detection
	if (
		lowerMessage.includes("not initialized") ||
		lowerMessage.includes("provider not") ||
		lowerMessage.includes("no response") ||
		lowerMessage.includes("empty response")
	) {
		return {
			type: "config",
			message,
			userMessage: "Provider is not properly configured. Check settings.",
			cause: e,
		};
	}

	// Default unknown error
	return {
		type: "unknown",
		message,
		userMessage: `Analysis failed: ${message}`,
		cause: e,
	};
}
