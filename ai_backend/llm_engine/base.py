"""
Base LLM Interface & Provider Registry
=======================================
Defines the unified BaseLLMProvider abstract interface, standard LLMResponse object,
and dynamic provider registration decorator.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Iterator, Type
import logging

from llm_engine.config import LLMConfig

logger = logging.getLogger(__name__)


class LLMResponse(str):
    """
    Standard response object returned by all LLM providers.
    
    Subclasses Python's built-in `str` for 100% zero-breakage backward compatibility.
    Any existing code treating the response as a string (e.g. `response.strip()`, `len(response)`)
    works seamlessly, while new analytics code can access `.provider`, `.model`, `.latency_ms`, `.tokens`, etc.
    """
    provider: str
    model: str
    latency_ms: float
    tokens: Dict[str, int]
    finish_reason: str
    metadata: Dict[str, Any]

    def __new__(
        cls,
        text: str,
        provider: str = "",
        model: str = "",
        latency_ms: float = 0.0,
        tokens: Optional[Dict[str, int]] = None,
        finish_reason: str = "stop",
        metadata: Optional[Dict[str, Any]] = None,
    ):
        instance = super().__new__(cls, text)
        instance.provider = provider
        instance.model = model
        instance.latency_ms = latency_ms
        instance.tokens = tokens or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        instance.finish_reason = finish_reason
        instance.metadata = metadata or {}
        return instance

    @property
    def text(self) -> str:
        """Returns the raw text content."""
        return str(self)

    def to_dict(self) -> Dict[str, Any]:
        """Returns structured dict representation of the response."""
        return {
            "text": self.text,
            "provider": self.provider,
            "model": self.model,
            "latency_ms": self.latency_ms,
            "tokens": self.tokens,
            "finish_reason": self.finish_reason,
            "metadata": self.metadata,
        }


# Global registry mapping provider names (e.g. "ollama", "openai", "gemini") to Provider classes
_PROVIDER_REGISTRY: Dict[str, Type["BaseLLMProvider"]] = {}


def register_provider(*names: str):
    """
    Decorator to register an LLM provider class in the dynamic provider registry.
    
    Usage:
        @register_provider("ollama")
        class OllamaProvider(BaseLLMProvider):
            ...
    """
    def decorator(cls: Type["BaseLLMProvider"]):
        for name in names:
            clean_name = name.lower().strip()
            _PROVIDER_REGISTRY[clean_name] = cls
            logger.debug(f"[LLMRegistry] Registered provider '{clean_name}' -> {cls.__name__}")
        return cls
    return decorator


def get_registered_providers() -> Dict[str, Type["BaseLLMProvider"]]:
    """Returns a copy of all currently registered LLM providers."""
    return dict(_PROVIDER_REGISTRY)


class BaseLLMProvider(ABC):
    """
    Abstract Base Class for all LLM Providers.
    
    Every provider (Ollama, OpenAI, Gemini, Claude, DeepSeek, etc.) must implement
    this exact interface.
    """

    def __init__(self, config: LLMConfig):
        self.config = config

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Single-prompt text generation.
        
        Returns:
            LLMResponse object (subclasses str for backward compatibility)
        """
        ...

    @abstractmethod
    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Multi-turn conversation generation.
        
        Args:
            messages: List of message dicts [{'role': 'user'|'system'|'assistant', 'content': '...'}]
        
        Returns:
            LLMResponse object
        """
        ...

    @abstractmethod
    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Iterator[str]:
        """
        Streams generated text tokens yields strings chunk-by-chunk.
        """
        ...

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """
        Performs a health check of the LLM provider service.
        
        Returns dict with keys:
            - provider (str)
            - model (str)
            - available (bool)
            - latency_ms (float)
            - version (str)
            - details (dict)
        """
        ...

    def is_available(self) -> bool:
        """Convenience method checking availability via health_check()."""
        try:
            health = self.health_check()
            return bool(health.get("available", False))
        except Exception:
            return False

    def model_info(self) -> Dict[str, Any]:
        """Returns metadata about the configured provider and model."""
        return {
            "provider": self.config.provider,
            "model": self.config.model,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "timeout": self.config.timeout,
            "base_url": self.config.base_url,
        }

    # Backward compatibility alias method
    def get_model_info(self) -> Dict[str, Any]:
        return self.model_info()


# Interface Aliases for backward compatibility and alternative Naming
BaseLLM = BaseLLMProvider
BaseLLMClient = BaseLLMProvider
