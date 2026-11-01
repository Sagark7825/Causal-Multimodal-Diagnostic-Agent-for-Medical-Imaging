# LLM Provider Architecture & Developer Guide 🩺

> **Provider-Agnostic, Production-Ready LLM Layer for MedCausal AI Backend.**

This package abstracts LLM provider implementations (**Ollama**, **OpenAI**, **Gemini**, etc.) behind a single, unified interface (`BaseLLMProvider`) and a dynamic factory (`get_llm_client()`).

The rest of the medical AI pipeline never depends on any specific provider. You can switch from **Ollama** to **OpenAI** or **Gemini** simply by changing the `LLM_PROVIDER` environment variable — with **zero changes to application code**.

---

## 🚀 Quickstart: Switching Providers via `.env`

To switch providers, update the `LLM_PROVIDER` variable in your `.env` file or shell environment:

### Option 1: Use Local Ollama (Default)
```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5
OLLAMA_HOST=http://localhost:11434
```

### Option 2: Switch to OpenAI
```env
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4.1
OPENAI_API_KEY=sk-proj-your-api-key-here
```

### Option 3: Switch to Google Gemini
```env
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-pro
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```

---

## 🛠️ Architecture Overview

```
llm_engine/
│
├── base.py                 # Abstract Base Class (BaseLLMProvider), LLMResponse, and Provider Registry
├── base_client.py          # Backward-compatibility wrapper for legacy imports
├── config.py               # Centralized configuration & environment loader
├── exceptions.py           # Standardized exception hierarchy (LLMUnavailable, InvalidAPIKey, etc.)
├── factory.py              # Dynamic Provider Factory & Automatic Multi-Provider Fallback Proxy
├── ollama_client.py        # Backward-compatibility wrapper
├── reasoning_engine.py     # Physician reasoning pipeline using get_llm_client()
│
├── providers/              # Provider implementations
│   ├── base_provider.py    # Common provider helper (retries, logging, HTTP error translation)
│   ├── ollama_provider.py  # Local Ollama REST provider
│   ├── openai_provider.py  # OpenAI v1 REST provider
│   └── gemini_provider.py  # Google Gemini v1beta REST provider
│
└── prompts/                # Provider-independent prompts & prompt builder
    └── clinical_prompts.py # Clinical reasoning prompt templates
```

---

## 🔑 Key Architectural Features

### 1. Unified `LLMResponse` Object
All `generate()` and `chat()` calls return an `LLMResponse` object containing:
- `.text` / `str(response)` : Generated output text
- `.provider` : Provider name (`"ollama"`, `"openai"`, `"gemini"`)
- `.model` : Model name used (`"qwen2.5"`, `"gpt-4.1"`, etc.)
- `.latency_ms` : Request latency in milliseconds
- `.tokens` : Token counts (`prompt_tokens`, `completion_tokens`, `total_tokens`)
- `.finish_reason` : Generation finish reason (`"stop"`, `"length"`)
- `.metadata` : Additional raw provider metadata

> **Zero-Breakage Compatibility:** `LLMResponse` subclasses Python's built-in `str`. Legacy code expecting a string (e.g., `len(response)`, `response.strip()`, `json.loads(response)`) continues to work without modification!

### 2. Provider Registry (`@register_provider`)
Adding a provider requires no long `if/else` chains in factory logic. Providers self-register using a decorator:
```python
from llm_engine.base import register_provider, BaseLLMProvider

@register_provider("myprovider")
class MyCustomProvider(BaseLLMProvider):
    ...
```

### 3. Dynamic Factory (`get_llm_client()`)
Application code requests an LLM client solely via:
```python
from llm_engine.factory import get_llm_client

client = get_llm_client()  # Loads active provider from LLM_PROVIDER env
```
You can also override parameters on demand:
```python
client = get_llm_client(provider="openai", model="gpt-4.1", temperature=0.2)
```

### 4. Unified Exceptions
All HTTP status codes and SDK errors are mapped to standardized exceptions:
- `LLMException` (Base)
- `LLMUnavailable` (503 / connection failure)
- `InvalidAPIKey` (401 Unauthorized)
- `ModelNotFound` (404 Not Found)
- `RateLimit` (429 Rate Limit)
- `LLMTimeout` (Timeout)
- `LLMResponseError` (Malformed JSON / empty response)

### 5. Multi-Provider Automatic Fallback
Set fallback providers to automatically failover if the primary provider is down:
```env
LLM_PROVIDER=ollama
LLM_FALLBACK_PROVIDERS=gemini,openai
```

---

## ➕ How to Add a New Provider in 3 Simple Steps

To add support for a new provider (e.g. **Anthropic Claude**, **DeepSeek**, **Mistral**, or **vLLM**):

1. **Create provider file:** `llm_engine/providers/claude_provider.py`
2. **Implement `BaseProvider` and annotate with `@register_provider`:**
   ```python
   from llm_engine.base import register_provider, LLMResponse
   from llm_engine.providers.base_provider import BaseProvider

   @register_provider("claude", "anthropic")
   class ClaudeProvider(BaseProvider):
       def generate(self, prompt, system_prompt=None, **kwargs) -> LLMResponse:
           # Call Anthropic API
           ...
       def chat(self, messages, **kwargs) -> LLMResponse:
           ...
       def stream_generate(self, prompt, **kwargs):
           ...
       def health_check(self) -> dict:
           ...
   ```
3. **Import in `llm_engine/providers/__init__.py`:**
   ```python
   from llm_engine.providers.claude_provider import ClaudeProvider
   ```

That's it! Now setting `LLM_PROVIDER=claude` automatically routes all requests to your new provider. Zero changes to FastAPI routes or LangGraph agent workflows!
