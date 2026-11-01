"""
Real GradCAM — Gradient-weighted Class Activation Mapping
==========================================================
Theory:
  GradCAM (Selvaraju et al., 2017) produces a visual explanation of WHY
  a neural network made a prediction. It answers: "Which regions of the
  chest X-ray led the model to predict Pneumonia?"

  How it works:
  1. Forward pass: run the image through the CNN → get class prediction
  2. Backward pass: backpropagate the gradient of the TARGET class score
     with respect to the final convolutional layer's activation maps
  3. Global Average Pool the gradients to get importance weights α_k
     α_k = (1/Z) * Σ_ij (∂y_c / ∂A^k_ij)
     where:
       y_c = score for class c
       A^k = activation map of filter k
       Z   = spatial dimension (H×W)
  4. Weighted combination: L^c_GradCAM = ReLU(Σ_k α_k * A^k)
     - ReLU removes negative values (regions irrelevant to this class)
     - The result is a low-resolution heatmap (e.g., 7×7)
  5. Upsample heatmap to original image size and overlay

  Why use GradCAM on DenseNet121's denseblock4 layer?
  - The last conv layer has the highest semantic content
  - Feature maps encode disease-level patterns (infiltrates, cardiomegaly)
  - Earlier layers encode low-level edges and textures (less useful)
  - GradCAM on DenseNet is validated in medical imaging literature
"""

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple
import base64
from io import BytesIO
from PIL import Image


class GradCAM:
    """
    GradCAM implementation for CNN models (DenseNet121, EfficientNet, ConvNeXt).
    
    Usage:
        gradcam = GradCAM(model, target_layer=model.features.denseblock4)
        heatmap, overlay = gradcam.generate(image_tensor, target_class_idx)
    """

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        """
        Args:
            model        : The trained ChestXrayModel
            target_layer : The convolutional layer to visualize
                           For DenseNet121: model.features.denseblock4
                           For EfficientNet: model.features[-1]
                           For ConvNeXt: model.features[-1]
        """
        self.model        = model
        self.target_layer = target_layer
        self.gradients    = None
        self.activations  = None

        # Register forward hook to capture activation maps
        self._forward_hook = target_layer.register_forward_hook(self._save_activations)
        # Register backward hook to capture gradients
        self._backward_hook = target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, input, output):
        """
        Forward hook: captures the output (activation maps) of the target layer.
        These are A^k in the GradCAM formula.
        """
        self.activations = output.detach()

    def _save_gradients(self, module, grad_input, grad_output):
        """
        Backward hook: captures the gradients flowing back through the target layer.
        These are ∂y_c/∂A^k in the GradCAM formula.
        """
        self.gradients = grad_output[0].detach()

    def generate(
        self,
        image_tensor: torch.Tensor,
        target_class_idx: int,
        original_image: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generates GradCAM heatmap for a given input image and target class.
        
        Args:
            image_tensor    : Preprocessed image tensor [1, 3, H, W]
            target_class_idx: Index of the disease class to visualize (0–13)
            original_image  : Original (unpreprocessed) image as numpy array [H, W, 3]
                              If None, returns heatmap only (no overlay)
        
        Returns:
            heatmap  : [H, W] float array in [0, 1], normalized GradCAM map
            overlay  : [H, W, 3] uint8 array — colorized heatmap overlaid on image
        """
        self.model.eval()
        image_tensor = image_tensor.to(next(self.model.parameters()).device)

        # Step 1: Forward pass — compute class scores
        self.model.zero_grad()
        output = self.model(image_tensor)   # [1, 14] logits

        # Step 2: Select the target class score
        # We backpropagate only the gradient of the target class
        target_score = output[0, target_class_idx]

        # Step 3: Backward pass — compute gradients w.r.t. target layer
        target_score.backward(retain_graph=False)

        # Step 4: Compute GradCAM weights
        # α_k = Global Average Pool of gradients over spatial dimensions
        gradients   = self.gradients   # [1, C, H, W]  (gradient of target score)
        activations = self.activations # [1, C, H, W]  (feature maps)

        # Average gradients over spatial dimensions: [1, C, H, W] → [1, C, 1, 1]
        weights = gradients.mean(dim=(2, 3), keepdim=True)

        # Step 5: Weighted sum of activations
        # L^c = ReLU(Σ_k α_k * A^k)
        cam = (weights * activations).sum(dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)  # Remove negative contributions

        # Step 6: Normalize to [0, 1]
        cam = cam.squeeze().cpu().numpy()  # [H, W]
        if cam.max() > cam.min():
            cam = (cam - cam.min()) / (cam.max() - cam.min())
        else:
            cam = np.zeros_like(cam)

        # Step 7: Upsample to input image size
        H = W = 224  # default
        if original_image is not None:
            H, W = original_image.shape[:2]
        cam_resized = cv2.resize(cam, (W, H), interpolation=cv2.INTER_LINEAR)

        # Step 8: Create colorized overlay
        heatmap_color = cv2.applyColorMap(
            (cam_resized * 255).astype(np.uint8),
            cv2.COLORMAP_JET
        )  # [H, W, 3] BGR

        if original_image is not None:
            # Ensure original image is BGR uint8
            if original_image.dtype != np.uint8:
                original_image = (original_image * 255).astype(np.uint8)
            if len(original_image.shape) == 2:
                original_image = cv2.cvtColor(original_image, cv2.COLOR_GRAY2BGR)
            elif original_image.shape[2] == 3:
                # Assume RGB → convert to BGR for OpenCV
                original_image = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)
            # Blend: 65% original + 35% heatmap
            overlay = cv2.addWeighted(original_image, 0.65, heatmap_color, 0.35, 0)
        else:
            overlay = heatmap_color

        return cam_resized, overlay

    def remove_hooks(self):
        """Removes hooks after use to prevent memory leaks."""
        self._forward_hook.remove()
        self._backward_hook.remove()


def get_gradcam_target_layer(model, backbone_name: str) -> nn.Module:
    """
    Returns the appropriate target layer for GradCAM based on architecture.
    
    We target the LAST convolutional layer because:
    - It contains the highest-level semantic features
    - For DenseNet121: the last DenseBlock (denseblock4) before the transition
    - For EfficientNet: the last feature block
    - For ConvNeXt: the last stage
    """
    name = backbone_name.lower()

    if name == "densenet121":
        # denseblock4 is the last dense block in DenseNet121
        # Output: [B, 1024, 7, 7] for 224x224 input
        return model.features.denseblock4

    elif name == "efficientnet_b4":
        # Last feature block in EfficientNet-B4
        return model.features[-1]

    elif name == "convnext_small":
        # Last stage in ConvNeXt
        return model.features[-1]

    else:
        raise ValueError(
            f"GradCAM target layer not defined for backbone: {name}. "
            "Please inspect model.features and specify manually."
        )


def generate_gradcam_for_prediction(
    model,
    image_tensor: torch.Tensor,
    original_image_path: str,
    predicted_class_idx: int,
    backbone_name: str = "densenet121",
    output_path: str = None,
) -> Tuple[str, str]:
    """
    High-level function: generates GradCAM overlay for a chest X-ray prediction.
    
    Used by the inference engine to produce visual explanations.
    
    Args:
        model              : Trained ChestXrayModel
        image_tensor       : Preprocessed tensor [1, 3, 224, 224]
        original_image_path: Path to the original (unpreprocessed) image
        predicted_class_idx: Disease class index (0–13) with highest probability
        backbone_name      : Architecture name (for layer selection)
        output_path        : If provided, save overlay image to this path
    
    Returns:
        heatmap_b64  : Base64-encoded PNG of the heatmap overlay (for API response)
        saved_path   : Path where the overlay was saved (empty if not saved)
    """
    from training.dataset import CHESTXRAY14_CLASSES

    # Load original image for overlay
    original_np = cv2.imread(original_image_path)  # [H, W, 3] BGR
    if original_np is None:
        # Fallback: generate blank
        original_np = np.zeros((224, 224, 3), dtype=np.uint8)

    # Initialize GradCAM
    if backbone_name == "vit_base":
        # ViT doesn't use standard GradCAM
        # Return a blank overlay with a note
        overlay = original_np.copy()
        cv2.putText(
            overlay, "Attention: ViT model",
            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2
        )
        heatmap = np.zeros((original_np.shape[0], original_np.shape[1]), dtype=np.float32)
    else:
        target_layer = get_gradcam_target_layer(model, backbone_name)
        gradcam = GradCAM(model, target_layer)
        heatmap, overlay = gradcam.generate(image_tensor, predicted_class_idx, original_np)
        gradcam.remove_hooks()

    # Add disease label to overlay
    disease_name = CHESTXRAY14_CLASSES[predicted_class_idx]
    label_text = f"GradCAM: {disease_name}"
    cv2.putText(overlay, label_text, (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(overlay, label_text, (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)

    # Save if path provided
    saved_path = ""
    if output_path:
        cv2.imwrite(output_path, overlay)
        saved_path = output_path

    # Encode to base64 for API response (avoids file serving complexity)
    overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(overlay_rgb)
    buffer = BytesIO()
    pil_img.save(buffer, format="PNG")
    heatmap_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return heatmap_b64, saved_path
