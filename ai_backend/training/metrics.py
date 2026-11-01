"""
Medical Imaging Metrics — AUC-ROC, F1, Precision, Recall, Confusion Matrix
===========================================================================
Theory:
  For multi-label chest X-ray classification, standard accuracy is misleading
  because of severe class imbalance. For example:
  - "No Finding" = 53,000 images
  - "Hernia"     =    227 images
  
  A model predicting "No Hernia" for EVERY image gets 99.8% accuracy — but
  this is clinically useless. We need disease-specific metrics:

  AUC-ROC (Area Under ROC Curve):
    - THE standard metric for medical AI benchmarking
    - Measures how well the model distinguishes between positive/negative cases
    - AUC = 0.5 → random guessing
    - AUC = 1.0 → perfect discrimination
    - Target: AUC > 0.80 per class (CheXNet achieves 0.841 macro AUC)
    - Threshold-independent: doesn't require choosing a cutoff

  Optimal Threshold Selection:
    - After training, for each class, we find the probability threshold
      that maximizes F1 score on the validation set
    - Default 0.5 is rarely optimal for imbalanced medical data

  F1 Score: harmonic mean of Precision and Recall
    F1 = 2 × (Precision × Recall) / (Precision + Recall)
    - Precision = TP / (TP + FP) → how often our positive predictions are correct
    - Recall    = TP / (TP + FN) → how often we catch actual positive cases
    - In radiology, Recall (sensitivity) is more important than Precision
      because missing a disease (false negative) is worse than over-flagging
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server environments
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from sklearn.metrics import (
    roc_auc_score,
    roc_curve,
    f1_score,
    precision_score,
    recall_score,
    average_precision_score,
    confusion_matrix,
)

from training.dataset import CHESTXRAY14_CLASSES


def compute_auc_per_class(
    y_true: np.ndarray,
    y_scores: np.ndarray,
) -> Dict[str, float]:
    """
    Computes AUC-ROC for each of the 14 disease classes.
    
    Args:
        y_true  : [N, 14] binary ground truth labels
        y_scores: [N, 14] predicted probabilities (sigmoid output)
    
    Returns:
        Dictionary mapping class name → AUC score
    """
    aucs = {}
    for i, cls in enumerate(CHESTXRAY14_CLASSES):
        gt  = y_true[:, i]
        sc  = y_scores[:, i]
        # Only compute if both positive and negative samples exist
        if len(np.unique(gt)) < 2:
            aucs[cls] = float("nan")  # Can't compute AUC with only one class
        else:
            aucs[cls] = float(roc_auc_score(gt, sc))
    return aucs


def compute_macro_auc(y_true: np.ndarray, y_scores: np.ndarray) -> float:
    """
    Computes macro-averaged AUC (average over all 14 classes).
    This is the primary metric reported in the CheXNet paper.
    """
    per_class = compute_auc_per_class(y_true, y_scores)
    valid = [v for v in per_class.values() if not np.isnan(v)]
    return float(np.mean(valid)) if valid else 0.0


def find_optimal_thresholds(
    y_true: np.ndarray,
    y_scores: np.ndarray,
) -> np.ndarray:
    """
    For each class, finds the probability threshold that maximizes F1 score.
    
    Used after training to convert probabilities to binary predictions.
    These thresholds are saved alongside the model checkpoint.
    
    Returns:
        thresholds: [14] optimal threshold per class
    """
    thresholds = np.zeros(len(CHESTXRAY14_CLASSES))
    candidate_thresholds = np.arange(0.1, 0.9, 0.05)  # 0.10, 0.15, ..., 0.85

    for i in range(len(CHESTXRAY14_CLASSES)):
        gt = y_true[:, i]
        sc = y_scores[:, i]
        if len(np.unique(gt)) < 2:
            thresholds[i] = 0.5  # Default
            continue

        best_f1 = -1
        best_thresh = 0.5
        for t in candidate_thresholds:
            preds = (sc >= t).astype(int)
            f1 = f1_score(gt, preds, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_thresh = t
        thresholds[i] = best_thresh

    return thresholds


def compute_classification_metrics(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    thresholds: Optional[np.ndarray] = None,
) -> Dict[str, Dict[str, float]]:
    """
    Computes a comprehensive set of per-class metrics.
    
    Returns:
        Dict with per-class: AUC, F1, Precision, Recall, AP
        Plus summary: macro_auc, macro_f1
    """
    if thresholds is None:
        thresholds = np.full(len(CHESTXRAY14_CLASSES), 0.5)

    # Binary predictions using per-class thresholds
    y_pred = (y_scores >= thresholds).astype(int)

    results = {}
    for i, cls in enumerate(CHESTXRAY14_CLASSES):
        gt   = y_true[:, i]
        sc   = y_scores[:, i]
        pred = y_pred[:, i]

        auc = roc_auc_score(gt, sc) if len(np.unique(gt)) >= 2 else float("nan")
        f1  = f1_score(gt, pred, zero_division=0)
        pre = precision_score(gt, pred, zero_division=0)
        rec = recall_score(gt, pred, zero_division=0)
        ap  = average_precision_score(gt, sc) if len(np.unique(gt)) >= 2 else float("nan")

        results[cls] = {
            "auc"       : round(float(auc), 4),
            "f1"        : round(float(f1), 4),
            "precision" : round(float(pre), 4),
            "recall"    : round(float(rec), 4),  # Sensitivity
            "ap"        : round(float(ap), 4),   # Average Precision
            "threshold" : round(float(thresholds[i]), 2),
        }

    # Aggregate summaries
    valid_aucs = [results[c]["auc"] for c in CHESTXRAY14_CLASSES if not np.isnan(results[c]["auc"])]
    results["__summary__"] = {
        "macro_auc" : round(float(np.mean(valid_aucs)), 4),
        "macro_f1"  : round(float(np.mean([results[c]["f1"] for c in CHESTXRAY14_CLASSES])), 4),
        "macro_pre" : round(float(np.mean([results[c]["precision"] for c in CHESTXRAY14_CLASSES])), 4),
        "macro_rec" : round(float(np.mean([results[c]["recall"] for c in CHESTXRAY14_CLASSES])), 4),
    }

    return results


def print_metrics_table(metrics: Dict) -> None:
    """Prints a formatted table of all metrics."""
    print("\n" + "=" * 85)
    print(f"{'Disease':<25} {'AUC':>7} {'F1':>7} {'Prec':>7} {'Recall':>7} {'AP':>7} {'Thresh':>7}")
    print("-" * 85)
    for cls in CHESTXRAY14_CLASSES:
        m = metrics[cls]
        auc_str = f"{m['auc']:.4f}" if not np.isnan(m['auc']) else "  N/A  "
        print(
            f"{cls:<25} {auc_str:>7} {m['f1']:>7.4f} "
            f"{m['precision']:>7.4f} {m['recall']:>7.4f} "
            f"{m['ap']:>7.4f} {m['threshold']:>7.2f}"
        )
    print("-" * 85)
    s = metrics["__summary__"]
    print(
        f"{'MACRO AVERAGE':<25} {s['macro_auc']:>7.4f} {s['macro_f1']:>7.4f} "
        f"{s['macro_pre']:>7.4f} {s['macro_rec']:>7.4f}"
    )
    print("=" * 85 + "\n")


def plot_roc_curves(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    save_dir: str = "checkpoints",
) -> str:
    """
    Plots ROC curves for all 14 pathology classes.
    Saves to a PNG file and returns the path.
    """
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    out_file = save_path / "roc_curves.png"

    fig, axes = plt.subplots(4, 4, figsize=(20, 20))
    axes = axes.flatten()

    colors = plt.cm.tab20(np.linspace(0, 1, len(CHESTXRAY14_CLASSES)))

    for i, (cls, color) in enumerate(zip(CHESTXRAY14_CLASSES, colors)):
        ax = axes[i]
        gt = y_true[:, i]
        sc = y_scores[:, i]

        if len(np.unique(gt)) >= 2:
            fpr, tpr, _ = roc_curve(gt, sc)
            auc = roc_auc_score(gt, sc)
            ax.plot(fpr, tpr, color=color, lw=2, label=f"AUC = {auc:.3f}")
        else:
            ax.text(0.5, 0.5, "No positive samples", ha='center', va='center', color='red')

        ax.plot([0, 1], [0, 1], 'k--', lw=1, alpha=0.5)
        ax.set_xlabel("False Positive Rate", fontsize=9)
        ax.set_ylabel("True Positive Rate", fontsize=9)
        ax.set_title(cls, fontsize=10, fontweight='bold')
        ax.legend(loc="lower right", fontsize=9)
        ax.set_xlim([0, 1])
        ax.set_ylim([0, 1.05])
        ax.grid(alpha=0.3)

    # Hide unused subplots (14 classes, 16 slots)
    for j in range(len(CHESTXRAY14_CLASSES), len(axes)):
        axes[j].set_visible(False)

    plt.suptitle("ROC Curves — NIH ChestX-ray14 (14 Pathologies)", fontsize=14, fontweight='bold')
    plt.tight_layout(rect=[0, 0, 1, 0.97])
    plt.savefig(out_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"[Metrics] ROC curves saved: {out_file}")
    return str(out_file)


def plot_confusion_matrices(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    thresholds: np.ndarray,
    save_dir: str = "checkpoints",
    top_k: int = 6,
) -> str:
    """
    Plots confusion matrices for the top-k most prevalent diseases.
    Saves to PNG and returns path.
    """
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    out_file = save_path / "confusion_matrices.png"

    y_pred = (y_scores >= thresholds).astype(int)

    # Select top_k classes by positive count (most clinically relevant)
    pos_counts = y_true.sum(axis=0)
    top_k_indices = np.argsort(pos_counts)[::-1][:top_k]

    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()

    for plot_idx, class_idx in enumerate(top_k_indices):
        cls = CHESTXRAY14_CLASSES[class_idx]
        gt   = y_true[:, class_idx]
        pred = y_pred[:, class_idx]
        cm = confusion_matrix(gt, pred)

        ax = axes[plot_idx]
        im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
        ax.set_title(f"{cls}\n(n={int(pos_counts[class_idx]):,} positives)", fontsize=10)
        ax.set_xlabel("Predicted", fontsize=9)
        ax.set_ylabel("True", fontsize=9)
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.set_xticklabels(["Neg", "Pos"])
        ax.set_yticklabels(["Neg", "Pos"])

        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]), ha='center', va='center',
                       color='white' if cm[i, j] > cm.max() / 2 else 'black',
                       fontsize=11, fontweight='bold')

    plt.suptitle("Confusion Matrices — Top Prevalent Pathologies", fontsize=13, fontweight='bold')
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(out_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"[Metrics] Confusion matrices saved: {out_file}")
    return str(out_file)


class MetricsTracker:
    """
    Tracks and accumulates predictions/labels across batches during validation.
    
    Usage:
        tracker = MetricsTracker()
        for batch in val_loader:
            preds = model(batch)
            tracker.update(labels, probs)
        metrics = tracker.compute()
    """

    def __init__(self):
        self.all_labels = []
        self.all_probs  = []

    def update(self, labels: np.ndarray, probs: np.ndarray):
        """Add batch predictions and labels."""
        self.all_labels.append(labels)
        self.all_probs.append(probs)

    def compute(self, thresholds: Optional[np.ndarray] = None) -> Dict:
        """Compute all metrics across accumulated batches."""
        y_true   = np.vstack(self.all_labels)   # [N, 14]
        y_scores = np.vstack(self.all_probs)     # [N, 14]
        return compute_classification_metrics(y_true, y_scores, thresholds)

    def get_arrays(self) -> Tuple[np.ndarray, np.ndarray]:
        """Returns concatenated arrays for further analysis."""
        return np.vstack(self.all_labels), np.vstack(self.all_probs)

    def reset(self):
        self.all_labels = []
        self.all_probs  = []
