"""
MRI Training & Evaluation Pipeline — Brain Tumor Classification
================================================================
Architecture: EfficientNet-B0 (Lightweight Transfer Learning)
Dataset: 4-class Brain Tumor MRI (Glioma, Meningioma, No Tumor, Pituitary)

Execution Protocol:
1. Load dataset with stratified train/val split and isolated held-out test set.
2. Train EfficientNet-B0 with AdamW, Cosine Annealing, AMP on RTX 3060 6GB.
3. Save best checkpoint based on validation loss / accuracy.
4. Strictly evaluate best model on the held-out test set (1,600 images).
5. Compute and export actual metrics:
   - Overall Accuracy
   - Macro & Weighted Precision, Recall, F1-Score
   - Per-class Precision, Recall, F1-Score, Support
   - 4x4 Confusion Matrix
   - Macro Multi-class ROC-AUC (One-vs-Rest)
6. Save:
   - mri_checkpoints/best_mri_model.pth
   - mri_checkpoints/metrics.json
   - mri_checkpoints/config.json
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
import numpy as np

# Ensure parent directory is on sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.amp import autocast, GradScaler
from torchvision import models
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    roc_auc_score,
)

from training.mri_dataset import build_mri_dataloaders, MRI_DISPLAY_CLASSES, MRI_RAW_CLASSES


def build_mri_model(num_classes: int = 4, pretrained: bool = True) -> nn.Module:
    """
    Builds EfficientNet-B0 with a 4-class classification head.
    EfficientNet-B0 is selected as a lightweight transfer-learning architecture
    that fits the available RTX 3060 6GB hardware and is suitable for the
    defined MRI classification task.
    """
    weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
    model = models.efficientnet_b0(weights=weights)

    # In EfficientNet-B0, classifier is Sequential(Dropout(p=0.2), Linear(1280, 1000))
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, num_classes)
    )
    return model


def train_one_epoch(model, loader, criterion, optimizer, scaler, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels, _ in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad(set_to_none=True)

        with autocast(device_type=device.type, enabled=(device.type == "cuda")):
            logits = model(images)
            loss = criterion(logits, labels)

        if scaler:
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            optimizer.step()

        running_loss += loss.item() * images.size(0)
        preds = torch.argmax(logits, dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc


@torch.no_grad()
def evaluate_model(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_labels = []
    all_probs = []

    for images, labels, _ in loader:
        images, labels = images.to(device), labels.to(device)

        with autocast(device_type=device.type, enabled=(device.type == "cuda")):
            logits = model(images)
            if criterion:
                loss = criterion(logits, labels)
                running_loss += loss.item() * images.size(0)

        probs = torch.softmax(logits, dim=1).cpu().numpy()
        preds = np.argmax(probs, axis=1)

        all_probs.append(probs)
        all_preds.extend(preds)
        all_labels.extend(labels.cpu().numpy())

    total = len(all_labels)
    eval_loss = (running_loss / total) if criterion else 0.0
    all_probs = np.vstack(all_probs)
    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)

    acc = accuracy_score(all_labels, all_preds)
    return eval_loss, acc, all_labels, all_preds, all_probs


def run_training_pipeline(args):
    # Set seeds for reproducibility
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[MRI Training] Initializing on device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build DataLoaders
    print(f"[MRI Training] Loading dataset from: {args.data_dir}")
    train_loader, val_loader, test_loader, stats = build_mri_dataloaders(
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        image_size=args.image_size,
        val_fraction=0.15,
        seed=args.seed
    )

    # 2. Build Model
    model = build_mri_model(num_classes=stats["num_classes"], pretrained=True).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)
    scaler = GradScaler("cuda") if device.type == "cuda" else None

    best_val_acc = 0.0
    best_model_path = checkpoint_dir / "best_mri_model.pth"

    print("\n" + "=" * 65)
    print(f"TRAINING EFFICIENTNET-B0 ON BRAIN TUMOR MRI ({args.epochs} EPOCHS)")
    print("=" * 65)

    start_time = time.time()
    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, scaler, device)
        val_loss, val_acc, _, _, _ = evaluate_model(model, val_loader, criterion, device)
        scheduler.step()
        elapsed = time.time() - t0

        is_best = val_acc > best_val_acc
        if is_best:
            best_val_acc = val_acc
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_accuracy": val_acc,
                "architecture": "efficientnet_b0",
                "num_classes": stats["num_classes"],
                "classes": MRI_DISPLAY_CLASSES,
                "raw_classes": MRI_RAW_CLASSES,
                "image_size": args.image_size,
            }, str(best_model_path))

        status_flag = "[BEST]" if is_best else ""
        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] ({elapsed:.1f}s) | Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | Val Loss: {val_loss:.4f} Acc: {val_acc:.4f} {status_flag}", flush=True)

    total_training_time = time.time() - start_time
    print(f"\n[MRI Training] Training completed in {total_training_time/60:.1f} minutes.")
    print(f"[MRI Training] Best validation accuracy: {best_val_acc:.4f}")

    # =========================================================================
    # 3. STRICT EVALUATION ON HELD-OUT TEST SET
    # =========================================================================
    print("\n" + "=" * 65)
    print("HELD-OUT TEST SET EVALUATION (UNBIASED BENCHMARK)")
    print("=" * 65)

    # Load best weights
    best_checkpoint = torch.load(str(best_model_path), map_location=device, weights_only=False)
    model.load_state_dict(best_checkpoint["model_state_dict"])
    model.eval()

    test_loss, test_acc, y_true, y_pred, y_prob = evaluate_model(model, test_loader, criterion, device)

    # Calculate rigorous metrics
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    p_per_class, r_per_class, f1_per_class, support = precision_recall_fscore_support(y_true, y_pred, average=None, zero_division=0)

    # One-vs-Rest Macro ROC-AUC
    try:
        # One-hot encode ground truth for multiclass ROC-AUC
        y_true_one_hot = np.eye(stats["num_classes"])[y_true]
        roc_auc_macro = float(roc_auc_score(y_true_one_hot, y_prob, average="macro", multi_class="ovr"))
    except Exception as e:
        roc_auc_macro = float("nan")

    cm = confusion_matrix(y_true, y_pred)

    print(f"\nOverall Test Accuracy: {test_acc:.4f} ({test_acc * 100:.2f}%)")
    print(f"Macro Precision       : {p_macro:.4f}")
    print(f"Macro Recall          : {r_macro:.4f}")
    print(f"Macro F1-Score        : {f1_macro:.4f}")
    if not np.isnan(roc_auc_macro):
        print(f"Macro ROC-AUC (OvR)   : {roc_auc_macro:.4f}")

    print("\nPer-Class Performance Table:")
    print(f"{'Class':<15} {'Precision':>10} {'Recall':>10} {'F1-Score':>10} {'Support':>10}")
    print("-" * 60)
    per_class_results = {}
    for i, c_name in enumerate(MRI_DISPLAY_CLASSES):
        per_class_results[c_name] = {
            "precision": round(float(p_per_class[i]), 4),
            "recall": round(float(r_per_class[i]), 4),
            "f1_score": round(float(f1_per_class[i]), 4),
            "support": int(support[i]),
        }
        print(f"{c_name:<15} {p_per_class[i]:>10.4f} {r_per_class[i]:>10.4f} {f1_per_class[i]:>10.4f} {support[i]:>10,}")
    print("-" * 60)

    print("\nConfusion Matrix (Row=True, Col=Pred):")
    print(f"{'':<15} " + " ".join([f"{c[:6]:>7}" for c in MRI_DISPLAY_CLASSES]))
    for i, row in enumerate(cm):
        row_str = " ".join([f"{val:>7}" for val in row])
        print(f"{MRI_DISPLAY_CLASSES[i]:<15} {row_str}")

    # Save comprehensive metrics JSON
    metrics_data = {
        "dataset": "Brain Tumor MRI Dataset (4 classes)",
        "model_architecture": "EfficientNet-B0",
        "test_samples": len(y_true),
        "overall_accuracy": round(float(test_acc), 4),
        "macro_precision": round(float(p_macro), 4),
        "macro_recall": round(float(r_macro), 4),
        "macro_f1": round(float(f1_macro), 4),
        "weighted_f1": round(float(f1_weighted), 4),
        "macro_roc_auc": round(float(roc_auc_macro), 4) if not np.isnan(roc_auc_macro) else None,
        "per_class": per_class_results,
        "confusion_matrix": cm.tolist(),
        "classes": MRI_DISPLAY_CLASSES,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    metrics_file = checkpoint_dir / "metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"\n[MRI Training] Metrics saved to: {metrics_file.resolve()}")

    # Save config JSON
    config_data = {
        "data_dir": args.data_dir,
        "architecture": "efficientnet_b0",
        "num_classes": stats["num_classes"],
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.lr,
        "image_size": args.image_size,
        "val_fraction": 0.15,
        "seed": args.seed,
        "trained_on_gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "best_val_accuracy": round(float(best_val_acc), 4),
        "test_accuracy": round(float(test_acc), 4),
    }

    config_file = checkpoint_dir / "config.json"
    with open(config_file, "w") as f:
        json.dump(config_data, f, indent=2)
    print(f"[MRI Training] Config saved to: {config_file.resolve()}")

    # Update checkpoint with test accuracy
    best_checkpoint["test_accuracy"] = round(float(test_acc), 4)
    best_checkpoint["test_macro_f1"] = round(float(f1_macro), 4)
    torch.save(best_checkpoint, str(best_model_path))
    print(f"[MRI Training] Checkpoint verified and saved at: {best_model_path.resolve()}\n")

    return metrics_data


def main():
    parser = argparse.ArgumentParser(description="Train EfficientNet-B0 on Brain Tumor MRI Dataset")
    parser.add_argument("--data_dir", default="./data/brain_tumor_mri", help="Path to brain tumor MRI dataset")
    parser.add_argument("--checkpoint_dir", default="./mri_checkpoints", help="Directory to save checkpoints")
    parser.add_argument("--epochs", type=int, default=15, help="Number of training epochs (default: 15)")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size (default: 32)")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate (default: 3e-4)")
    parser.add_argument("--image_size", type=int, default=224, help="Image resolution (default: 224)")
    parser.add_argument("--num_workers", type=int, default=2, help="DataLoader workers (default: 2)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    args = parser.parse_args()

    run_training_pipeline(args)


if __name__ == "__main__":
    main()
