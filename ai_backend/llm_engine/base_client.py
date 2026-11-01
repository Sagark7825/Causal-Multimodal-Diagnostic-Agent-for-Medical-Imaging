"""
Abstract LLM Client Interface — Backward Compatibility Wrapper
================================================================
Re-exports BaseLLMProvider (as BaseLLMClient) and LLMConfig from the new provider architecture.
Ensures zero breakage for legacy code importing `from llm_engine.base_client import BaseLLMClient, LLMConfig`.
"""

from llm_engine.base import BaseLLMProvider as BaseLLMClient, BaseLLMProvider, LLMResponse
from llm_engine.config import LLMConfig

__all__ = [
    "BaseLLMClient",
    "BaseLLMProvider",
    "LLMConfig",
    "LLMResponse",
]
