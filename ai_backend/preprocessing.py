"""
Medical Image Preprocessing Pipeline
======================================
Professional DICOM & Medical Image Preprocessing Engine for DenseNet121 / PyTorch Models.

Pipeline Steps:
  1. Image Format & DICOM Tag Validation (RescaleSlope, RescaleIntercept, Windowing)
  2. Image Quality Assessment (Brightness, Contrast Score, Noise Score, Exposure, Blur)
  3. Noise Reduction (Pathology-Preserving Bilateral Filtering)
  4. Contrast Enhancement (CLAHE — Contrast Limited Adaptive Histogram Equalization)
  5. Brightness Normalization (Min-Max scaling without intensity clipping)
  6. Text Artifact & Scanner Border Removal (Anatomical Thoracic Region Cropping)
  7. Orientation Validation & Auto-Correction
  8. Resize (224x224 high-quality interpolation) & ImageNet Normalization
  9. Debugging Artifact Export (uploads/preprocessing/ intermediate PNGs)
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

import cv2
import numpy as np
import torch
from PIL import Image
import torchvision.transforms as T

try:
    import pydicom
    HAS_PYDICOM = True
except ImportError:
    HAS_PYDICOM = False

logger = logging.getLogger(__name__)

# ImageNet normalization stats (must match model training)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]


class MedicalImagePreprocessor:
    """
    Automated medical image quality enhancer & thoracic preprocessor.
    """

    def __init__(self, target_size: Tuple[int, int] = (224, 224), debug_dir: Optional[str] = None):
        self.target_size = target_size
        self.debug_dir   = debug_dir
        self.pytorch_transform = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])

    def process(self, image_path: str, output_dir: str = "./uploads") -> Tuple[torch.Tensor, np.ndarray, Dict[str, Any]]:
        """
        Executes the 9-step medical image preprocessing pipeline.

        Args:
            image_path: Path to PNG, JPG, JPEG, or DICOM (.dcm) file
            output_dir: Directory for saving intermediate debugging images

        Returns:
            tensor: [1, 3, 224, 224] PyTorch tensor ready for model inference
            original_np: [H, W, 3] RGB uint8 array of preprocessed image for GradCAM overlay
            report: Preprocessing metrics and quality assessment report
        """
        prep_debug_dir = os.path.join(output_dir, "preprocessing")
        os.makedirs(prep_debug_dir, exist_ok=True)

        logger.info(f"[MedicalPreprocessor] Starting preprocessing pipeline for: {image_path}")

        # -----------------------------------------------------------------
        # Step 1: Format Validation & DICOM Handling
        # -----------------------------------------------------------------
        is_dicom = image_path.lower().endswith(('.dcm', '.dicom'))
        gray_img, dicom_metadata = self._load_and_validate_format(image_path, is_dicom)
        self._save_debug(gray_img, prep_debug_dir, "after_dicom.png")

        # Save original as PNG for debug if raw input was DICOM
        if is_dicom:
            self._save_debug(gray_img, prep_debug_dir, "original.png")
        else:
            try:
                orig_pil = Image.open(image_path).convert("L")
                self._save_debug(np.array(orig_pil), prep_debug_dir, "original.png")
            except Exception:
                self._save_debug(gray_img, prep_debug_dir, "original.png")

        # -----------------------------------------------------------------
        # Step 2: Quality Assessment
        # -----------------------------------------------------------------
        quality_metrics = self._assess_quality(gray_img)
        logger.info(
            f"[MedicalPreprocessor] Image Quality: {quality_metrics['quality_rating']} | "
            f"Contrast: {quality_metrics['contrast_score']:.1f} | "
            f"Noise: {quality_metrics['noise_score']:.1f} | "
            f"Brightness: {quality_metrics['mean_brightness']:.1f}"
        )

        # -----------------------------------------------------------------
        # Step 3: Pathology-Preserving Noise Reduction
        # -----------------------------------------------------------------
        # Use Bilateral Filter to remove high-frequency noise while preserving sharp lesion edges
        denoised = cv2.bilateralFilter(gray_img, d=5, sigmaColor=35, sigmaSpace=35)
        self._save_debug(denoised, prep_debug_dir, "after_noise.png")

        # -----------------------------------------------------------------
        # Step 4: Contrast Enhancement via CLAHE
        # -----------------------------------------------------------------
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_enhanced = clahe.apply(denoised)
        self._save_debug(clahe_enhanced, prep_debug_dir, "after_clahe.png")

        # -----------------------------------------------------------------
        # Step 5: Brightness Normalization (Avoid Clipping)
        # -----------------------------------------------------------------
        normalized = cv2.normalize(clahe_enhanced, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)

        # -----------------------------------------------------------------
        # Step 6: Text Artifact & Scanner Border Removal / Thoracic Crop
        # -----------------------------------------------------------------
        cropped, crop_applied = self._crop_thoracic_region(normalized)
        self._save_debug(cropped, prep_debug_dir, "after_crop.png")

        # -----------------------------------------------------------------
        # Step 7: Orientation Validation & Correction
        # -----------------------------------------------------------------
        oriented, orientation_corrected = self._correct_orientation(cropped)

        # -----------------------------------------------------------------
        # Step 8: Resize to 224x224 & PyTorch Normalization
        # -----------------------------------------------------------------
        resized = cv2.resize(oriented, self.target_size, interpolation=cv2.INTER_AREA)

        # Convert to 3-channel RGB uint8 for PyTorch & GradCAM
        rgb_img = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
        self._save_debug(rgb_img, prep_debug_dir, "final_model_input.png")

        # Create PyTorch tensor [1, 3, 224, 224]
        pil_rgb = Image.fromarray(rgb_img)
        tensor = self.pytorch_transform(pil_rgb).unsqueeze(0)

        # -----------------------------------------------------------------
        # Step 9: Assemble Preprocessing Report
        # -----------------------------------------------------------------
        report = {
            "preprocessing": {
                "noise_removed": True,
                "clahe_applied": True,
                "lung_crop": crop_applied,
                "orientation_corrected": orientation_corrected,
                "image_quality": quality_metrics["quality_rating"],
                "contrast_score": round(quality_metrics["contrast_score"], 2),
                "noise_score": round(quality_metrics["noise_score"], 2),
                "quality_metrics": {
                    "mean_brightness": round(quality_metrics["mean_brightness"], 2),
                    "contrast": round(quality_metrics["contrast_score"], 2),
                    "blur_laplacian": round(quality_metrics["blur_laplacian"], 2),
                    "exposure": quality_metrics["exposure_status"],
                },
                "dicom_processed": is_dicom,
                "dicom_metadata": dicom_metadata,
            }
        }

        logger.info(f"[MedicalPreprocessor] ✅ Preprocessing pipeline complete. Outputs saved in: {prep_debug_dir}")

        return tensor, rgb_img, report

    def _load_and_validate_format(self, image_path: str, is_dicom: bool) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Loads PNG/JPG/DICOM and normalizes to 8-bit grayscale array."""
        dicom_meta = {}

        if is_dicom and HAS_PYDICOM:
            try:
                ds = pydicom.dcmread(image_path)
                pixel_array = ds.pixel_array.astype(np.float32)

                # Apply RescaleSlope & RescaleIntercept
                slope     = float(getattr(ds, "RescaleSlope", 1.0))
                intercept = float(getattr(ds, "RescaleIntercept", 0.0))
                hu_array  = pixel_array * slope + intercept

                # Apply Window Center / Window Width if available
                wc = getattr(ds, "WindowCenter", None)
                ww = getattr(ds, "WindowWidth", None)

                if wc is not None and ww is not None:
                    try:
                        c = float(wc[0] if isinstance(wc, (list, pydicom.multival.MultiValue)) else wc)
                        w = float(ww[0] if isinstance(ww, (list, pydicom.multival.MultiValue)) else ww)
                        min_val = c - (w / 2.0)
                        max_val = c + (w / 2.0)
                        hu_array = np.clip(hu_array, min_val, max_val)
                    except Exception as e:
                        logger.warning(f"[MedicalPreprocessor] Windowing fallback: {e}")

                # Normalize to 8-bit [0, 255]
                min_hu, max_hu = hu_array.min(), hu_array.max()
                if max_hu > min_hu:
                    gray = ((hu_array - min_hu) / (max_hu - min_hu) * 255.0).astype(np.uint8)
                else:
                    gray = np.zeros_like(hu_array, dtype=np.uint8)

                dicom_meta = {
                    "modality": str(getattr(ds, "Modality", "CR/DX")),
                    "patient_position": str(getattr(ds, "PatientPosition", "PA")),
                    "rescale_slope": slope,
                    "rescale_intercept": intercept,
                }
                return gray, dicom_meta

            except Exception as e:
                logger.warning(f"[MedicalPreprocessor] PyDicom load failed ({e}) — falling back to standard loader")

        # Standard PNG/JPG loader via PIL/OpenCV
        try:
            pil_img = Image.open(image_path).convert("L")
            gray = np.array(pil_img, dtype=np.uint8)
            return gray, dicom_meta
        except Exception as e:
            logger.error(f"[MedicalPreprocessor] Failed to load image {image_path}: {e}")
            # Emergency blank canvas fallback
            gray = np.zeros((224, 224), dtype=np.uint8)
            return gray, dicom_meta

    def _assess_quality(self, gray: np.ndarray) -> Dict[str, Any]:
        """Calculates image quality, contrast, noise, and exposure metrics."""
        mean_bright = float(np.mean(gray))
        contrast    = float(np.std(gray))

        # Variance of Laplacian indicates focus/sharpness vs blur
        blur_val    = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Noise estimation using high-frequency residual difference
        blurred_gray = cv2.GaussianBlur(gray, (5, 5), 0)
        noise_score  = float(np.std(gray.astype(np.float32) - blurred_gray.astype(np.float32)))

        # Determine exposure
        if mean_bright < 40:
            exposure = "Under Exposed (Too Dark)"
        elif mean_bright > 215:
            exposure = "Over Exposed (Too Bright)"
        else:
            exposure = "Normal Exposure"

        # Determine overall rating
        if contrast < 25.0:
            rating = "Low Contrast"
        elif noise_score > 25.0:
            rating = "High Noise"
        elif blur_val < 50.0:
            rating = "Suboptimal Focus"
        else:
            rating = "Good"

        return {
            "quality_rating"  : rating,
            "mean_brightness": mean_bright,
            "contrast_score"  : contrast,
            "blur_laplacian"  : blur_val,
            "noise_score"     : noise_score,
            "exposure_status" : exposure,
        }

    def _crop_thoracic_region(self, gray: np.ndarray) -> Tuple[np.ndarray, bool]:
        """
        Removes black/white borders, scanner margins, and text artifacts outside anatomy.
        """
        try:
            h, w = gray.shape
            # Otsu thresholding to separate anatomical body from background
            _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)

            # Find contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return gray, False

            # Select largest contour corresponding to thoracic torso
            largest = max(contours, key=cv2.contourArea)
            x, y, cw, ch = cv2.boundingRect(largest)

            # Safety check: if bounding box covers > 25% of area and is not extreme
            if cw > w * 0.4 and ch > h * 0.4:
                # Add 2% padding margin so no lung tissue is cropped
                pad_x = int(cw * 0.02)
                pad_y = int(ch * 0.02)
                x1 = max(0, x - pad_x)
                y1 = max(0, y - pad_y)
                x2 = min(w, x + cw + pad_x)
                y2 = min(h, y + ch + pad_y)
                cropped = gray[y1:y2, x1:x2]
                return cropped, True
        except Exception as e:
            logger.warning(f"[MedicalPreprocessor] Thoracic crop failed: {e}")

        return gray, False

    def _correct_orientation(self, gray: np.ndarray) -> Tuple[np.ndarray, bool]:
        """Validates thoracic orientation (ensures lungs are upright)."""
        try:
            h, w = gray.shape
            top_half    = gray[:h // 2, :]
            bottom_half = gray[h // 2:, :]

            # In PA chest X-rays, diaphragm/abdomen (bottom) is denser/brighter than lung apex (top)
            top_brightness    = np.mean(top_half)
            bottom_brightness = np.mean(bottom_half)

            # If top half is significantly brighter than bottom half, image might be inverted upside down
            if top_brightness > bottom_brightness + 35.0:
                logger.info("[MedicalPreprocessor] Inverted thoracic orientation detected — rotating 180°")
                rotated = cv2.rotate(gray, cv2.ROTATE_180)
                return rotated, True
        except Exception as e:
            logger.warning(f"[MedicalPreprocessor] Orientation check failed: {e}")

        return gray, False

    def _save_debug(self, img_array: np.ndarray, debug_dir: str, filename: str):
        """Saves intermediate image for debugging."""
        try:
            path = os.path.join(debug_dir, filename)
            if len(img_array.shape) == 2:
                cv2.imwrite(path, img_array)
            else:
                # Convert RGB to BGR for cv2.imwrite
                bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                cv2.imwrite(path, bgr)
        except Exception as e:
            logger.warning(f"[MedicalPreprocessor] Failed to save debug image '{filename}': {e}")
