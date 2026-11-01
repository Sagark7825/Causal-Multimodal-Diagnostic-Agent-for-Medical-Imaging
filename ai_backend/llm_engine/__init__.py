"""
LLM Engine Package
==================
Modular, provider-agnostic LLM Layer for MedCausal AI Backend.
Supports Ollama, OpenAI, Gemini, and future custom LLMs.
"""

from llm_engine.base import (
    BaseLLMProvider,
    BaseLLMClient,
    BaseLLM,
    LLMResponse,
    register_provider,
    get_registered_providers,
)
from llm_engine.config import LLMConfig
from llm_engine.factory import get_llm_client
from llm_engine.exceptions import (
    LLMException,
    LLMUnavailable,
    InvalidAPIKey,
    RateLimit,
    ModelNotFound,
    LLMTimeout,
    LLMResponseError,
)

__all__ = [
    "get_llm_client",
    "BaseLLMProvider",
    "BaseLLMClient",
    "BaseLLM",
    "LLMResponse",
    "LLMConfig",
    "register_provider",
    "get_registered_providers",
    "LLMException",
    "LLMUnavailable",
    "InvalidAPIKey",
    "RateLimit",
    "ModelNotFound",
    "LLMTimeout",
    "LLMResponseError",
]
