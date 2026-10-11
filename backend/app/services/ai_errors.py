"""AI failures. `public_message` is safe to show to users. `detail` is for server logs only."""

from __future__ import annotations


class AIError(Exception):
    code = "ai_error"
    public_message = "The AI service had a problem."

    def __init__(self, detail: str = "") -> None:
        super().__init__(detail or self.public_message)
        self.detail = detail


class AIDisabledError(AIError):
    code = "ai_disabled"
    public_message = "AI generation is turned off on this server."


class AIUnavailableError(AIError):
    code = "ai_unreachable"
    public_message = "The local AI service (Ollama) could not be reached."


class AIModelMissingError(AIError):
    code = "ai_model_missing"
    public_message = "The configured AI model is not installed in Ollama."


class AITimeoutError(AIError):
    code = "ai_timeout"
    public_message = "The AI model took too long to respond."


class AIServerError(AIError):
    code = "ai_server_error"
    public_message = "The AI service returned an error."


class AIResponseError(AIError):
    code = "ai_invalid_response"
    public_message = "The AI model returned a plan that could not be used."
