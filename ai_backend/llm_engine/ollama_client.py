"""
Ollama Client — Backward Compatibility Wrapper
================================================
Re-exports OllamaProvider (as OllamaClient) from the new provider architecture.
Ensures zero breakage for legacy code importing `from llm_engine.ollama_client import OllamaClient`.
"""

from llm_engine.providers.ollama_provider import OllamaProvider as OllamaClient, OllamaProvider
from llm_engine.config import LLMConfig

DEFAULT_OLLAMA_CONFIG = LLMConfig.from_env(provider="ollama")

__all__ = [
    "OllamaClient",
    "OllamaProvider",
    "DEFAULT_OLLAMA_CONFIG",
]
