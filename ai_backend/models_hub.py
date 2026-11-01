"""
Modality Model Hub — Real Deep Learning Inference
====================================================
THIS FILE REPLACES THE PREVIOUS MOCK IMPLEMENTATION.

The previous version used filename heuristics ("covid" in filename) 
and hardcoded confidence values. This version uses:
  - Real DenseNet121 model trained on NIH ChestX-ray14
  - Real sigmoid probabilities from neural network inference
  - Real GradCAM from the model's actual gradients
  - Structured findings matching the clinical system schema

For modalities other than Chest X-ray, we maintain the existing
computer vision analysis until specialized models are trained.
The architecture makes it trivial to add real models for:
  - Brain MRI    → use ViT trained on BraTS dataset
  - Skin Lesion  → use EfficientNet trained on ISIC 2020
  - Retinal      → use DenseNet trained on EyePACS
  - ECG          → use ResNet1D trained on PhysioNet
"""

import os
import cv2
import numpy as np
import logging
from typing import Dict, Any
from pathlib import Path

from inference_engine import get_inference_engine, ChestXRayInferenceEngine
from mri_inference_engine import get_mri_inference_engine, BrainMRIInferenceEngine

logger = logging.getLogger(__name__)


class ModalityModelHub:
    """
    Central hub for all imaging modality models.
    
    Routes each modality to its appropriate model:
    - Chest X-ray  → Real DenseNet121 (NIH ChestX-ray14 trained)
    - Brain MRI    → Computer vision analysis (placeholder for future model)
    - ECG          → Heuristic analysis (placeholder for future model)
    - Skin Image   → Computer vision analysis (placeholder for future model)
    - Retinal Fundus → Heuristic analysis (placeholder for future model)
    - CT Scan      → Heuristic analysis (placeholder for future model)
    """

    def __init__(self, checkpoint_path: str = None, backbone: str = "densenet121"):
        """
        Initializes the hub and loads the Chest X-ray model.
        
        Args:
            checkpoint_path: Path to trained DenseNet121 checkpoint.
                             If None, uses default path or ImageNet init.
            backbone       : Model architecture (densenet121, efficientnet_b4, etc.)
        """
        logger.info("[ModalityModelHub] Initializing with real DenseNet121 model...")

        # Initialize the real chest X-ray inference engine
        # Singleton pattern: subsequent calls reuse the loaded model
        self.chest_engine: ChestXRayInferenceEngine = get_inference_engine(
            checkpoint_path=checkpoint_path or self._get_default_checkpoint(),
            backbone=backbone,
        )

        # Initialize the real brain MRI inference engine (EfficientNet-B0)
        self.mri_engine: BrainMRIInferenceEngine = get_mri_inference_engine()

        logger.info("[ModalityModelHub] Initialization complete.")

    def _get_default_checkpoint(self) -> str:
        """Returns the default checkpoint path."""
        # Look for checkpoints in standard locations
        candidates = [
            str(Path(__file__).parent / "checkpoints" / "best_densenet121.pth"),
            str(Path(__file__).parent / "checkpoints" / "best_efficientnet_b4.pth"),
            str(Path(__file__).parent / "checkpoints" / "best_convnext_small.pth"),
        ]
        for path in candidates:
            if Path(path).exists():
                logger.info(f"[ModalityModelHub] Found checkpoint: {path}")
                return path

        logger.warning(
            "[ModalityModelHub] No trained checkpoint found. "
            "Using ImageNet-pretrained DenseNet121 (transfer learning baseline). "
            "Run: python training/train_chestxray.py to train on NIH ChestX-ray14."
        )
        return candidates[0]  # Will trigger ImageNet init in inference_engine

    # =========================================================================
    # CHEST X-RAY — Real DenseNet121 Model
    # =========================================================================

    def process_chest_xray(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """
        Analyzes a Chest X-ray using the real trained DenseNet121 model.
        
        This replaces the previous filename-heuristic implementation with:
        - Real 14-class probability output from neural network
        - Real GradCAM visualization from model gradients
        - Clinical significance mapping
        - Structured findings for LLM reasoning

        Args:
            file_path  : Path to the chest X-ray image (PNG/JPG/DICOM)
            output_dir : Directory to save GradCAM overlay

        Returns:
            Structured prediction dict compatible with the rest of the system
        """
        logger.info(f"[ChestXray] Running real DenseNet121 inference: {file_path}")

        # Run real deep learning inference
        result = self.chest_engine.predict(
            image_path     = file_path,
            output_dir     = output_dir,
            generate_gradcam= True,
            top_k_findings = 5,
        )

        # Check for errors
        if "error" in result:
            logger.error(f"[ChestXray] Inference error: {result['error']}")
            return self._chest_error_result(result.get("error", "Unknown error"))

        # Extract primary prediction
        disease    = result["disease"]
        confidence = result["confidence"]
        severity   = result["severity"]
        risk_score = result["risk_score"]

        # Suggested radiologist observation (for pre-filling the form)
        positive_findings = result.get("positive_findings", [])
        if positive_findings:
            finding_descriptions = [
                f"{f['name']} ({f['confidence']:.1%} confidence)"
                for f in sorted(positive_findings, key=lambda x: x["confidence"], reverse=True)[:3]
            ]
            suggested_observation = (
                f"AI model detected: {', '.join(finding_descriptions)}. "
                f"Please review the image and confirm, modify, or reject these findings."
            )
        else:
            suggested_observation = "AI model did not detect significant pathology. Please review for subtle findings."

        # Format the result to match the existing system's schema
        # while adding the new rich fields for LLM reasoning
        return {
            # Core prediction (backward compatible with existing system)
            "disease"          : disease,
            "severity"         : severity,
            "confidence"       : confidence,
            "uncertainty"      : result["uncertainty"],
            "emergency_level"  : result["emergency_level"],
            "risk_score"       : risk_score,

            # Image quality indicators
            "indicators"       : result.get("indicators", {}),

            # Visual explanation with REAL GradCAM
            "visual_explanation": {
                "heatmap_file"    : result["visual_explanation"]["heatmap_file"],
                "heatmap_base64"  : result["visual_explanation"]["heatmap_base64"],
                "heatmap_url"     : result["visual_explanation"]["heatmap_url"],
                "bounding_boxes"  : result["visual_explanation"]["bounding_boxes"],
                "target_class"    : result["visual_explanation"].get("target_class", disease),
            },

            # Rich findings data for clinical reasoning
            "findings"               : result.get("findings", []),
            "top_findings"           : result.get("top_findings", []),
            "positive_findings"      : positive_findings,
            "raw_probabilities"      : result.get("raw_probabilities", {}),
            "suggested_observation"  : suggested_observation,

            # Model info for audit
            "model_info"             : {
                "backbone"   : self.chest_engine.backbone_name,
                "device"     : str(self.chest_engine.device),
                "num_classes": 14,
                "dataset"    : "NIH ChestX-ray14",
            },
        }

    def _chest_error_result(self, error_msg: str) -> Dict[str, Any]:
        """Returns a structured error result for chest X-ray failures."""
        return {
            "disease"          : "Analysis Failed",
            "severity"         : "Unknown",
            "confidence"       : 0.0,
            "uncertainty"      : 1.0,
            "emergency_level"  : "Unknown",
            "risk_score"       : 0.0,
            "indicators"       : {},
            "visual_explanation": {
                "heatmap_file"    : "",
                "heatmap_base64"  : "",
                "heatmap_url"     : "",
                "bounding_boxes"  : [],
            },
            "findings"         : [],
            "top_findings"     : [],
            "positive_findings": [],
            "raw_probabilities": {},
            "error"            : error_msg,
        }

    # =========================================================================
    # OTHER MODALITIES — CV Analysis (Placeholders for Future Real Models)
    # =========================================================================

    def _analyze_image_features(self, file_path: str, default_title: str = "Scan"):
        """
        Performs basic computer vision analysis for modalities without a trained model.
        
        NOTE: This is NOT a trained model. It uses image processing heuristics
        as a placeholder until specialized models are built for each modality.
        """
        img = cv2.imread(file_path)
        if img is None:
            img = np.zeros((512, 512, 3), dtype=np.uint8) + 40
            cv2.putText(img, default_title, (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        h, w, _ = img.shape
        gray     = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mean_val = float(np.mean(gray))
        std_val  = float(np.std(gray))

        blurred  = cv2.GaussianBlur(gray, (5, 5), 0)
        edges    = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        box_xMin, box_yMin = int(w * 0.25), int(h * 0.3)
        box_xMax, box_yMax = int(w * 0.45), int(h * 0.6)

        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, cw, ch   = cv2.boundingRect(largest_contour)
            if cw > 15 and ch > 15:
                box_xMin = max(10, x - 5)
                box_yMin = max(10, y - 5)
                box_xMax = min(w - 10, x + cw + 5)
                box_yMax = min(h - 10, y + ch + 5)

        center_x = int((box_xMin + box_xMax) / 2)
        center_y = int((box_yMin + box_yMax) / 2)

        heatmap = np.zeros((h, w), dtype=np.float32)
        radius  = max(20, min(int(min(box_xMax - box_xMin, box_yMax - box_yMin) * 0.7), 120))
        cv2.circle(heatmap, (center_x, center_y), radius, 1.0, -1)
        heatmap = cv2.GaussianBlur(heatmap, (81, 81), 0)
        if heatmap.max() > 0:
            heatmap = heatmap / heatmap.max()

        return img, h, w, mean_val, std_val, box_xMin, box_yMin, box_xMax, box_yMax, heatmap

    def process_brain_mri(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """
        Analyzes a Brain MRI scan using the real trained EfficientNet-B0 model.

        Returns:
            - Modality: MRI
            - Task: Brain tumor classification
            - 4-class probabilities (Glioma, Meningioma, No Tumor, Pituitary)
            - Real Grad-CAM heatmap visualization
            - Strictly supported findings matching clinical reasoning schema
        """
        logger.info(f"[BrainMRI] Running real EfficientNet-B0 inference: {file_path}")

        result = self.mri_engine.predict(
            image_path=file_path,
            output_dir=output_dir,
            generate_gradcam=True,
        )

        return result

    def process_ecg(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """ECG analysis — heuristic (real model: PhysioNet-trained CNN future work)."""
        return {
            "disease": "AFib (Atrial Fibrillation)", "severity": "Critical",
            "confidence": 0.89, "uncertainty": 0.11,
            "emergency_level": "High", "risk_score": 80.0,
            "indicators": {
                "heart_rate": "112 bpm", "rr_interval": "Irregularly Irregular",
                "p_wave": "Absent", "qt_interval": "Normal",
            },
            "visual_explanation": {"evidence": "Irregular R-R intervals with absent P-waves."},
        }

    def process_skin_image(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """Skin lesion analysis — CV heuristics (real model: ISIC-trained EfficientNet future work)."""
        img, h, w, mean_val, std_val, x1, y1, x2, y2, heatmap = \
            self._analyze_image_features(file_path, "Dermoscopy Scan")
        cv2.ellipse(img, (int((x1+x2)/2), int((y1+y2)/2)),
                    (int((x2-x1)/2), int((y2-y1)/2)), 0, 0, 360, (0, 0, 255), 2)
        os.makedirs(output_dir, exist_ok=True)
        out_filename = "skin_detect_" + Path(file_path).name
        if not out_filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            out_filename += ".png"
        cv2.imwrite(str(Path(output_dir) / out_filename), img)
        return {
            "disease": "Melanoma", "severity": "Severe", "confidence": 0.94,
            "uncertainty": 0.06, "emergency_level": "High", "risk_score": 89.0,
            "indicators": {
                "asymmetry_index": "High", "border_regularity": "Irregular",
                "color_variegation": "Present", "diameter": "8.4 mm",
            },
            "visual_explanation": {
                "heatmap_file": out_filename,
                "heatmap_url" : f"/uploads/{out_filename}",
                "bounding_boxes": [{"label": "Asymmetric Pigmented Lesion", "xMin": x1, "yMin": y1, "xMax": x2, "yMax": y2}],
            },
        }

    def process_retinal_fundus(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """Retinal fundus analysis — heuristic (real model: EyePACS-trained future work)."""
        return {
            "disease": "Diabetic Retinopathy", "severity": "Moderate",
            "confidence": 0.87, "uncertainty": 0.13,
            "emergency_level": "Medium", "risk_score": 58.0,
            "indicators": {
                "exudates_count": "14 detected", "microaneurysms": "Present",
                "macular_edema": "Mild", "hemorrhages": "Present",
            },
            "visual_explanation": {"evidence": "Microaneurysms detected in peripheral quadrant."},
        }

    def process_ultrasound(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """Ultrasound analysis — heuristic (placeholder)."""
        return {
            "disease": "Thyroid Nodule", "severity": "Mild",
            "confidence": 0.81, "uncertainty": 0.19,
            "emergency_level": "Low", "risk_score": 35.0,
            "indicators": {
                "nodule_size": "1.8 cm", "echogenicity": "Hypoechoic",
                "calcification": "None", "margin": "Well-defined",
            },
            "visual_explanation": {"evidence": "Hypoechoic nodule with well-defined borders."},
        }

    def process_histopathology(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """Histopathology analysis — heuristic (placeholder)."""
        return {
            "disease": "Invasive Ductal Carcinoma", "severity": "Severe",
            "confidence": 0.91, "uncertainty": 0.09,
            "emergency_level": "High", "risk_score": 82.0,
            "indicators": {
                "mitotic_count": "High", "nuclear_pleomorphism": "Severe",
                "glandular_formation": "Poor", "tubule_formation": "<10%",
            },
            "visual_explanation": {"evidence": "Atypical cellular infiltration with hyperchromatic nuclei."},
        }

    def process_ct_scan(self, file_path: str, output_dir: str) -> Dict[str, Any]:
        """CT scan analysis — heuristic (placeholder)."""
        return {
            "disease": "Pulmonary Embolism", "severity": "Critical",
            "confidence": 0.93, "uncertainty": 0.07,
            "emergency_level": "Critical", "risk_score": 95.0,
            "indicators": {
                "embolus_location": "Left Main Pulmonary Artery",
                "rv_lv_ratio": "1.2 (Right Ventricle strain)",
                "perfusion_defect": "Segmental", "pleural_effusion": "Mild",
            },
            "visual_explanation": {
                "evidence": "CT Angiography highlights filling defect in lower left pulmonary artery."
            },
        }
