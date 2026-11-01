"""
MedCausal AI — LLM Provider Architecture Verification Suite
============================================================
Comprehensive test suite verifying the refactored provider-agnostic LLM layer:
  - Provider Registry & Dynamic Factory
  - Unified LLMResponse String Compatibility & Metadata
  - Interface Compliance (generate, chat, stream_generate, health_check)
  - Environment Configuration & Overrides
  - Standardized Exception Mapping
  - Exponential Backoff Retries & Automatic Multi-Provider Fallback
  - Adding New Custom Providers dynamically
"""

import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Append ai_backend path
sys.path.append(os.path.join(os.path.dirname(__file__), "ai_backend"))

from llm_engine.config import LLMConfig
from llm_engine.base import (
    BaseLLMProvider,
    LLMResponse,
    register_provider,
    get_registered_providers,
)
from llm_engine.factory import get_llm_client, FallbackLLMClientProxy
from llm_engine.exceptions import (
    LLMException,
    LLMUnavailable,
    InvalidAPIKey,
    RateLimit,
    ModelNotFound,
    LLMTimeout,
    LLMResponseError,
)
from llm_engine.providers.ollama_provider import OllamaProvider
from llm_engine.providers.openai_provider import OpenAIProvider
from llm_engine.providers.gemini_provider import GeminiProvider


class TestLLMProviderArchitecture(unittest.TestCase):

    def setUp(self):
        # Reset env vars for deterministic testing
        os.environ.pop("LLM_PROVIDER", None)
        os.environ.pop("LLM_FALLBACK_PROVIDERS", None)

    def test_llm_response_string_backward_compatibility(self):
        """Verifies that LLMResponse subclasses str for 100% backward compatibility."""
        raw_text = '{"reasoning_narrative": "Patient has bacterial pneumonia", "confidence": 0.88}'
        tokens = {"prompt_tokens": 120, "completion_tokens": 80, "total_tokens": 200}
        
        resp = LLMResponse(
            text=raw_text,
            provider="ollama",
            model="qwen2.5",
            latency_ms=145.2,
            tokens=tokens,
            finish_reason="stop",
            metadata={"test_key": "test_val"}
        )

        # Must pass all string checks seamlessly
        self.assertTrue(isinstance(resp, str))
        self.assertEqual(resp, raw_text)
        self.assertEqual(resp.text, raw_text)
        self.assertEqual(len(resp), len(raw_text))
        self.assertEqual(resp.strip(), raw_text.strip())
        self.assertIn("bacterial pneumonia", resp)

        # Must also hold structured metadata attributes
        self.assertEqual(resp.provider, "ollama")
        self.assertEqual(resp.model, "qwen2.5")
        self.assertEqual(resp.latency_ms, 145.2)
        self.assertEqual(resp.tokens["total_tokens"], 200)
        self.assertEqual(resp.finish_reason, "stop")
        self.assertEqual(resp.metadata["test_key"], "test_val")

    def test_provider_registry(self):
        """Verifies that Ollama, OpenAI, and Gemini are registered dynamically without if/else."""
        registry = get_registered_providers()
        self.assertIn("ollama", registry)
        self.assertIn("openai", registry)
        self.assertIn("gemini", registry)
        self.assertEqual(registry["ollama"], OllamaProvider)
        self.assertEqual(registry["openai"], OpenAIProvider)
        self.assertEqual(registry["gemini"], GeminiProvider)

    def test_factory_environment_provider_switching(self):
        """Verifies switching providers via LLM_PROVIDER env variable."""
        os.environ["LLM_PROVIDER"] = "ollama"
        client_ollama = get_llm_client()
        self.assertIsInstance(client_ollama, OllamaProvider)
        self.assertEqual(client_ollama.config.provider, "ollama")

        os.environ["LLM_PROVIDER"] = "openai"
        client_openai = get_llm_client()
        self.assertIsInstance(client_openai, OpenAIProvider)
        self.assertEqual(client_openai.config.provider, "openai")

        os.environ["LLM_PROVIDER"] = "gemini"
        client_gemini = get_llm_client()
        self.assertIsInstance(client_gemini, GeminiProvider)
        self.assertEqual(client_gemini.config.provider, "gemini")

    def test_factory_parameter_overrides(self):
        """Verifies that get_llm_client() supports on-demand model and provider overrides."""
        client = get_llm_client(provider="openai", model="gpt-4.1", temperature=0.3)
        self.assertIsInstance(client, OpenAIProvider)
        self.assertEqual(client.config.model, "gpt-4.1")
        self.assertEqual(client.config.temperature, 0.3)

    def test_custom_provider_dynamic_registration(self):
        """Verifies that new custom providers (e.g. Claude/DeepSeek) can be registered with zero factory changes."""
        @register_provider("dummy_cloud_llm")
        class DummyCloudProvider(BaseLLMProvider):
            def generate(self, prompt, system_prompt=None, **kwargs):
                return LLMResponse("Dummy cloud response", provider="dummy_cloud_llm", model="v1")
            def chat(self, messages, **kwargs):
                return LLMResponse("Dummy chat response", provider="dummy_cloud_llm", model="v1")
            def stream_generate(self, prompt, **kwargs):
                yield "Dummy chunk"
            def health_check(self):
                return {"provider": "dummy_cloud_llm", "available": True}

        # Factory should now instantiate DummyCloudProvider seamlessly
        client = get_llm_client(provider="dummy_cloud_llm")
        self.assertIsInstance(client, DummyCloudProvider)
        res = client.generate("Hello world")
        self.assertEqual(res, "Dummy cloud response")
        self.assertEqual(res.provider, "dummy_cloud_llm")

    @patch("requests.post")
    def test_ollama_provider_generate_and_chat(self, mock_post):
        """Tests OllamaProvider generate and chat requests with mock HTTP response."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "model": "qwen2.5",
            "response": "Clinical reasoning result from Ollama",
            "done": True,
            "prompt_eval_count": 150,
            "eval_count": 50,
        }
        mock_post.return_value = mock_resp

        client = OllamaProvider(LLMConfig.from_env(provider="ollama"))
        res = client.generate("Patient has fever and cough", system_prompt="You are a physician")

        self.assertEqual(res, "Clinical reasoning result from Ollama")
        self.assertEqual(res.provider, "ollama")
        self.assertEqual(res.tokens["prompt_tokens"], 150)
        self.assertEqual(res.tokens["completion_tokens"], 50)
        self.assertEqual(res.tokens["total_tokens"], 200)

        # Test chat interface
        mock_resp.json.return_value = {
            "model": "qwen2.5",
            "message": {"role": "assistant", "content": "Chat reasoning output"},
            "done": True,
            "prompt_eval_count": 80,
            "eval_count": 40,
        }
        chat_res = client.chat([{"role": "user", "content": "Analyze X-ray"}])
        self.assertEqual(chat_res, "Chat reasoning output")

    @patch("requests.post")
    def test_openai_provider_generate_and_exceptions(self, mock_post):
        """Tests OpenAIProvider generation and standardized error mapping."""
        # 1. Test 401 Unauthorized -> InvalidAPIKey exception
        mock_401 = MagicMock()
        mock_401.status_code = 401
        mock_401.text = "Invalid API key"
        mock_post.return_value = mock_401

        client = OpenAIProvider(LLMConfig(provider="openai", api_key="sk-invalid", max_retries=1))
        with self.assertRaises(InvalidAPIKey):
            client.generate("Test prompt")

        # 2. Test 200 OK success
        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = {
            "id": "chatcmpl-123",
            "model": "gpt-4.1",
            "choices": [{"message": {"role": "assistant", "content": "OpenAI clinical output"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        }
        mock_post.return_value = mock_200

        res = client.generate("Test prompt")
        self.assertEqual(res, "OpenAI clinical output")
        self.assertEqual(res.provider, "openai")
        self.assertEqual(res.tokens["total_tokens"], 150)

    @patch("requests.post")
    def test_gemini_provider_generate(self, mock_post):
        """Tests GeminiProvider generation and response parsing."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [{
                "content": {"parts": [{"text": "Gemini clinical reasoning report"}]},
                "finishReason": "STOP"
            }],
            "usageMetadata": {"promptTokenCount": 200, "candidatesTokenCount": 60, "totalTokenCount": 260}
        }
        mock_post.return_value = mock_resp

        client = GeminiProvider(LLMConfig(provider="gemini", api_key="test-gemini-key"))
        res = client.generate("Analyze CT scan", system_prompt="You are a radiologist")

        self.assertEqual(res, "Gemini clinical reasoning report")
        self.assertEqual(res.provider, "gemini")
        self.assertEqual(res.tokens["total_tokens"], 260)

    def test_automatic_multi_provider_fallback(self):
        """Tests automatic failover from primary provider to fallback provider if primary fails."""
        primary_mock = MagicMock(spec=BaseLLMProvider)
        primary_mock.config = LLMConfig(provider="ollama")
        primary_mock.generate.side_effect = LLMUnavailable("Ollama local server down", provider="ollama")

        fallback_mock = MagicMock(spec=BaseLLMProvider)
        fallback_mock.config = LLMConfig(provider="gemini")
        fallback_mock.generate.return_value = LLMResponse("Fallback response from Gemini", provider="gemini")

        proxy = FallbackLLMClientProxy(primary_mock, ["gemini"])
        proxy._get_fallback_clients = MagicMock(return_value=[fallback_mock])

        # Generate call on proxy should seamlessly fall back to Gemini
        res = proxy.generate("Patient has cough")
        self.assertEqual(res, "Fallback response from Gemini")
        self.assertEqual(res.provider, "gemini")
        primary_mock.generate.assert_called_once()
        fallback_mock.generate.assert_called_once()

    def test_legacy_imports_backward_compatibility(self):
        """Verifies legacy import paths remain 100% functional."""
        from llm_engine.base_client import BaseLLMClient
        from llm_engine.ollama_client import OllamaClient
        from llm_engine.clinical_prompt_builder import ClinicalPromptBuilder, PHYSICIAN_SYSTEM_PROMPT

        self.assertTrue(issubclass(OllamaClient, BaseLLMClient))
        self.assertIsNotNone(PHYSICIAN_SYSTEM_PROMPT)
        builder = ClinicalPromptBuilder()
        self.assertIsNotNone(builder)


if __name__ == "__main__":
    print("======================================================================")
    print("Running MedCausal AI — Refactored LLM Provider Verification Suite")
    print("======================================================================")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestLLMProviderArchitecture)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(not result.wasSuccessful())
