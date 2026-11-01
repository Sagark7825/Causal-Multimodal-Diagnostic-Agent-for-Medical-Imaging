"""
Clinical Reasoning Engine
============================
Orchestrates the full provider-agnostic LLM-based clinical reasoning pipeline.

Flow:
  1. Build structured prompt from image findings + radiologist notes + patient data
  2. Send prompt to LLM (configured provider via factory: Ollama, OpenAI, Gemini, etc.)
  3. Parse JSON response from LLM
  4. Validate and sanitize the structured output
  5. Return comprehensive clinical reasoning result

Error Handling & Logging:
  - Detailed tracing of Provider Loaded, Selected Model, Prompt Size, Generation status
  - Never swallow exceptions silently — full stack trace logged with logger.exception
  - Dynamic live availability checks without caching stale failure states
  - Returns explicit fallback_reason when provider is genuinely unavailable
"""

import json
import logging
import re
import traceback
from typing import Dict, Any, Optional

from llm_engine.base import BaseLLMProvider
from llm_engine.factory import get_llm_client
from llm_engine.exceptions import LLMException, LLMUnavailable, LLMTimeout
from llm_engine.prompts import ClinicalPromptBuilder, PHYSICIAN_SYSTEM_PROMPT, get_system_prompt

logger = logging.getLogger(__name__)


class ClinicalReasoningEngine:
    """
    Orchestrates LLM-based clinical reasoning over multimodal evidence.
    """

    def __init__(self, llm_client: Optional[BaseLLMProvider] = None):
        """
        Args:
            llm_client: Optional pre-configured LLM client.
                        If None, auto-creates using environment config via get_llm_client()
        """
        self.llm_client     = llm_client or get_llm_client()
        self.prompt_builder = ClinicalPromptBuilder()
        logger.info(f"[LLM Pipeline] Provider Loaded: {self.llm_client.config.provider}")

    def check_llm_availability(self, force_refresh: bool = True) -> bool:
        """
        Checks LLM availability dynamically without caching stale failure states.
        """
        try:
            is_avail = self.llm_client.is_available()
            logger.info(
                f"[LLM Pipeline] Dynamic Health Check | Provider: {self.llm_client.config.provider} | "
                f"Available: {is_avail}"
            )
            return is_avail
        except Exception as e:
            logger.warning(f"[LLM Pipeline] Dynamic Health Check Error: {e}")
            return False

    def reason(
        self,
        image_findings    : Dict[str, Any],
        radiologist_notes : str = "",
        patient_data      : Dict[str, Any] = None,
        doctor_notes      : str = "",
        use_llm           : bool = True,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Main reasoning function — combines all evidence and reasons clinically.
        """
        patient_data = patient_data or {}
        # Re-fetch LLM client dynamically to ensure latest configuration and connection state
        self.llm_client = get_llm_client()

        provider = self.llm_client.config.provider
        model    = getattr(self.llm_client, "_resolve_model_name", lambda: self.llm_client.config.model)()

        logger.info(f"[ReasoningEngine] reason() called | use_llm={use_llm}")
        logger.info(f"[LLM Pipeline] Provider Loaded: {provider}")
        logger.info(f"[LLM Pipeline] Selected Provider: {provider}")
        logger.info(f"[LLM Pipeline] Selected Model: {model}")

        # Step 1: Check LLM availability dynamically
        if not self.check_llm_availability(force_refresh=True):
            reason = f"Provider '{provider}' (model '{model}') is unreachable or health check failed."
            logger.warning(f"[LLM Pipeline] Fallback Activated")
            logger.warning(f"[LLM Pipeline] Fallback Reason: {reason}")
            return self._rule_based_fallback(image_findings, radiologist_notes, patient_data, fallback_reason=reason)

        # Step 2: Build clinical reasoning prompt
        prompt = self.prompt_builder.build_reasoning_prompt(
            image_findings       = image_findings,
            radiologist_notes    = radiologist_notes,
            patient_data         = patient_data,
            doctor_clinical_notes= doctor_notes,
        )

        logger.info(f"[LLM Pipeline] Prompt Size: {len(prompt)} chars")
        logger.info(
            f"\n=========================\n"
            f"LLM REQUEST START\n"
            f"=========================\n"
            f"Provider: {provider}\n"
            f"Model: {model}\n"
            f"Prompt Length: {len(prompt)} chars\n"
            f"use_llm: {use_llm}\n"
            f"Sending request...\n"
            f"========================="
        )

        # Step 3: Call LLM via uniform interface
        try:
            llm_response = self.llm_client.generate(
                prompt        = prompt,
                system_prompt = get_system_prompt(image_findings.get("modality", "Chest X-ray")),
            )
            latency_ms = getattr(llm_response, "latency_ms", 0.0)
            latency_s  = latency_ms / 1000.0 if latency_ms else 0.0
            finish_reason = getattr(llm_response, "finish_reason", "stop")
            response_text = str(llm_response)

            if not response_text or not response_text.strip():
                raise LLMResponseError(
                    "LLM returned an empty response text",
                    provider=provider,
                    model=model,
                )

            logger.info(
                f"\n=========================\n"
                f"LLM RESPONSE\n"
                f"=========================\n"
                f"Status: SUCCESS\n"
                f"Latency: {latency_s:.2f} s\n"
                f"Characters Returned: {len(response_text)} chars\n"
                f"Finish Reason: {finish_reason}\n"
                f"========================="
            )

            logger.info(
                f"\n[LLM]\n"
                f"Provider : {provider}\n"
                f"Model    : {model}\n"
                f"Latency  : {latency_s:.1f} s\n"
                f"Prompt   : {len(prompt)} chars\n"
                f"Response : {len(response_text)} chars"
            )

        except (LLMUnavailable, LLMTimeout, ConnectionError, TimeoutError) as e:
            reason = f"Connection or timeout error: {e}"
            logger.exception(f"[LLM Pipeline] Generation Failed with exception: {e}")
            logger.warning(f"[LLM Pipeline] Fallback Activated")
            logger.warning(f"[LLM Pipeline] Fallback Reason: {reason}")
            return self._rule_based_fallback(image_findings, radiologist_notes, patient_data, fallback_reason=reason)

        except LLMException as e:
            reason = f"LLM Exception ({e.__class__.__name__}): {e}"
            logger.exception(f"[LLM Pipeline] Generation Failed with exception: {e}")
            logger.warning(f"[LLM Pipeline] Fallback Activated")
            logger.warning(f"[LLM Pipeline] Fallback Reason: {reason}")
            return self._rule_based_fallback(image_findings, radiologist_notes, patient_data, fallback_reason=reason)

        except Exception as e:
            reason = f"Unexpected generation exception ({e.__class__.__name__}): {e}\n{traceback.format_exc()}"
            logger.exception(f"[LLM Pipeline] Generation Failed with exception: {e}")
            logger.warning(f"[LLM Pipeline] Fallback Activated")
            logger.warning(f"[LLM Pipeline] Fallback Reason: {reason}")
            return self._rule_based_fallback(image_findings, radiologist_notes, patient_data, fallback_reason=reason)

        # Step 4: Parse LLM response
        parsed = self._parse_llm_response(str(llm_response))

        # Step 5: Validate and enrich the result
        result = self._enrich_result(parsed, image_findings)
        result["reasoning_source"] = "llm"
        result["llm_provider_used"] = getattr(llm_response, "provider", provider)
        result["llm_model_used"]    = getattr(llm_response, "model", model)
        result["llm_latency_ms"]    = getattr(llm_response, "latency_ms", 0.0)
        result["raw_llm_response"]  = str(llm_response)

        logger.info(
            f"[ClinicalReasoning] ✅ LLM reasoning complete | Provider: {result['llm_provider_used']} | "
            f"Model: {result['llm_model_used']} | "
            f"Diagnosis: {result.get('final_diagnosis', {}).get('name', 'Unknown')}"
        )

        return result

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Extracts and parses the JSON from the LLM response."""
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            try:
                return json.loads(json_str, strict=False)
            except json.JSONDecodeError:
                pass

        brace_start = response.find('{')
        brace_end   = response.rfind('}')
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            json_str = response[brace_start:brace_end + 1]
            try:
                return json.loads(json_str, strict=False)
            except json.JSONDecodeError as e:
                logger.warning(f"[ClinicalReasoning] JSON parse failed: {e}. Attempting repair...")
                repaired = self._repair_json(json_str)
                try:
                    return json.loads(repaired, strict=False)
                except json.JSONDecodeError:
                    pass

        logger.warning("[ClinicalReasoning] Could not parse JSON — using raw text as narrative")
        return {
            "reasoning_narrative" : response,
            "differential_diagnosis": [],
            "final_diagnosis"    : {},
            "treatment_plan"     : {},
            "uncertainty_analysis": {},
            "limitations"        : ["JSON formatting partial — raw response retained"],
        }

    def _repair_json(self, json_str: str) -> str:
        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
        json_str = re.sub(r'[\r\n\t]', ' ', json_str)
        return json_str

    def _enrich_result(self, parsed: Dict, image_findings: Dict) -> Dict:
        result = parsed.copy()
        result.setdefault("reasoning_narrative", "Reasoning not available")
        result.setdefault("differential_diagnosis", [])
        result.setdefault("limitations", [])

        if not result.get("final_diagnosis"):
            result["final_diagnosis"] = {
                "name"              : image_findings.get("disease", "Unknown"),
                "icd_10_code"       : "",
                "confidence_percent": int(image_findings.get("confidence", 0) * 100),
                "severity"          : image_findings.get("severity", "Unknown"),
                "emergency_level"   : image_findings.get("emergency_level", "Unknown"),
            }

        for item in result["differential_diagnosis"]:
            if isinstance(item, dict):
                item.setdefault("rank", 0)
                item.setdefault("probability", 0.0)
                item.setdefault("supporting_evidence", [])
                item.setdefault("against_evidence", [])
                item.setdefault("icd_10_code", "")

        if isinstance(result["differential_diagnosis"], list):
            result["differential_diagnosis"].sort(
                key=lambda x: x.get("probability", 0) if isinstance(x, dict) else 0,
                reverse=True
            )

        result.setdefault("treatment_plan", {
            "immediate_actions": [],
            "medications"      : [],
            "investigations"   : [],
            "monitoring"       : [],
            "follow_up"        : "Consult attending physician"
        })

        result.setdefault("uncertainty_analysis", {
            "overall_confidence"        : int(image_findings.get("confidence", 0) * 100),
            "main_uncertainties"        : ["Full clinical history required for definitive diagnosis"],
            "would_change_diagnosis_if" : ["Additional imaging or laboratory results"]
        })

        return result

    def _rule_based_fallback(
        self,
        image_findings : Dict[str, Any],
        radiologist_notes: str,
        patient_data   : Dict[str, Any],
        fallback_reason: str = "LLM service unavailable",
    ) -> Dict[str, Any]:
        disease    = image_findings.get("disease", "Unknown")
        confidence = image_findings.get("confidence", 0)
        severity   = image_findings.get("severity", "Unknown")
        modality   = image_findings.get("modality", "Chest X-ray")

        # ── Brain MRI differential tables (neuro-oncology) ─────────────────
        MRI_DIFFERENTIALS = {
            "Glioma"     : [("High-Grade Glioma (GBM/Grade IV)", 0.55), ("Low-Grade Glioma (Grade II/III)", 0.30), ("Brain Metastasis", 0.15)],
            "Meningioma" : [("Benign Meningioma (WHO Grade I)", 0.65), ("Atypical Meningioma (WHO Grade II)", 0.25), ("Anaplastic Meningioma (WHO Grade III)", 0.10)],
            "Pituitary"  : [("Pituitary Macroadenoma", 0.60), ("Pituitary Microadenoma", 0.30), ("Craniopharyngioma", 0.10)],
            "No Tumor"   : [("Normal Brain MRI Study", 0.85), ("Early/Subtle Pathology Not Detected", 0.10), ("Motion/Artifact Artefact", 0.05)],
        }

        # ── Chest X-ray differential tables ────────────────────────────────
        XRAY_DIFFERENTIALS = {
            "Pneumonia"        : [("Bacterial Pneumonia", 0.70), ("Viral Pneumonitis", 0.20), ("Atypical Pneumonia", 0.10)],
            "Effusion"         : [("Parapneumonic Effusion", 0.50), ("Transudative Effusion (CHF)", 0.30), ("Malignant Effusion", 0.20)],
            "Cardiomegaly"     : [("Dilated Cardiomyopathy", 0.45), ("Congestive Heart Failure", 0.40), ("Pericardial Effusion", 0.15)],
            "Pneumothorax"     : [("Spontaneous Pneumothorax", 0.60), ("Traumatic Pneumothorax", 0.30), ("Tension Pneumothorax", 0.10)],
            "Consolidation"    : [("Bacterial Pneumonia", 0.65), ("Aspiration Pneumonia", 0.25), ("Pulmonary Infarction", 0.10)],
            "Mass"             : [("Primary Lung Malignancy", 0.50), ("Lymphoma", 0.25), ("Benign Lesion", 0.25)],
            "No Finding"       : [("Normal Study", 0.95), ("Early/Subtle Findings", 0.05)],
        }

        if "mri" in modality.lower():
            differentials_raw = MRI_DIFFERENTIALS.get(
                disease,
                [(disease, 0.70), ("Alternative Neuro-Oncological Pathology", 0.20), ("Benign Variant", 0.10)]
            )
        else:
            differentials_raw = XRAY_DIFFERENTIALS.get(
                disease,
                [(disease, 0.70), ("Alternative Pathology", 0.20), ("Benign Variant", 0.10)]
            )

        differential_diagnosis = [
            {
                "rank"               : i + 1,
                "diagnosis"          : name,
                "probability"        : prob,
                "supporting_evidence": [f"AI model detected {disease} with {confidence:.1%} confidence"],
                "against_evidence"   : [],
                "icd_10_code"        : "",
            }
            for i, (name, prob) in enumerate(differentials_raw)
        ]

        narrative = (
            f"[RULE-BASED FALLBACK — Provider '{self.llm_client.config.provider}']\n"
            f"Fallback Reason: {fallback_reason}\n\n"
            f"The AI model detected '{disease}' with {confidence:.1%} confidence (severity: {severity}).\n\n"
            f"Radiologist notes: {radiologist_notes or 'None provided'}\n\n"
            f"Note: Full LLM clinical reasoning output is operating in rule-based fallback mode. "
            f"Check provider status and logs for details."
        )

        return {
            "reasoning_narrative"   : narrative,
            "differential_diagnosis": differential_diagnosis,
            "final_diagnosis"       : {
                "name"              : disease,
                "icd_10_code"       : "",
                "confidence_percent": int(confidence * 100),
                "severity"          : severity,
                "emergency_level"   : image_findings.get("emergency_level", "Unknown"),
            },
            "treatment_plan"        : {
                "immediate_actions" : ["Consult attending physician immediately"],
                "medications"       : [],
                "investigations"    : [{"test": "Complete clinical evaluation", "urgency": "IMMEDIATE", "reason": fallback_reason}],
                "monitoring"        : ["Vital signs q4h", "SpO2 monitoring"],
                "follow_up"         : "Immediate physician review required",
            },
            "uncertainty_analysis"  : {
                "overall_confidence"        : int(confidence * 100),
                "main_uncertainties"        : [f"LLM fallback active: {fallback_reason}"],
                "would_change_diagnosis_if" : ["Full clinical evaluation required"],
            },
            "limitations"           : [
                f"LLM reasoning fallback: {fallback_reason}",
                "Automated rule-based output — NOT a clinical diagnosis",
                "Qualified physician review is mandatory before any clinical decisions",
            ],
            "reasoning_source"      : "rule_based",
            "llm_provider_used"     : self.llm_client.config.provider,
            "llm_model_used"        : "none (fallback)",
            "fallback_reason"       : fallback_reason,
        }
