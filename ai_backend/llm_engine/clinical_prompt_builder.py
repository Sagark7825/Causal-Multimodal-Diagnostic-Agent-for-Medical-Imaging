"""
Clinical Prompt Builder — Backward Compatibility Wrapper
==========================================================
Re-exports ClinicalPromptBuilder and PHYSICIAN_SYSTEM_PROMPT from the llm_engine.prompts package.
"""

from llm_engine.prompts.clinical_prompts import (
    PHYSICIAN_SYSTEM_PROMPT,
    ClinicalPromptBuilder,
)

__all__ = [
    "PHYSICIAN_SYSTEM_PROMPT",
    "ClinicalPromptBuilder",
]
