"""
Prompts Package
================
Exposes clinical prompt builder and system prompts.
"""

from llm_engine.prompts.clinical_prompts import (
    PHYSICIAN_SYSTEM_PROMPT,
    MRI_PHYSICIAN_SYSTEM_PROMPT,
    get_system_prompt,
    ClinicalPromptBuilder,
)

__all__ = [
    "PHYSICIAN_SYSTEM_PROMPT",
    "MRI_PHYSICIAN_SYSTEM_PROMPT",
    "get_system_prompt",
    "ClinicalPromptBuilder",
]
