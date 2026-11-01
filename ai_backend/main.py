"""
FastAPI AI Backend — Main Entry Point
======================================
MedCausal AI Diagnostic Backend serving:
  - /api/v1/diagnose      : Full multimodal diagnostic pipeline
  - /api/v1/causal/what-if: Counterfactual analysis
  - /api/v1/llm/health    : LLM availability check
  - /api/v1/model/info    : Model information
"""

import os
import json
import shutil
import tempfile
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional

import pydicom
from agents_workflow import run_agentic_diagnosis
from causal_engine import CausalDiagnosticEngine
from llm_engine.factory import get_llm_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("MedCausalAPI")

app = FastAPI(
    title="MedCausal AI Diagnostic Backend",
    version="2.0.0",
    description=(
        "Multi-Modal Causal Diagnostic Platform — "
        "DenseNet121 + Ollama/Qwen2.5 Clinical Reasoning"
    ),
)

# CORS — allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
causal_engine = CausalDiagnosticEngine()


# =============================================================================
# Request/Response Models
# =============================================================================

class WhatIfRequest(BaseModel):
    baseline_disease: str
    baseline_prob   : float
    interventions   : Dict[str, Any]


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.get("/")
def read_root():
    return {
        "message": "MedCausal AI Engine v2.0 Running",
        "backend": "FastAPI + LangGraph",
        "model"  : "DenseNet121 (NIH ChestX-ray14)",
        "llm"    : "Ollama / Qwen2.5",
    }


@app.get("/api/v1/llm/health")
def llm_health_check():
    """Check if the configured LLM provider and model are available."""
    try:
        client      = get_llm_client()
        health      = client.health_check()
        is_available= health.get("available", False)
        model_info  = client.get_model_info()
        return {
            "success"      : True,
            "llm_available": is_available,
            "provider"     : health.get("provider", client.config.provider),
            "model"        : health.get("model", client.config.model),
            "latency_ms"   : health.get("latency_ms", 0.0),
            "version"      : health.get("version", "1.0"),
            "details"      : health.get("details", {}),
            "model_info"   : model_info,
            "message"      : f"LLM provider '{client.config.provider}' ready" if is_available else (
                f"LLM provider '{client.config.provider}' not available."
            ),
        }
    except Exception as e:
        return {
            "success"      : False,
            "llm_available": False,
            "error"        : str(e),
        }


@app.get("/api/v1/model/info")
def model_info():
    """Returns information about the loaded chest X-ray model."""
    try:
        from inference_engine import get_inference_engine
        engine = get_inference_engine()
        return {
            "success"        : True,
            "backbone"       : engine.backbone_name,
            "device"         : str(engine.device),
            "num_classes"    : 14,
            "dataset"        : "NIH ChestX-ray14",
            "model_loaded"   : engine._is_loaded,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# Main Diagnostic Endpoint
# =============================================================================

@app.post("/api/v1/diagnose")
async def diagnose(
    modality         : str = Form("Chest X-ray"),
    clinical_notes   : str = Form(""),
    patient_id       : str = Form("PT-1001"),
    radiologist_notes: str = Form(""),
    doctor_notes     : str = Form(""),
    use_llm          : bool = Form(True),
    # Full structured patient data as JSON string
    patient_data_json: str = Form("{}"),
    file             : Optional[UploadFile] = File(None),
):
    """
    Full diagnostic pipeline endpoint.
    """
    temp_file_path = ""
    dicom_metadata = {}

    # Parse patient data JSON
    try:
        patient_data = json.loads(patient_data_json) if patient_data_json else {}
    except json.JSONDecodeError:
        patient_data = {}
        logger.warning(f"Failed to parse patient_data_json — using empty dict")

    # Handle file upload
    if file:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # Parse DICOM metadata if applicable
        if file.filename and file.filename.lower().endswith('.dcm'):
            try:
                ds = pydicom.dcmread(temp_file_path, stop_before_pixels=True)
                dicom_metadata = {
                    "Patient Name" : str(ds.get("PatientName", "Unknown")),
                    "Patient ID"   : str(ds.get("PatientID", "Unknown")),
                    "Patient Sex"  : str(ds.get("PatientSex", "Unknown")),
                    "Modality"     : str(ds.get("Modality", "Unknown")),
                    "Study Date"   : str(ds.get("StudyDate", "Unknown")),
                    "Manufacturer" : str(ds.get("Manufacturer", "Unknown")),
                    "Window Center": str(ds.get("WindowCenter", "1024")),
                    "Window Width" : str(ds.get("WindowWidth", "2048")),
                }
                # Update patient_data with DICOM info
                if "Unknown" not in dicom_metadata["Patient Name"]:
                    patient_data.setdefault("name", dicom_metadata["Patient Name"])
                if "Unknown" not in dicom_metadata["Patient Sex"]:
                    patient_data.setdefault("gender", dicom_metadata["Patient Sex"])
            except Exception as dcm_err:
                logger.warning(f"DICOM parse failed: {dcm_err}")
                dicom_metadata = {"status": "Parse failure", "error": str(dcm_err)}

    logger.info(
        f"[API] Diagnose request | Patient: {patient_id} | Modality: {modality} | "
        f"File: {bool(temp_file_path)} | Radiologist notes: {bool(radiologist_notes)} | "
        f"Use LLM: {use_llm} | Patient data keys: {list(patient_data.keys())}"
    )

    try:
        # Run the full 13-agent diagnostic pipeline
        result = run_agentic_diagnosis(
            patient_id        = patient_id,
            modality          = modality,
            file_path         = temp_file_path if temp_file_path else "",
            clinical_notes    = clinical_notes,
            patient_data      = patient_data,
            radiologist_notes = radiologist_notes,
            doctor_notes      = doctor_notes,
            use_llm           = use_llm,
        )

        result["dicom_metadata"] = dicom_metadata

        logger.info(
            f"[API] Diagnosis complete | "
            f"Disease: {result.get('ai_prediction', {}).get('disease', 'Unknown')} | "
            f"Agents: {len(result.get('trace_logs', []))}"
        )

        return result

    except Exception as err:
        logger.error(f"[API] Diagnosis failed: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(err))
    finally:
        # Always clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


# =============================================================================
# Causal What-If Analysis
# =============================================================================

@app.post("/api/v1/causal/what-if")
def causal_what_if(req: WhatIfRequest):
    """
    Runs a counterfactual 'What-If' simulation.
    
    Example: What would happen to the diagnosis probability if the
    patient's Opacity finding was absent? (do(Opacity=0))
    """
    try:
        result = causal_engine.simulate_counterfactual(
            baseline_disease=req.baseline_disease,
            baseline_prob   =req.baseline_prob,
            interventions   =req.interventions,
        )
        return {"success": True, "counterfactual": result}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
