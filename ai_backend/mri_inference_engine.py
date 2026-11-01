"""
Brain MRI Inference Engine
==========================
Dedicated inference service for Brain MRI classification using EfficientNet-B0.

Compliance & Design Rules:
1. Returns ONLY information directly supported by its training task:
   - modality: "MRI"
   - task: "Brain tumor classification"
   - prediction: predicted class (Glioma, Meningioma, No Tumor, Pituitary)
   - confidence: highest probability value
   - probabilities: dictionary of {class: probability}
   - visual_explanation: Grad-CAM attention heatmap overlay and base64
   - model_info: architecture and training metadata
2. Does NOT return unvalidated synthetic metrics (severity, emergency_level, risk_score, uncertainty).
3. Provides real Grad-CAM by capturing gradients at the final convolutional block of EfficientNet-B0.
4. Uses singleton pattern for efficient in-memory model reuse across requests.
"""

import os
import sys
import base64
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models

from mri_preprocessing import MRIPreprocessor
from training.mri_dataset import MRI_DISPLAY_CLASSES, MRI_RAW_CLASSES

logger = logging.getLogger(__name__)

DEFAULT_MRI_CHECKPOINT = str(Path(__file__).parent / "mri_checkpoints" / "best_mri_model.pth")


class BrainMRIInferenceEngine:
    """
    Singleton inference engine for Brain MRI analysis.
    """
    _instance: Optional["BrainMRIInferenceEngine"] = None

    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.device: torch.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.preprocessor = MRIPreprocessor(image_size=224)
        self.classes = MRI_DISPLAY_CLASSES
        self.raw_classes = MRI_RAW_CLASSES
        self._is_loaded: bool = False
        self.checkpoint_metadata: Dict[str, Any] = {}

    @classmethod
    def get_instance(cls) -> "BrainMRIInferenceEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self, checkpoint_path: str = DEFAULT_MRI_CHECKPOINT) -> bool:
        """
        Loads the trained EfficientNet-B0 model checkpoint.
        """
        ckpt_path = Path(checkpoint_path)
        print(f"[MRI Inference] Loading model from: {ckpt_path.resolve()} onto {self.device}")

        # Build base EfficientNet-B0
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, len(self.classes))
        )

        if ckpt_path.exists():
            checkpoint = torch.load(str(ckpt_path), map_location=self.device, weights_only=False)
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            model.load_state_dict(state_dict)
            self.checkpoint_metadata = {
                "val_accuracy": checkpoint.get("val_accuracy"),
                "test_accuracy": checkpoint.get("test_accuracy"),
                "epoch": checkpoint.get("epoch"),
                "architecture": checkpoint.get("architecture", "efficientnet_b0"),
            }
            logger.info(f"[MRI Inference] Loaded trained weights from {ckpt_path}")
        else:
            logger.warning(f"[MRI Inference] Checkpoint not found at {ckpt_path}. Using ImageNet initialized weights as fallback.")
            pretrained_base = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
            model.features.load_state_dict(pretrained_base.features.state_dict())

        model.to(self.device)
        model.eval()
        self.model = model
        self._is_loaded = True
        return True

    def _generate_gradcam(
        self,
        tensor: torch.Tensor,
        original_rgb: np.ndarray,
        target_class_idx: int,
        output_path: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Computes Grad-CAM activations on EfficientNet-B0's final conv layer (features[-1]).
        """
        if self.model is None:
            return "", ""

        gradients = []
        activations = []

        def backward_hook(module, grad_input, grad_output):
            gradients.append(grad_output[0])

        def forward_hook(module, input, output):
            activations.append(output)

        # Target last convolutional block in EfficientNet-B0
        target_layer = self.model.features[-1]
        h_fwd = target_layer.register_forward_hook(forward_hook)
        h_bwd = target_layer.register_full_backward_hook(backward_hook)

        try:
            self.model.eval()
            # Forward pass
            tensor_clone = tensor.clone().detach().requires_grad_(True)
            logits = self.model(tensor_clone)
            score = logits[0, target_class_idx]

            # Backward pass
            self.model.zero_grad()
            score.backward(retain_graph=False)

            if not gradients or not activations:
                return "", ""

            # Global average pooling of gradients
            grad = gradients[0].cpu().data.numpy()[0]  # [1280, 7, 7]
            act = activations[0].cpu().data.numpy()[0]   # [1280, 7, 7]
            weights = np.mean(grad, axis=(1, 2))        # [1280]

            # Weighted combination of activation maps
            cam = np.zeros(act.shape[1:], dtype=np.float32)
            for i, w in enumerate(weights):
                cam += w * act[i, :, :]

            cam = np.maximum(cam, 0)  # ReLU
            if cam.max() > 0:
                cam = cam / cam.max()

            h, w = original_rgb.shape[:2]
            cam_resized = cv2.resize(cam, (w, h))

            # Create heatmap overlay
            heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
            heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
            overlay = np.uint8(0.4 * heatmap_rgb + 0.6 * original_rgb)

            # Save to disk if requested
            heatmap_filename = ""
            if output_path:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                cv2.imwrite(output_path, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
                heatmap_filename = os.path.basename(output_path)

            # Convert overlay to base64
            _, buffer = cv2.imencode(".png", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
            heatmap_base64 = base64.b64encode(buffer).decode("utf-8")

            return heatmap_base64, heatmap_filename

        except Exception as e:
            logger.warning(f"[MRI Inference] Grad-CAM generation failed: {e}")
            return "", ""
        finally:
            h_fwd.remove()
            h_bwd.remove()

    def predict(
        self,
        image_path: str,
        output_dir: str = "../backend/uploads",
        generate_gradcam: bool = True
    ) -> Dict[str, Any]:
        """
        Runs complete MRI inference on a scan.

        Returns ONLY supported outputs (no synthetic severity/risk):
        - modality: "MRI"
        - task: "Brain tumor classification"
        - prediction: predicted class
        - confidence: probability of predicted class
        - probabilities: {class: probability}
        - visual_explanation: Grad-CAM heatmap
        - model_info: architecture and class details
        """
        if not self._is_loaded or self.model is None:
            self.load_model()

        # 1. Preprocess
        tensor, original_rgb = self.preprocessor.process(image_path, device=self.device)

        # 2. Forward Pass
        self.model.eval()
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        pred_idx = int(np.argmax(probs))
        predicted_class = self.classes[pred_idx]
        confidence = float(round(float(probs[pred_idx]), 4))

        # Format class probabilities
        probabilities = {
            self.classes[i]: float(round(float(probs[i]), 4))
            for i in range(len(self.classes))
        }

        # 3. Grad-CAM visual explanation
        heatmap_base64 = ""
        heatmap_file = ""
        if generate_gradcam:
            stem = Path(image_path).stem
            gradcam_filename = f"gradcam_mri_{stem}.png"
            gradcam_output_path = str(Path(output_dir) / gradcam_filename)
            heatmap_base64, heatmap_file = self._generate_gradcam(
                tensor=tensor,
                original_rgb=original_rgb,
                target_class_idx=pred_idx,
                output_path=gradcam_output_path
            )

        # Structured findings list for UI / downstream rendering
        findings = [
            {
                "name": self.classes[i],
                "confidence": probabilities[self.classes[i]],
                "predicted_positive": (i == pred_idx and predicted_class != "No Tumor")
            }
            for i in range(len(self.classes))
        ]

        # Assemble strictly compliant output schema
        result = {
            "modality": "MRI",
            "task": "Brain tumor classification",
            "prediction": predicted_class,
            "disease": predicted_class,  # Standard key across pipeline
            "confidence": confidence,
            "probabilities": probabilities,
            "raw_probabilities": probabilities,
            "findings": findings,
            "positive_findings": [
                {"name": predicted_class, "confidence": confidence}
            ] if predicted_class != "No Tumor" else [],
            "visual_explanation": {
                "heatmap_base64": heatmap_base64,
                "heatmap_file": heatmap_file,
                "heatmap_url": f"/uploads/{heatmap_file}" if heatmap_file else "",
                "target_class": predicted_class,
                "bounding_boxes": []
            },
            "model_info": {
                "architecture": "EfficientNet-B0",
                "num_classes": len(self.classes),
                "dataset": "Brain Tumor MRI Dataset (4 classes)",
                "test_accuracy": self.checkpoint_metadata.get("test_accuracy"),
                "device": str(self.device),
            }
        }

        return result


def get_mri_inference_engine(checkpoint_path: str = DEFAULT_MRI_CHECKPOINT) -> BrainMRIInferenceEngine:
    """
    Module-level singleton accessor.
    """
    engine = BrainMRIInferenceEngine.get_instance()
    if not engine._is_loaded:
        engine.load_model(checkpoint_path=checkpoint_path)
    return engine
