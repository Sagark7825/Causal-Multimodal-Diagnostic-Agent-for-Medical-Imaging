"""
Clinical Reasoning Prompt Builder
====================================
Constructs structured clinical reasoning prompts for LLM providers.
Provider-independent prompt definitions and prompt builder class.
"""

import json
from typing import Dict, Any, List, Optional


# ─────────────────────────────────────────────────────────────────────────────
# Modality-aware system prompts
# ─────────────────────────────────────────────────────────────────────────────

PHYSICIAN_SYSTEM_PROMPT = """You are an expert clinical AI assistant representing a senior pulmonologist with 20 years of experience, working collaboratively with a board-certified radiologist.

Your role is to perform step-by-step clinical reasoning about chest X-ray findings, NOT to generate templated reports.

CRITICAL RULES YOU MUST FOLLOW:
1. NEVER invent findings not present in the provided evidence
2. ALWAYS cite specific data points from the image findings, radiologist notes, and clinical data
3. ALWAYS reason through differential diagnosis — do NOT jump to conclusions
4. ALWAYS quantify your confidence and explain uncertainty
5. ALWAYS recommend follow-up investigations when uncertain
6. Consider the complete clinical picture: image + symptoms + vitals + history
7. Format your final output as valid JSON as specified in the prompt

You think and reason like a real physician — methodically, evidence-based, and humble about uncertainty."""

# Brain MRI-specific system prompt — used when modality contains "mri"
MRI_PHYSICIAN_SYSTEM_PROMPT = """You are an expert clinical AI assistant representing a senior neuro-oncologist and diagnostic neuroradiologist with 20 years of experience.

Your role is to perform step-by-step clinical reasoning about Brain MRI findings produced by an EfficientNet-B0 classifier trained exclusively on four brain tumor categories.

IMAGING MODEL SCOPE — ABSOLUTE CONSTRAINTS:
  The deep-learning model for this case is a BRAIN MRI TUMOR CLASSIFIER.
  Its ONLY valid output classes are:
    1. Glioma
    2. Meningioma
    3. Pituitary (Adenoma)
    4. No Tumor

CRITICAL RULES YOU MUST FOLLOW:
1. ONLY interpret the four imaging classes listed above. Do NOT introduce Chest X-ray findings such as Pneumonia, Opacity, Consolidation, Edema, Cardiomegaly, Mass (pulmonary), Atelectasis, Nodule, Pleural Effusion, Pneumothorax, or any other thoracic pathology.
2. NEVER add imaging predictions that were not produced by the model or stated by the clinician.
3. ALWAYS cite specific probability values from the model output when referencing model findings.
4. ALWAYS reason through neuro-oncological differential diagnosis — do NOT jump to conclusions.
5. ALWAYS quantify your confidence and explain uncertainty.
6. ALWAYS recommend appropriate neurosurgical, neurological, or radiological follow-up.
7. Consider the complete clinical picture: Brain MRI findings + patient demographics + neurological symptoms + medical history.
8. Format your final output as valid JSON as specified in the prompt.

You think and reason like a real neuro-oncologist — methodically, evidence-based, and humble about uncertainty."""


def get_system_prompt(modality: str = "Chest X-ray") -> str:
    """Returns the appropriate system prompt for the given imaging modality."""
    if "mri" in modality.lower():
        return MRI_PHYSICIAN_SYSTEM_PROMPT
    return PHYSICIAN_SYSTEM_PROMPT


class ClinicalPromptBuilder:
    """
    Builds structured clinical reasoning prompts from multimodal evidence.
    """

    def build_reasoning_prompt(
        self,
        image_findings       : Dict[str, Any],
        radiologist_notes    : str,
        patient_data         : Dict[str, Any],
        doctor_clinical_notes: str,
    ) -> str:
        findings_section    = self._format_image_findings(image_findings)
        patient_section     = self._format_patient_data(patient_data)
        radiologist_section = self._format_radiologist_notes(radiologist_notes)
        clinical_section    = self._format_clinical_notes(doctor_clinical_notes)

        modality = image_findings.get("modality", "Chest X-ray") if isinstance(image_findings, dict) else "Chest X-ray"
        is_mri   = "mri" in modality.lower()

        specialist_role = "neuro-oncologist and diagnostic neuroradiologist" if is_mri else "experienced pulmonologist and radiologist"
        case_title = f"{modality} case"

        if is_mri:
            modality_guard = (
                "\n[MODALITY GUARD] This is a BRAIN MRI case. The imaging model outputs ONLY:\n"
                "  Glioma | Meningioma | Pituitary | No Tumor\n"
                "Do NOT introduce Pneumonia, Opacity, Consolidation, Edema, Cardiomegaly,\n"
                "Mass (pulmonary), Atelectasis, Pleural Effusion, Pneumothorax, or any\n"
                "other chest/thoracic pathology anywhere in your response.\n"
            )
            step1 = (
                "STEP 1 - MRI CLASSIFICATION FINDINGS:\n"
                "Describe and interpret the AI-detected brain tumor category. What does the predicted class "
                "(Glioma, Meningioma, Pituitary, or No Tumor) indicate anatomically and clinically? "
                "Reference the specific model probability values."
            )
            step2 = (
                "STEP 2 - CLINICAL SIGNIFICANCE:\n"
                "For the predicted brain tumor category, explain its clinical importance — typical growth pattern, "
                "WHO grade implications, and neurological effects."
            )
            step3 = (
                "STEP 3 - FINDINGS-SYMPTOMS CORRELATION:\n"
                "How do the Brain MRI model findings correlate with the patient's reported neurological symptoms "
                "(headache, seizure, visual changes, focal deficits, etc.)? Where do they agree or conflict?"
            )
            step4 = (
                "STEP 4 - NEURO-ONCOLOGICAL DIFFERENTIAL DIAGNOSIS (most likely first):\n"
                "List at least 3 neuro-oncological diagnoses consistent with the AI model output and clinical data. "
                "For each, explain what evidence supports and what argues against it. "
                "DO NOT list any Chest X-ray or pulmonary pathologies."
            )
            step5 = (
                "STEP 5 - LEADING DIAGNOSIS REASONING:\n"
                "Which brain tumor category is most likely and WHY? Explain the reasoning chain specifically: "
                "probability values, patient age/gender, typical imaging pattern, symptom profile."
            )
            step6 = (
                "STEP 6 - CONFLICTING EVIDENCE:\n"
                "Are there any neurological or imaging features that don't fit the leading brain tumor category? "
                "How do you explain them? Does this change your diagnostic confidence?"
            )
        else:
            modality_guard = ""
            step1 = (
                "STEP 1 - RADIOLOGICAL FINDINGS ANALYSIS:\n"
                "Describe and interpret every significant AI-detected finding. What does each opacity, consolidation, "
                "or structural change indicate? Reference specific confidence scores."
            )
            step2 = (
                "STEP 2 - CLINICAL SIGNIFICANCE:\n"
                "For each radiological finding, explain its clinical importance. "
                "Why does it matter? What pathophysiological process does it represent?"
            )
            step3 = (
                "STEP 3 - FINDINGS-SYMPTOMS CORRELATION:\n"
                "How do the image findings correlate with the patient's reported symptoms, vital signs, and "
                "laboratory values? Where do they agree or conflict?"
            )
            step4 = (
                "STEP 4 - DIFFERENTIAL DIAGNOSIS (most likely first):\n"
                "List at least 3 possible diagnoses based on ALL available evidence. For each, explain what evidence "
                "supports it and what evidence argues against it."
            )
            step5 = (
                "STEP 5 - LEADING DIAGNOSIS REASONING:\n"
                "Which diagnosis is most likely and WHY? Explain the reasoning chain specifically: what combination "
                "of features makes this the primary diagnosis?"
            )
            step6 = (
                "STEP 6 - CONFLICTING EVIDENCE:\n"
                "Are there any findings that DON'T fit the leading diagnosis? How do you explain them? "
                "Does the conflict change your confidence?"
            )

        prompt = f"""
You are analyzing a {case_title}. Below is all available clinical evidence. Perform STEP-BY-STEP clinical reasoning as a senior {specialist_role} would in a case conference.
{modality_guard}
===============================================================
SECTION 1: DEEP LEARNING IMAGE ANALYSIS (Automated AI Results)
===============================================================
{findings_section}

===============================================================
SECTION 2: RADIOLOGIST OBSERVATIONS
===============================================================
{radiologist_section}

===============================================================
SECTION 3: PATIENT DEMOGRAPHICS & HISTORY
===============================================================
{patient_section}

===============================================================
SECTION 4: ATTENDING PHYSICIAN CLINICAL NOTES
===============================================================
{clinical_section}

===============================================================
YOUR TASK: CLINICAL REASONING (10-STEP FRAMEWORK)
===============================================================

Perform the following reasoning steps. Be thorough. Use the actual data above - do NOT add fictional findings.

{step1}

{step2}

{step3}

{step4}

{step5}

{step6}

STEP 7 - UNCERTAINTY QUANTIFICATION:
How confident are you in this diagnosis on a scale of 0-100%? What are the main sources of uncertainty? What information would most change your diagnosis?

STEP 8 - ADDITIONAL INVESTIGATIONS:
What tests, imaging, or procedures should be ordered to confirm/exclude diagnoses? Prioritize them by urgency (IMMEDIATE / WITHIN 24 HOURS / WITHIN 1 WEEK).

STEP 9 - LIMITATIONS:
What are the limitations of this analysis? What is the AI model uncertain about? What cannot be determined from imaging alone?

STEP 10 - FINAL DIAGNOSIS & TREATMENT PLAN:
State your final diagnosis and recommended treatment approach, including medications, monitoring parameters, and follow-up schedule.

===============================================================
REQUIRED OUTPUT FORMAT
===============================================================

After completing your reasoning, provide your structured output as a SINGLE JSON object:

{{
  "reasoning_narrative": "Your complete step-by-step reasoning in plain text (all 10 steps). This should be a detailed clinical discussion, 400-800 words.",
  
  "differential_diagnosis": [
    {{
      "rank": 1,
      "diagnosis": "Primary diagnosis name",
      "probability": 0.85,
      "supporting_evidence": ["Evidence point 1", "Evidence point 2"],
      "against_evidence": ["Conflicting finding 1"],
      "icd_10_code": "J18.9"
    }},
    {{
      "rank": 2,
      "diagnosis": "Alternative diagnosis name",
      "probability": 0.10,
      "supporting_evidence": ["..."],
      "against_evidence": ["..."],
      "icd_10_code": "..."
    }},
    {{
      "rank": 3,
      "diagnosis": "Third possibility",
      "probability": 0.05,
      "supporting_evidence": ["..."],
      "against_evidence": ["..."],
      "icd_10_code": "..."
    }}
  ],
  
  "final_diagnosis": {{
    "name": "Primary diagnosis",
    "icd_10_code": "J18.9",
    "confidence_percent": 85,
    "severity": "Moderate",
    "emergency_level": "High"
  }},
  
  "treatment_plan": {{
    "immediate_actions": ["Action 1 (do immediately)", "Action 2"],
    "medications": [
      {{
        "name": "Drug name",
        "dosage": "500mg",
        "route": "Oral",
        "frequency": "Three times daily",
        "duration": "7 days",
        "precautions": "Important warnings"
      }}
    ],
    "investigations": [
      {{
        "test": "Test name",
        "urgency": "IMMEDIATE",
        "reason": "Why this test is needed"
      }}
    ],
    "monitoring": ["Parameter to monitor 1", "Parameter 2"],
    "follow_up": "Follow-up schedule and conditions for escalation"
  }},
  
  "uncertainty_analysis": {{
    "overall_confidence": 85,
    "main_uncertainties": ["Uncertainty 1", "Uncertainty 2"],
    "would_change_diagnosis_if": ["Finding that would change diagnosis"]
  }},
  
  "limitations": ["Limitation 1", "Limitation 2"]
}}

IMPORTANT: Return ONLY valid JSON after the reasoning. No extra text outside the JSON.
"""
        return prompt.strip()

    def _format_image_findings(self, findings: Dict[str, Any]) -> str:
        if not findings:
            return "No AI image analysis available."
        lines = []
        modality        = findings.get("modality", "Chest X-ray")
        task            = findings.get("task", "Pathology Detection")
        primary_disease = findings.get("disease", findings.get("prediction", "Unknown"))
        confidence      = findings.get("confidence", 0)
        severity        = findings.get("severity")
        risk_score      = findings.get("risk_score")
        emergency       = findings.get("emergency_level")

        lines.append(f"PRIMARY AI PREDICTION:")
        lines.append(f"  Modality      : {modality}")
        if task:
            lines.append(f"  Task          : {task}")
        lines.append(f"  Finding/Class : {primary_disease}")
        lines.append(f"  Model Confidence / Probability: {confidence:.1%}")
        if severity and severity != "Unknown":
            lines.append(f"  Severity      : {severity}")
        if emergency and emergency != "Unknown":
            lines.append(f"  Emergency Level: {emergency}")
        if risk_score and risk_score > 0:
            lines.append(f"  Risk Score    : {risk_score}/100")

        positive_findings = findings.get("positive_findings", [])
        if positive_findings:
            lines.append(f"\nAI-DETECTED POSITIVE FINDINGS ({len(positive_findings)} detected):")
            for f in sorted(positive_findings, key=lambda x: x["confidence"], reverse=True):
                lines.append(
                    f"  * {f['name']:<25} | Confidence: {f['confidence']:.1%} "
                    f"| Clinical: {f.get('clinical_significance', 'Review required')}"
                )

        top_findings = findings.get("top_findings", [])
        if top_findings:
            lines.append(f"\nTOP AI FINDINGS BY PROBABILITY:")
            for f in top_findings:
                status = "POSITIVE" if f.get("predicted_positive") else "negative"
                lines.append(
                    f"  {'*' if status == 'POSITIVE' else '-'} "
                    f"{f['name']:<25} | {f['confidence']:.1%} | [{status}]"
                )

        raw_probs = findings.get("raw_probabilities", findings.get("probabilities", {}))
        if raw_probs:
            lines.append(f"\nMODEL PROBABILITY DISTRIBUTION ({len(raw_probs)} classes):")
            for cls, prob in sorted(raw_probs.items(), key=lambda x: x[1], reverse=True):
                bar = "#" * int(prob * 20) + "-" * (20 - int(prob * 20))
                lines.append(f"  {cls:<25} | {bar} | {prob:.4f}")

        indicators = findings.get("indicators", {})
        if indicators:
            lines.append(f"\nIMAGE QUALITY & CLINICAL INDICATORS:")
            for k, v in indicators.items():
                lines.append(f"  {k:<25}: {v}")

        return "\n".join(lines)

    def _format_radiologist_notes(self, notes: str) -> str:
        if not notes or notes.strip() == "":
            return (
                "No radiologist observations provided.\n"
                "Note: The attending radiologist has not yet reviewed this case. "
                "AI findings should be interpreted with appropriate clinical caution."
            )
        return (
            f"RADIOLOGIST OBSERVATIONS:\n"
            f"{notes.strip()}\n\n"
            f"Note: These are the expert radiologist's findings after reviewing the image."
        )

    def _format_patient_data(self, patient_data: Dict[str, Any]) -> str:
        if not patient_data:
            return "No patient demographic or clinical data provided."

        lines = []
        name    = patient_data.get("name", "Anonymous")
        age     = patient_data.get("age", "Unknown")
        gender  = patient_data.get("gender", "Unknown")
        lines.append(f"PATIENT: {name} | Age: {age} | Gender: {gender}")

        vitals = patient_data.get("vitalSigns", patient_data.get("vitals", {}))
        if vitals:
            lines.append("\nVITAL SIGNS:")
            vmap = {
                "temperature" : ("Temperature", "°C"),
                "heartRate"   : ("Heart Rate",  "bpm"),
                "bpSystolic"  : ("BP Systolic", "mmHg"),
                "bpDiastolic" : ("BP Diastolic","mmHg"),
                "spo2"        : ("SpO2",        "%"),
                "respiratoryRate": ("Resp Rate","bpm"),
            }
            for key, (label, unit) in vmap.items():
                val = vitals.get(key, vitals.get(key.lower()))
                if val is not None:
                    lines.append(f"  {label:<20}: {val} {unit}")

        symptoms = patient_data.get("currentSymptoms", patient_data.get("symptoms", ""))
        if symptoms:
            lines.append(f"\nCURRENT SYMPTOMS:\n  {symptoms}")

        history = patient_data.get("medicalHistory", patient_data.get("history", ""))
        if history:
            lines.append(f"\nMEDICAL HISTORY:\n  {history}")

        smoking = patient_data.get("smokingHistory", patient_data.get("smoking", ""))
        if smoking:
            lines.append(f"\nSMOKING HISTORY: {smoking}")

        medications = patient_data.get("currentMedications", patient_data.get("medications", ""))
        if medications:
            lines.append(f"\nCURRENT MEDICATIONS:\n  {medications}")

        allergies = patient_data.get("allergies", "")
        if allergies:
            lines.append(f"\nALLERGIES: {allergies}")

        lab_values = patient_data.get("labValues", patient_data.get("labs", {}))
        if lab_values:
            lines.append("\nLABORATORY VALUES:")
            for k, v in lab_values.items():
                lines.append(f"  {k:<20}: {v}")

        return "\n".join(lines)

    def _format_clinical_notes(self, notes: str) -> str:
        if not notes or notes.strip() == "":
            return "No additional clinical notes from the attending physician."
        return f"ATTENDING PHYSICIAN NOTES:\n{notes.strip()}"

    def build_summary_prompt(self, full_reasoning_result: Dict[str, Any]) -> str:
        final_diag = full_reasoning_result.get("final_diagnosis", {})
        prompt = f"""
Based on the following medical diagnosis:
- Diagnosis: {final_diag.get('name', 'Unknown')}
- Severity: {final_diag.get('severity', 'Unknown')}
- Confidence: {final_diag.get('confidence_percent', 0)}%

Write a brief, compassionate, patient-friendly explanation (3-4 sentences max):
- What was found
- What it means for the patient
- What happens next
- Use simple language, avoid medical jargon

Keep it under 100 words. Be reassuring but accurate.
"""
        return prompt.strip()
