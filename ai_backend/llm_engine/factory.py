"""
LLM Provider Factory & Fallback Proxy
======================================
Instantiates LLM providers dynamically via the Provider Registry without if/else logic chains.
Supports automatic multi-provider fallback chains (e.g., Ollama -> Gemini -> OpenAI).
"""

import logging
from typing import Optional, List, Dict, Any, Iterator

from llm_engine.base import (
    BaseLLMProvider,
    LLMResponse,
    get_registered_providers,
)
from llm_engine.config import LLMConfig
from llm_engine.exceptions import LLMUnavailable, LLMTimeout, LLMException
# Import providers package to ensure all @register_provider decorators execute
import llm_engine.providers  # noqa: F401

logger = logging.getLogger(__name__)


class FallbackLLMClientProxy(BaseLLMProvider):
    """
    Transparent proxy that attempts execution on the primary provider,
    and automatically falls back to alternative providers if the primary fails.
    """

    def __init__(self, primary_client: BaseLLMProvider, fallback_providers: List[str]):
        super().__init__(primary_client.config)
        self.primary_client = primary_client
        self.fallback_names = [p for p in fallback_providers if p != primary_client.config.provider]

    def _get_fallback_clients(self) -> List[BaseLLMProvider]:
        fallback_clients = []
        registry = get_registered_providers()
        for p_name in self.fallback_names:
            if p_name in registry:
                fb_config = LLMConfig.from_env(provider=p_name)
                fallback_clients.append(registry[p_name](fb_config))
        return fallback_clients

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        clients = [self.primary_client] + self._get_fallback_clients()
        last_err = None

        for idx, client in enumerate(clients):
            try:
                if idx > 0:
                    logger.warning(
                        f"[LLMFallback] ⚠️ Failover active! Executing generate() on fallback provider '{client.config.provider}'"
                    )
                return client.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
            except (LLMUnavailable, LLMTimeout) as e:
                logger.error(f"[LLMFallback] Provider '{client.config.provider}' unavailable ({e}). Trying next fallback...")
                last_err = e
            except Exception as e:
                # Do not fallback on non-transient auth / model error
                raise e

        if last_err:
            raise last_err
        raise LLMUnavailable("All configured LLM providers failed", provider=self.config.provider, model=self.config.model)

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        clients = [self.primary_client] + self._get_fallback_clients()
        last_err = None

        for idx, client in enumerate(clients):
            try:
                if idx > 0:
                    logger.warning(
                        f"[LLMFallback] ⚠️ Failover active! Executing chat() on fallback provider '{client.config.provider}'"
                    )
                return client.chat(
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
            except (LLMUnavailable, LLMTimeout) as e:
                logger.error(f"[LLMFallback] Provider '{client.config.provider}' unavailable ({e}). Trying next fallback...")
                last_err = e
            except Exception as e:
                raise e

        if last_err:
            raise last_err
        raise LLMUnavailable("All configured LLM providers failed", provider=self.config.provider, model=self.config.model)

    def stream_generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Iterator[str]:
        clients = [self.primary_client] + self._get_fallback_clients()
        for client in clients:
            try:
                yield from client.stream_generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
                return
            except (LLMUnavailable, LLMTimeout) as e:
                logger.error(f"[LLMFallback] Provider '{client.config.provider}' stream failed ({e}). Trying next fallback...")
                continue
            except Exception as e:
                raise e

    def health_check(self) -> Dict[str, Any]:
        primary_health = self.primary_client.health_check()
        if primary_health.get("available"):
            return primary_health

        # Check fallbacks
        fallback_statuses = []
        for fb_client in self._get_fallback_clients():
            fb_health = fb_client.health_check()
            fallback_statuses.append(fb_health)
            if fb_health.get("available"):
                fb_health["details"] = fb_health.get("details", {})
                fb_health["details"]["fallback_active_for"] = self.primary_client.config.provider
                return fb_health

        # If all unavailable
        primary_health["fallback_statuses"] = fallback_statuses
        return primary_health


_LLM_CLIENT_CACHE: Dict[str, BaseLLMProvider] = {}


def clear_llm_client_cache():
    """Clears the singleton LLM client cache."""
    global _LLM_CLIENT_CACHE
    _LLM_CLIENT_CACHE.clear()


def get_llm_client(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    **kwargs,
) -> BaseLLMProvider:
    """
    Factory function — instantiates the configured LLM provider from the registry.
    Order of precedence for provider:
      1. Explicit `provider` argument
      2. `LLM_PROVIDER` environment variable
      3. Default: `"ollama"`
    """
    config = LLMConfig.from_env(provider=provider, model=model, **kwargs)
    registry = get_registered_providers()

    provider_name = config.provider.lower().strip()
    if provider_name not in registry:
        supported = list(registry.keys())
        raise ValueError(
            f"Unknown LLM provider: '{provider_name}'. "
            f"Supported providers in registry: {supported}. "
            f"To add a new provider, decorate your provider class with @register_provider('{provider_name}')."
        )

    cache_key = f"{provider_name}:{config.model}:{config.base_url}:{config.api_key}:{tuple(sorted(kwargs.items()))}"

    if cache_key in _LLM_CLIENT_CACHE:
        client_inst = _LLM_CLIENT_CACHE[cache_key]
        logger.info(
            f"[LLMFactory] Reusing singleton provider '{provider_name}' | "
            f"Provider Class: {type(client_inst).__name__} | "
            f"Object ID: {id(client_inst)} | Model: '{config.model}'"
        )
        return client_inst

    provider_cls = registry[provider_name]
    client_inst = provider_cls(config)

    logger.info(
        f"[LLMFactory] Instantiated provider '{provider_name}' | "
        f"Provider Class: {provider_cls.__name__} | "
        f"Object ID: {id(client_inst)} | Model: '{config.model}'"
    )

    if config.fallback_providers:
        logger.info(f"[LLMFactory] Configured fallback providers: {config.fallback_providers}")
        proxy_inst = FallbackLLMClientProxy(client_inst, config.fallback_providers)
        _LLM_CLIENT_CACHE[cache_key] = proxy_inst
        return proxy_inst

    _LLM_CLIENT_CACHE[cache_key] = client_inst
    return client_inst
