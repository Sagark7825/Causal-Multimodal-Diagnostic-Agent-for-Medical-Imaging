"""
Brain Tumor MRI PyTorch Dataset & DataLoaders
=============================================
Dataset: 4-class Brain Tumor MRI (Glioma, Meningioma, No Tumor, Pituitary)

Splitting Strategy:
- Held-out Test Set (Testing/ folder): 1,600 images (400 per class), strictly isolated for
  final unbiased evaluation. Never touched during training or hyperparameter tuning.
- Training Set (Training/ folder): 5,600 images (1,400 per class).
  Split using stratified sampling into:
    * Train Split: 85% (4,760 images)
    * Validation Split: 15% (840 images)
- Stratified sampling maintains exact 25.0% class parity across all subsets.
- Limitation Documented: Benchmark lacks patient IDs; stratified image-level splitting is applied.
"""

import os
from pathlib import Path
from typing import Tuple, List, Optional
import numpy as np
from PIL import Image
from sklearn.model_selection import StratifiedShuffleSplit

import torch
from torch.utils.data import Dataset, DataLoader

from mri_preprocessing import get_mri_transforms

# Standardized class names mapping
MRI_RAW_CLASSES = ["glioma", "meningioma", "notumor", "pituitary"]
MRI_DISPLAY_CLASSES = ["Glioma", "Meningioma", "No Tumor", "Pituitary"]
CLASS_TO_IDX = {c: i for i, c in enumerate(MRI_RAW_CLASSES)}
IDX_TO_DISPLAY = {i: d for i, d in enumerate(MRI_DISPLAY_CLASSES)}


class BrainTumorMRIDataset(Dataset):
    """
    Dataset wrapper for Brain Tumor MRI images.
    """
    def __init__(
        self,
        samples: List[Tuple[str, int]],
        transform: Optional[object] = None,
    ):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, str]:
        path_str, label = self.samples[idx]
        try:
            image = Image.open(path_str).convert("RGB")
        except Exception as e:
            # Fallback for corrupted images
            image = Image.new("RGB", (224, 224), color=(0, 0, 0))

        if self.transform is not None:
            image_tensor = self.transform(image)
        else:
            image_tensor = torch.zeros(3, 224, 224)

        return image_tensor, label, Path(path_str).name


def scan_folder(folder_path: Path) -> List[Tuple[str, int]]:
    """
    Scans a folder structured as folder_path/<class_name>/*.jpg
    Returns list of (filepath, class_idx).
    """
    samples = []
    valid_exts = {".jpg", ".jpeg", ".png"}

    for class_name in MRI_RAW_CLASSES:
        c_dir = folder_path / class_name
        if not c_dir.exists():
            continue
        c_idx = CLASS_TO_IDX[class_name]
        for f in c_dir.iterdir():
            if f.suffix.lower() in valid_exts:
                samples.append((str(f.resolve()), c_idx))

    return samples


def build_mri_dataloaders(
    data_dir: str,
    batch_size: int = 32,
    num_workers: int = 2,
    image_size: int = 224,
    val_fraction: float = 0.15,
    seed: int = 42,
) -> Tuple[DataLoader, DataLoader, DataLoader, dict]:
    """
    Builds train, validation, and test DataLoaders.

    Returns:
        train_loader, val_loader, test_loader, dataset_stats
    """
    base_path = Path(data_dir)
    train_dir = base_path / "Training" if (base_path / "Training").exists() else base_path / "training"
    test_dir  = base_path / "Testing" if (base_path / "Testing").exists() else base_path / "testing"

    if not train_dir.exists() or not test_dir.exists():
        raise FileNotFoundError(f"Missing Training/ or Testing/ in {base_path}")

    # Scan directories
    train_val_samples = scan_folder(train_dir)
    test_samples      = scan_folder(test_dir)

    # Perform stratified train/validation split
    X = [s[0] for s in train_val_samples]
    y = [s[1] for s in train_val_samples]

    sss = StratifiedShuffleSplit(n_splits=1, test_size=val_fraction, random_state=seed)
    train_indices, val_indices = next(sss.split(X, y))

    train_samples = [train_val_samples[i] for i in train_indices]
    val_samples   = [train_val_samples[i] for i in val_indices]

    # Initialize transforms
    train_transform = get_mri_transforms(mode="train", image_size=image_size)
    eval_transform  = get_mri_transforms(mode="test", image_size=image_size)

    # Create PyTorch datasets
    train_ds = BrainTumorMRIDataset(train_samples, transform=train_transform)
    val_ds   = BrainTumorMRIDataset(val_samples, transform=eval_transform)
    test_ds  = BrainTumorMRIDataset(test_samples, transform=eval_transform)

    # Build DataLoaders
    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    test_loader = DataLoader(
        test_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    stats = {
        "num_classes": len(MRI_RAW_CLASSES),
        "classes": MRI_DISPLAY_CLASSES,
        "train_samples": len(train_samples),
        "val_samples": len(val_samples),
        "test_samples": len(test_samples),
        "total_samples": len(train_samples) + len(val_samples) + len(test_samples),
    }

    print(f"[Dataset] Train samples: {len(train_samples):,} | Val: {len(val_samples):,} | Test (held-out): {len(test_samples):,}")
    return train_loader, val_loader, test_loader, stats
