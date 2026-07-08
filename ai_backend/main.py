import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional

import pydicom
from agents_workflow import run_agentic_diagnosis
from causal_engine import CausalDiagnosticEngine

app = FastAPI(
  title="MedCausal AI Diagnostic Backend",
  version="1.0.0",
  description="Multi-Modal Causal Diagnostic Platform Services"
)

# Configure CORS
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

causal_engine = CausalDiagnosticEngine()

class WhatIfRequest(BaseModel):
  baseline_disease: str
  baseline_prob: float
  interventions: Dict[str, Any]

@app.get("/")
def read_root():
  return {"message": "MedCausal AI Engine Running (FastAPI + LangGraph)"}

@app.post("/api/v1/diagnose")
async def diagnose(
  modality: str = Form("Chest X-ray"),
  clinical_notes: str = Form(""),
  patient_id: str = Form("PT-1001"),
  file: Optional[UploadFile] = File(None)
):
  temp_file_path = ""
  dicom_metadata = {}

  if file:
    # Save upload to a temporary file
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
      shutil.copyfileobj(file.file, temp_file)
      temp_file_path = temp_file.name

    # Try parsing DICOM tags
    if file.filename.lower().endswith('.dcm'):
      try:
        ds = pydicom.dcmread(temp_file_path, stop_before_pixels=True)
        dicom_metadata = {
          "Patient Name": str(ds.get("PatientName", "Unknown")),
          "Patient ID": str(ds.get("PatientID", "Unknown")),
          "Patient Sex": str(ds.get("PatientSex", "Unknown")),
          "Modality": str(ds.get("Modality", "Unknown")),
          "Study Date": str(ds.get("StudyDate", "Unknown")),
          "Manufacturer": str(ds.get("Manufacturer", "Unknown")),
          "Window Center": str(ds.get("WindowCenter", "1024")),
          "Window Width": str(ds.get("WindowWidth", "2048"))
        }
      except Exception as dcm_err:
        print("Dicom parse failure:", dcm_err)
        dicom_metadata = {"status": "Parse failure", "error": str(dcm_err)}

  try:
    # Trigger LangGraph multi-agent diagnostic pipeline
    result = run_agentic_diagnosis(
      patient_id=patient_id,
      modality=modality,
      file_path=temp_file_path if temp_file_path else "notes.txt",
      clinical_notes=clinical_notes
    )
    
    result["dicom_metadata"] = dicom_metadata
    
    # Cleanup temp file
    if temp_file_path and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
      
    return result
  except Exception as err:
    if temp_file_path and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    raise HTTPException(status_code=500, detail=str(err))

@app.post("/api/v1/causal/what-if")
def causal_what_if(req: WhatIfRequest):
  try:
    result = causal_engine.simulate_counterfactual(
      baseline_disease=req.baseline_disease,
      baseline_prob=req.baseline_prob,
      interventions=req.interventions
    )
    return {
      "success": True,
      "counterfactual": result
    }
  except Exception as err:
    raise HTTPException(status_code=500, detail=str(err))

if __name__ == "__main__":
  import uvicorn
  uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
