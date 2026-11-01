"""
MRI Preprocessing Pipeline
==========================
Dedicated preprocessing module tailored for Brain MRI axial/coronal/sagittal slices.

Design Decisions:
1. Multi-format support: Accepts file paths (.jpg, .png, .dcm), PIL Images, or raw numpy arrays.
2. Contrast Standardization: Brain MRI often exhibits intensity variations between scanners.
   We apply optional Contrast Limited Adaptive Histogram Equalization (CLAHE) on the luminance
   channel for enhanced gray/white matter and lesion boundary distinction.
3. Color Channel Replication: MRI scans are inherently grayscale. To leverage ImageNet
   pretrained representations (EfficientNet-B0), single-channel arrays are converted to 3-channel RGB.
4. Resolution: Standardized to 224x224 using bilinear/bicubic interpolation, matching the
   EfficientNet-B0 input receptive field.
5. Normalization: ImageNet channel mean ([0.485, 0.456, 0.406]) and std ([0.229, 0.224, 0.225]).
6. Explainability Support: Returns both the normalized PyTorch tensor and the original uint8 RGB
   image to facilitate high-fidelity Grad-CAM heatmap overlays.
"""

import os
from pathlib import Path
from typing import Tuple, Union, Optional
import cv2
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as T

# Standard ImageNet normalization parameters
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]


def get_mri_transforms(mode: str = "train", image_size: int = 224):
    """
    Returns torchvision transforms for MRI training, validation, and testing.

    Augmentations for Brain MRI:
    - Random horizontal flip (brain hemispheres exhibit bilateral symmetry)
    - Gentle rotation (±10°) to account for patient head positioning inside the head coil
    - Subtle brightness and contrast variations (±10%) to simulate scanner RF gain differences
    - Avoids severe elastic distortion to preserve neuro-anatomical geometry
    """
    if mode == "train":
        return T.Compose([
            T.Resize((image_size, image_size), interpolation=T.InterpolationMode.BILINEAR),
            T.RandomHorizontalFlip(p=0.5),
            T.RandomRotation(degrees=10),
            T.ColorJitter(brightness=0.1, contrast=0.1),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])
    else:
        # Deterministic pipeline for validation and held-out test evaluation
        return T.Compose([
            T.Resize((image_size, image_size), interpolation=T.InterpolationMode.BILINEAR),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])


class MRIPreprocessor:
    """
    Inference preprocessing engine for single MRI scans.
    """

    def __init__(self, image_size: int = 224, enhance_contrast: bool = False):
        self.image_size = image_size
        self.enhance_contrast = enhance_contrast
        self.transform = get_mri_transforms(mode="test", image_size=image_size)

    def load_image(self, image_input: Union[str, Path, Image.Image, np.ndarray]) -> Tuple[Image.Image, np.ndarray]:
        """
        Loads and standardizes input to an RGB PIL Image and RGB numpy array.
        Handles DICOM (.dcm) files if pydicom is available.
        """
        if isinstance(image_input, (str, Path)):
            path_str = str(image_input)
            if not os.path.exists(path_str):
                raise FileNotFoundError(f"MRI image file not found: {path_str}")

            # Check if DICOM
            if path_str.lower().endswith(".dcm"):
                try:
                    import pydicom
                    dcm = pydicom.dcmread(path_str)
                    arr = dcm.pixel_array.astype(np.float32)
                    # Min-max normalization for DICOM windowing
                    arr = (arr - arr.min()) / max(arr.max() - arr.min(), 1e-5) * 255.0
                    arr = arr.astype(np.uint8)
                    if len(arr.shape) == 2:
                        rgb = cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
                    else:
                        rgb = arr
                    pil_img = Image.fromarray(rgb)
                    return pil_img, rgb
                except ImportError:
                    pass

            # Standard image reading via PIL
            pil_img = Image.open(path_str).convert("RGB")
            rgb_arr = np.array(pil_img)
            return pil_img, rgb_arr

        elif isinstance(image_input, Image.Image):
            pil_img = image_input.convert("RGB")
            return pil_img, np.array(pil_img)

        elif isinstance(image_input, np.ndarray):
            arr = image_input.copy()
            if arr.dtype != np.uint8:
                if arr.max() <= 1.0:
                    arr = (arr * 255.0).astype(np.uint8)
                else:
                    arr = arr.astype(np.uint8)
            if len(arr.shape) == 2:
                rgb = cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
            elif len(arr.shape) == 3 and arr.shape[2] == 1:
                rgb = cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
            else:
                rgb = arr
            return Image.fromarray(rgb), rgb

        else:
            raise ValueError(f"Unsupported image input type: {type(image_input)}")

    def process(
        self,
        image_input: Union[str, Path, Image.Image, np.ndarray],
        device: Union[str, torch.device] = "cpu"
    ) -> Tuple[torch.Tensor, np.ndarray]:
        """
        Processes an MRI scan for model ingestion.

        Returns:
            tensor: [1, 3, 224, 224] FloatTensor on specified device
            original_rgb: [H, W, 3] uint8 numpy array for Grad-CAM overlay
        """
        pil_img, original_rgb = self.load_image(image_input)

        # Optional CLAHE contrast enhancement
        if self.enhance_contrast:
            img_yuv = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2YUV)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            img_yuv[:, :, 0] = clahe.apply(img_yuv[:, :, 0])
            enhanced_rgb = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2RGB)
            pil_img = Image.fromarray(enhanced_rgb)

        tensor = self.transform(pil_img).unsqueeze(0).to(device)
        return tensor, original_rgb
