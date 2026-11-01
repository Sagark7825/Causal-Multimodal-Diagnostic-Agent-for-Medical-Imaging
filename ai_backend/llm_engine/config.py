"""
LLM Configuration Manager
==========================
Centralized configuration manager loading environment variables for all providers.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional


@dataclass
class LLMConfig:
    """
    Configuration dataclass holding settings for LLM providers.
    Supports environment variable loading and dynamic keyword overrides.
    """
    provider    : str   = "ollama"
    model       : str   = ""
    temperature : float = 0.1
    max_tokens  : int   = 4096
    timeout     : int   = 120
    max_retries : int   = 3
    base_url    : str   = ""
    api_key     : str   = ""
    fallback_providers: List[str] = field(default_factory=list)
    extra_params: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_env(cls, provider: Optional[str] = None, model: Optional[str] = None, **kwargs) -> "LLMConfig":
        """
        Creates an LLMConfig instance initialized from environment variables with optional parameter overrides.
        """
        target_provider = (provider or os.getenv("LLM_PROVIDER", "ollama")).lower().strip()
        
        # Read common settings
        temperature = float(os.getenv("LLM_TEMPERATURE", "0.1"))
        max_tokens = int(os.getenv("LLM_MAX_TOKENS", "4096"))
        timeout = int(os.getenv("LLM_TIMEOUT", "120"))
        max_retries = int(os.getenv("LLM_MAX_RETRIES", "3"))

        raw_fallbacks = os.getenv("LLM_FALLBACK_PROVIDERS", "")
        fallback_providers = [p.strip().lower() for p in raw_fallbacks.split(",") if p.strip()]

        # Provider-specific configurations
        base_url = ""
        api_key = ""
        resolved_model = ""

        if target_provider == "ollama":
            resolved_model = model or os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
            base_url = os.getenv("OLLAMA_HOST") or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            api_key = os.getenv("OLLAMA_API_KEY", "")
        elif target_provider == "openai":
            resolved_model = model or os.getenv("OPENAI_MODEL", "gpt-4.1")
            base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
            api_key = os.getenv("OPENAI_API_KEY", "")
        elif target_provider == "gemini":
            resolved_model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
            base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
            api_key = os.getenv("GEMINI_API_KEY", "")
        else:
            # Fallback/generic configuration for future providers (Claude, DeepSeek, Mistral, etc.)
            env_model_var = f"{target_provider.upper()}_MODEL"
            env_url_var = f"{target_provider.upper()}_BASE_URL"
            env_key_var = f"{target_provider.upper()}_API_KEY"

            resolved_model = model or os.getenv(env_model_var, f"{target_provider}-default")
            base_url = os.getenv(env_url_var, "")
            api_key = os.getenv(env_key_var, "")

        config_inst = cls(
            provider=target_provider,
            model=resolved_model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=max_retries,
            base_url=base_url.rstrip("/"),
            api_key=api_key,
            fallback_providers=fallback_providers,
            extra_params={},
        )
        for k, v in kwargs.items():
            if hasattr(config_inst, k):
                setattr(config_inst, k, v)
            else:
                config_inst.extra_params[k] = v
        return config_inst
