"""
NIH ChestX-ray14 PyTorch Dataset
==================================
Theory:
  The NIH ChestX-ray14 dataset contains 112,120 frontal-view X-ray images
  with 14 disease labels. It is a MULTI-LABEL dataset — a single image can
  have multiple diseases simultaneously (e.g., Pneumonia + Effusion).

  Label encoding:
    Each image gets a binary vector of length 14.
    labels[i] = 1  if disease i is present
    labels[i] = 0  if absent

  We use the official train_val_list.txt / test_list.txt splits from NIH
  to ensure our model is evaluated on the same split as the CheXNet paper.

  Preprocessing:
    - Resize to 224x224 (standard for ImageNet pretrained models)
    - Convert grayscale X-rays to 3-channel RGB (replicate channel)
    - Normalize with ImageNet statistics (mean=[0.485, 0.456, 0.406])
    
  Augmentation (training only):
    - Random horizontal flip (X-rays are bilaterally symmetric)
    - Random rotation ±10° (simulate patient positioning variation)
    - Random brightness/contrast (simulate exposure differences)
    - CLAHE (Contrast Limited Adaptive Histogram Equalization) — enhances
      local contrast in lung regions, improving pneumonia/atelectasis detection
    - Gaussian blur with low probability (simulate motion blur in real scans)
"""

import os
import numpy as np
import pandas as pd
from pathlib import Path
from PIL import Image
from typing import Optional, Tuple, List

import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
import torchvision.transforms as T


# =============================================================================
# NIH ChestX-ray14 — 14 Pathology Classes (official order from paper)
# =============================================================================
CHESTXRAY14_CLASSES = [
    "Atelectasis",       # Partial or complete lung collapse
    "Cardiomegaly",      # Enlarged heart shadow
    "Effusion",          # Fluid in pleural space
    "Infiltration",      # Opacity suggesting infection/fluid
    "Mass",              # Dense opacity >3cm
    "Nodule",            # Rounded opacity <3cm
    "Pneumonia",         # Consolidation pattern
    "Pneumothorax",      # Air in pleural space (emergency)
    "Consolidation",     # Airspace filling by fluid/exudate
    "Edema",             # Fluid in lung tissue (heart failure)
    "Emphysema",         # Hyperinflation, air trapping
    "Fibrosis",          # Scarring pattern
    "Pleural_Thickening",# Thickening of pleural lining
    "Hernia",            # Bowel/organ herniating into chest
]

NUM_CLASSES = len(CHESTXRAY14_CLASSES)  # 14


def get_transforms(mode: str = "train", image_size: int = 224):
    """
    Returns torchvision transforms for train/val/test splits.
    
    Train: Enhanced chest X-ray augmentations (RandomResizedCrop, Flip, Rotation ±7°, Affine, ColorJitter, Sharpness).
    Val/Test: Resize to 256, CenterCrop to target resolution (224), and normalize.
    
    ImageNet normalization statistics are used because our backbone is pretrained on ImageNet.
    """
    IMAGENET_MEAN = [0.485, 0.456, 0.406]
    IMAGENET_STD  = [0.229, 0.224, 0.225]

    if mode == "train":
        return T.Compose([
            # Step 1: Resize image to 256
            T.Resize(256),
            # Step 2: RandomResizedCrop to target image size (224x224)
            T.RandomResizedCrop(image_size, scale=(0.85, 1.0)),
            # Step 3: Random horizontal flip (lung anatomy is bilaterally symmetric)
            T.RandomHorizontalFlip(p=0.5),
            # Step 4: Small rotation simulates patient positioning variation (±7°)
            T.RandomRotation(degrees=7),
            # Step 5: Random affine adds slight translation variation (5%)
            T.RandomAffine(degrees=0, translate=(0.05, 0.05)),
            # Step 6: Color jitter for exposure variations (brightness=0.1, contrast=0.1)
            T.ColorJitter(brightness=0.1, contrast=0.1),
            # Step 7: Enhance sharpness for bone/tissue clarity
            T.RandomAdjustSharpness(sharpness_factor=2, p=0.5),
            # Step 8: Convert to Tensor
            T.ToTensor(),
            # Step 9: Normalize using ImageNet statistics
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])
    else:
        # Validation and Test: Resize to 256 then CenterCrop to target image size (224x224)
        return T.Compose([
            T.Resize(256),
            T.CenterCrop(image_size),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])


class ChestXray14Dataset(Dataset):
    """
    PyTorch Dataset for NIH ChestX-ray14.

    Expected directory structure:
        data_dir/
          ├── images/                      ← All 112,120 PNG images
          ├── Data_Entry_2017_v2020.csv    ← Label CSV
          ├── train_val_list.txt           ← Official train+val file list
          └── test_list.txt                ← Official test file list

    Args:
        data_dir   : Root directory of the dataset
        split      : 'train', 'val', or 'test'
        transform  : torchvision transforms
        val_fraction: Fraction of train_val split to use as validation (default 0.15)
        image_size : Target image size (default 224)
    """

    def __init__(
        self,
        data_dir: str,
        split: str = "train",
        transform: Optional[object] = None,
        val_fraction: float = 0.15,
        image_size: int = 224,
    ):
        super().__init__()
        self.data_dir   = Path(data_dir)
        self.images_dir = self.data_dir / "images"
        self.split      = split
        self.transform  = transform or get_transforms(split, image_size)
        self.classes    = CHESTXRAY14_CLASSES
        self.num_classes = NUM_CLASSES

        # -----------------------------------------------------------------
        # Load the main label CSV
        # -----------------------------------------------------------------
        csv_path = self._find_csv()
        self.df  = pd.read_csv(csv_path)

        # -----------------------------------------------------------------
        # Apply the official train/val/test split
        # -----------------------------------------------------------------
        self.df = self._apply_split(val_fraction)

        # -----------------------------------------------------------------
        # Parse multi-label strings into binary vectors
        # Example: "Atelectasis|Effusion" → [1,0,1,0,...,0]
        # -----------------------------------------------------------------
        self.labels = self._encode_labels()
        self.image_names = self.df["Image Index"].tolist()

        print(
            f"[Dataset] Split='{split}' | Samples={len(self.df):,} | "
            f"Classes={self.num_classes}"
        )

    def _find_csv(self) -> Path:
        """Finds the label CSV file (handles different naming conventions)."""
        for name in ["Data_Entry_2017_v2020.csv", "Data_Entry_2017.csv"]:
            path = self.data_dir / name
            if path.exists():
                return path
        raise FileNotFoundError(
            f"Label CSV not found in {self.data_dir}. "
            "Expected: Data_Entry_2017_v2020.csv"
        )

    def _apply_split(self, val_fraction: float) -> pd.DataFrame:
        """
        Applies the official NIH train/val/test split.
        
        If the official split files exist, we use them (recommended — this
        ensures our results are comparable to published benchmarks like CheXNet).
        
        If they don't exist, we do a random 70/15/15 split.
        """
        train_val_file = self.data_dir / "train_val_list.txt"
        test_file      = self.data_dir / "test_list.txt"

        if train_val_file.exists() and test_file.exists():
            # Official split — use it
            train_val_images = set(train_val_file.read_text().strip().split('\n'))
            test_images      = set(test_file.read_text().strip().split('\n'))

            if self.split == "test":
                df = self.df[self.df["Image Index"].isin(test_images)].copy()
            else:
                tv_df = self.df[self.df["Image Index"].isin(train_val_images)].copy()
                # Create a reproducible val split from train_val
                tv_df = tv_df.sample(frac=1, random_state=42).reset_index(drop=True)
                val_count = int(len(tv_df) * val_fraction)
                if self.split == "val":
                    df = tv_df.iloc[:val_count].copy()
                else:  # train
                    df = tv_df.iloc[val_count:].copy()
        else:
            # Fallback: random 70/15/15 split
            print("[Dataset] Official split files not found — using random 70/15/15 split")
            all_df = self.df.sample(frac=1, random_state=42).reset_index(drop=True)
            n = len(all_df)
            test_end  = int(n * 0.15)
            val_end   = int(n * 0.30)
            if self.split == "test":
                df = all_df.iloc[:test_end].copy()
            elif self.split == "val":
                df = all_df.iloc[test_end:val_end].copy()
            else:
                df = all_df.iloc[val_end:].copy()

        return df.reset_index(drop=True)

    def _encode_labels(self) -> np.ndarray:
        """
        Converts the "Finding Labels" string column into a binary matrix.
        
        Input:  "Atelectasis|Effusion"
        Output: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  (length 14)
        
        "No Finding" → all zeros
        """
        labels = np.zeros((len(self.df), self.num_classes), dtype=np.float32)
        class_to_idx = {c: i for i, c in enumerate(self.classes)}

        for i, finding_str in enumerate(self.df["Finding Labels"].tolist()):
            if finding_str == "No Finding":
                continue  # all zeros
            for finding in finding_str.split("|"):
                finding = finding.strip()
                if finding in class_to_idx:
                    labels[i, class_to_idx[finding]] = 1.0

        return labels

    def get_class_weights(self) -> torch.Tensor:
        """
        Computes per-class positive weights for BCEWithLogitsLoss.
        
        Theory: NIH ChestX-ray14 is severely class-imbalanced.
        For example, "Hernia" appears in only 0.2% of images, while
        "Infiltration" appears in 18%. We compute pos_weight = neg/pos
        to balance the loss contribution of rare diseases.
        
        BCEWithLogitsLoss(pos_weight=w) effectively multiplies the loss
        for positive examples by w, giving rare diseases more weight.
        """
        pos_counts = self.labels.sum(axis=0)  # [14] number of positives per class
        neg_counts = len(self.labels) - pos_counts
        # Avoid division by zero for empty classes
        pos_counts = np.maximum(pos_counts, 1)
        weights = neg_counts / pos_counts
        return torch.FloatTensor(weights)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, str]:
        """
        Returns:
            image  : FloatTensor [3, H, W] — preprocessed X-ray
            label  : FloatTensor [14]       — multi-label binary vector
            img_id : str                    — image filename (for audit)
        """
        img_name = self.image_names[idx]
        img_path = self.images_dir / img_name
        label    = torch.FloatTensor(self.labels[idx])

        # Load image — X-rays are grayscale PNGs; convert to RGB for 3-channel backbone
        img = Image.open(img_path).convert("RGB")

        if self.transform:
            img = self.transform(img)

        return img, label, img_name


def build_dataloaders(
    data_dir: str,
    batch_size: int = 32,
    num_workers: int = 4,
    image_size: int = 224,
    use_weighted_sampler: bool = True,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Builds train, val, and test DataLoaders.

    Args:
        data_dir            : Root directory of NIH ChestX-ray14
        batch_size          : Samples per batch (default 32, reduce if OOM)
        num_workers         : CPU workers for data loading (default 4)
        image_size          : Input resolution (224 for most pretrained models)
        use_weighted_sampler: Balance rare diseases during training

    Returns:
        train_loader, val_loader, test_loader
    """
    train_ds = ChestXray14Dataset(data_dir, split="train", image_size=image_size)
    val_ds   = ChestXray14Dataset(data_dir, split="val",   image_size=image_size)
    test_ds  = ChestXray14Dataset(data_dir, split="test",  image_size=image_size)

    # -----------------------------------------------------------------
    # WeightedRandomSampler: gives rare-disease images a higher chance
    # of being selected in each batch. This helps with severe imbalance
    # (e.g., "Hernia" having only ~230 positive cases).
    # -----------------------------------------------------------------
    train_sampler = None
    if use_weighted_sampler:
        # Per-sample weight = sum of class weights across its positive labels
        # Images with rare diseases get higher sampling probability
        class_weights = train_ds.get_class_weights().numpy()  # [14]
        sample_weights = []
        for i in range(len(train_ds)):
            label_vec = train_ds.labels[i]  # [14] binary
            # Weight is max of all positive class weights (prioritize rarest disease)
            w = float(np.max(label_vec * class_weights)) if label_vec.sum() > 0 else 1.0
            sample_weights.append(w)
        train_sampler = WeightedRandomSampler(
            weights=sample_weights,
            num_samples=len(sample_weights),
            replacement=True
        )

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        sampler=train_sampler,
        shuffle=(train_sampler is None),  # don't shuffle if using sampler
        num_workers=num_workers,
        pin_memory=True,      # Faster CPU→GPU transfer
        persistent_workers=(num_workers > 0),
        prefetch_factor=2 if num_workers > 0 else None,
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0),
    )

    test_loader = DataLoader(
        test_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0),
    )

    # Print class distribution summary
    print("\n[Dataset] Class Distribution (training set):")
    print(f"{'Disease':<25} {'Positives':>10} {'%':>8}")
    print("-" * 45)
    n_train = len(train_ds)
    for i, cls in enumerate(CHESTXRAY14_CLASSES):
        pos = int(train_ds.labels[:, i].sum())
        pct = 100.0 * pos / n_train
        print(f"{cls:<25} {pos:>10,} {pct:>7.2f}%")
    print()

    return train_loader, val_loader, test_loader
