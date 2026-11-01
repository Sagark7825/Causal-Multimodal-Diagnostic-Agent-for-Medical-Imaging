"""
Standalone AUROC Evaluation Script — NIH ChestX-ray14 (DenseNet121)
=====================================================================
Evaluates the trained best_densenet121.pth checkpoint on the official
NIH ChestX-ray14 test split. Prints per-class AUROC for all 14 diseases
and the Macro Mean AUROC.

Usage (from ai_backend/ directory):
    python evaluate.py
    python evaluate.py --data_dir ./data/chestxray14
    python evaluate.py --data_dir ./data/chestxray14 --checkpoint ./checkpoints/best_densenet121.pth
    python evaluate.py --batch_size 32 --num_workers 0   # CPU-friendly settings

Requirements:
    - Trained checkpoint : checkpoints/best_densenet121.pth
    - Dataset            : data/chestxray14/ with images/, Data_Entry_2017_v2020.csv,
                           train_val_list.txt, test_list.txt
"""

import sys
import argparse
from pathlib import Path

# Ensure the ai_backend package root is on the path so training.* imports work
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from training.dataset import ChestXray14Dataset, get_transforms, CHESTXRAY14_CLASSES
from training.models import build_model
from training.metrics import compute_auc_per_class, compute_macro_auc


# ---------------------------------------------------------------------------
# Defaults — these mirror the values used during training (config.json)
# ---------------------------------------------------------------------------
DEFAULT_CHECKPOINT  = str(Path(__file__).parent / "checkpoints" / "best_densenet121.pth")
DEFAULT_DATA_DIR    = str(Path(__file__).parent / "data" / "chestxray14")
DEFAULT_BATCH_SIZE  = 32
DEFAULT_NUM_WORKERS = 4


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate DenseNet121 on NIH ChestX-ray14 test set (AUROC)"
    )
    parser.add_argument(
        "--checkpoint", default=DEFAULT_CHECKPOINT,
        help=f"Path to .pth checkpoint (default: {DEFAULT_CHECKPOINT})"
    )
    parser.add_argument(
        "--data_dir", default=DEFAULT_DATA_DIR,
        help=f"Root directory of NIH ChestX-ray14 dataset (default: {DEFAULT_DATA_DIR})"
    )
    parser.add_argument(
        "--batch_size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"Batch size for inference (default: {DEFAULT_BATCH_SIZE})"
    )
    parser.add_argument(
        "--num_workers", type=int, default=DEFAULT_NUM_WORKERS,
        help=f"DataLoader worker processes (default: {DEFAULT_NUM_WORKERS}; use 0 on Windows if errors)"
    )
    parser.add_argument(
        "--split", default="test", choices=["test", "val"],
        help="Dataset split to evaluate on (default: test)"
    )
    return parser.parse_args()


def load_model(checkpoint_path: str, device: torch.device):
    """
    Loads the DenseNet121 checkpoint produced by train_chestxray.py.
    The checkpoint stores weights under the 'model_state_dict' key and
    may optionally contain 'backbone' and 'num_classes' metadata.
    """
    ckpt_path = Path(checkpoint_path)
    if not ckpt_path.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {ckpt_path}\n"
            "Make sure 'best_densenet121.pth' is in the checkpoints/ directory."
        )

    print(f"[Eval] Loading checkpoint: {ckpt_path}")
    checkpoint = torch.load(str(ckpt_path), map_location=device, weights_only=False)

    # Read metadata saved alongside weights (falls back to DenseNet121 defaults)
    backbone    = checkpoint.get("backbone", "densenet121")
    num_classes = checkpoint.get("num_classes", 14)
    epoch       = checkpoint.get("epoch", "N/A")
    val_auc     = checkpoint.get("val_macro_auc", "N/A")

    print(f"[Eval] Backbone: {backbone} | Trained epoch: {epoch} | Saved Val AUC: {val_auc}")

    # Build the exact same architecture used during training (pretrained=False
    # because we are loading our own trained weights, not ImageNet weights)
    model = build_model(
        backbone=backbone,
        num_classes=num_classes,
        pretrained=False,
        device=str(device),
    )

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    print(f"[Eval] Model loaded and set to eval mode on {device}")
    return model


def build_test_loader(data_dir: str, split: str, batch_size: int, num_workers: int) -> DataLoader:
    """
    Builds a DataLoader for the test (or val) split using the same
    val/test transforms used during training:
      Resize(256) → CenterCrop(224) → ToTensor → ImageNet-normalize
    """
    transform = get_transforms(mode="val", image_size=224)  # 'val' == test-time transform
    dataset = ChestXray14Dataset(
        data_dir=data_dir,
        split=split,
        transform=transform,
    )
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=(num_workers > 0),
    )
    return loader


@torch.no_grad()
def run_inference(model, loader, device):
    """
    Runs the model over every batch in the DataLoader.

    Returns:
        y_true   : np.ndarray [N, 14] — binary ground-truth labels
        y_scores : np.ndarray [N, 14] — sigmoid probabilities (NOT thresholded)
    """
    all_labels = []
    all_probs  = []

    total = len(loader)
    for batch_idx, (images, labels, _img_names) in enumerate(loader, start=1):
        images = images.to(device)

        # Forward pass → raw logits [B, 14]
        logits = model(images)

        # Convert logits to probabilities via sigmoid — NOT thresholded
        probs = torch.sigmoid(logits).cpu().numpy()

        all_labels.append(labels.numpy())
        all_probs.append(probs)

        # Progress indicator
        if batch_idx % 10 == 0 or batch_idx == total:
            print(f"  Batch {batch_idx}/{total}", end="\r")

    print()  # newline after progress

    y_true   = np.vstack(all_labels)   # [N, 14]
    y_scores = np.vstack(all_probs)    # [N, 14]
    return y_true, y_scores


def print_auroc_results(per_class_auc: dict, macro_auc: float) -> None:
    """Prints AUROC results in the requested terminal format."""
    print()
    for cls in CHESTXRAY14_CLASSES:
        score = per_class_auc.get(cls, float("nan"))
        if not np.isnan(score):
            print(f"{cls}: {score:.4f}")
        else:
            print(f"{cls}: N/A  (no positive samples in this split)")
    print()
    print(f"Macro Mean AUROC: {macro_auc:.4f}")
    print()


def main():
    args = parse_args()

    # -----------------------------------------------------------------------
    # Device selection
    # -----------------------------------------------------------------------
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Eval] Using device: {device}")

    # -----------------------------------------------------------------------
    # 1. Load trained model (weights only — no retraining)
    # -----------------------------------------------------------------------
    model = load_model(args.checkpoint, device)

    # -----------------------------------------------------------------------
    # 2. Build test DataLoader (same transforms as training-time validation)
    # -----------------------------------------------------------------------
    print(f"[Eval] Loading '{args.split}' split from: {args.data_dir}")
    loader = build_test_loader(
        data_dir=args.data_dir,
        split=args.split,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
    )
    print(f"[Eval] Running inference on {len(loader.dataset):,} images ...")

    # -----------------------------------------------------------------------
    # 3. Run inference — collect raw sigmoid probabilities + ground-truth
    # -----------------------------------------------------------------------
    y_true, y_scores = run_inference(model, loader, device)

    # -----------------------------------------------------------------------
    # 4. Compute AUROC per class and macro mean
    #    Reuses compute_auc_per_class / compute_macro_auc from training/metrics.py
    # -----------------------------------------------------------------------
    per_class_auc = compute_auc_per_class(y_true, y_scores)
    macro_auc     = compute_macro_auc(y_true, y_scores)

    # -----------------------------------------------------------------------
    # 5. Print results
    # -----------------------------------------------------------------------
    print_auroc_results(per_class_auc, macro_auc)


if __name__ == "__main__":
    main()
