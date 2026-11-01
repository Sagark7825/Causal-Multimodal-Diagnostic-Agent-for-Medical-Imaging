"""
DenseNet121 Training Script — NIH ChestX-ray14 (SOTA Optimization Pipeline)
=============================================================================
Production-quality training loop featuring:
  ✅ Progressive Fine-Tuning (3-Stage Unfreezing: Classifier → DenseBlock4 → Full Model)
  ✅ Frozen BatchNorm statistics (running_mean, running_var, gamma, beta frozen)
  ✅ Differential Learning Rates with AdamW optimizer (weight decay 1e-4)
  ✅ Asymmetric Focal Loss (gamma_pos=1, gamma_neg=4) for imbalanced multi-label classification
  ✅ Warmup (3 epochs) + CosineAnnealingWarmRestarts (T_0=10, T_mult=2, eta_min=1e-6)
  ✅ Exponential Moving Average (EMA, decay=0.999) for validation & test evaluation
  ✅ Test-Time Augmentation (TTA: Original + Horizontal Flip + Center Crop) on Test set
  ✅ Dual Checkpoint saving: best_densenet121.pth (Best AUC) & best_loss_densenet121.pth (Best Loss)
  ✅ Gradient Accumulation (steps=2) & Mixed Precision (AMP) with max_norm=1.0 clipping
  ✅ Early Stopping (Patience = 15 epochs based on Val Macro AUC)
  ✅ Comprehensive logging (VRAM, throughput, ETA, stage, LRs, best AUC & Loss) & Summary
"""

import os
import sys
import time
import math
import json
import csv
import copy
import random
import argparse
import logging
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.amp import GradScaler, autocast

# Try TensorBoard import safely
try:
    from torch.utils.tensorboard import SummaryWriter
    HAS_TENSORBOARD = True
except ImportError:
    HAS_TENSORBOARD = False

from training.dataset import build_dataloaders, CHESTXRAY14_CLASSES
from training.models import build_model
from training.metrics import (
    MetricsTracker,
    compute_macro_auc,
    find_optimal_thresholds,
    compute_classification_metrics,
    print_metrics_table,
    plot_roc_curves,
    plot_confusion_matrices,
)
from sklearn.metrics import roc_auc_score, average_precision_score


# =============================================================================
# CONFIGURATION — Default settings for DenseNet121 training
# =============================================================================

CONFIG = {
    "DATA_DIR"            : "./data/chestxray14",
    "BACKBONE"            : "densenet121",
    "EPOCHS"              : 50,
    "BATCH_SIZE"          : 16,           # Per-step batch size (effective batch = 16 * 2 = 32)
    "ACCUMULATION_STEPS"  : 2,            # Gradient accumulation steps for VRAM efficiency
    "IMAGE_SIZE"          : 224,          # Input resolution
    "WEIGHT_DECAY"        : 1e-4,         # L2 regularization for AdamW
    "NUM_WORKERS"         : 4,
    "WARMUP_EPOCHS"       : 3,            # 3-epoch linear warmup
    "EARLY_STOP_PATIENCE" : 15,           # Patience = 15 epochs
    "MIN_DELTA"           : 0.001,
    "USE_AMP"             : True,         # Mixed precision
    "CHECKPOINT_DIR"      : "./checkpoints",
    "SAVE_EVERY_N"        : 5,
    "RESUME"              : None,
    "GRAD_CLIP"           : 1.0,          # Max norm gradient clipping
    "USE_WEIGHTED_SAMPLER": True,
    "EMA_DECAY"           : 0.999,        # Exponential Moving Average decay
    "SEED"                : 42,
}


# =============================================================================
# Reproducibility Helper
# =============================================================================

def seed_everything(seed: int = 42):
    """Ensures complete deterministic reproducibility across libraries."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


# =============================================================================
# BatchNorm Freezing Helper
# =============================================================================

def freeze_batchnorm(model: nn.Module):
    """
    Freezes all BatchNorm layers during fine-tuning:
    - Sets module to evaluation mode (running_mean and running_var are frozen).
    - Disables gradients for weight (gamma) and bias (beta).
    """
    for m in model.modules():
        if isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
            m.eval()
            if m.weight is not None:
                m.weight.requires_grad = False
            if m.bias is not None:
                m.bias.requires_grad = False


# =============================================================================
# Asymmetric Focal Loss (Multi-Label Medical Classification)
# =============================================================================

class AsymmetricFocalLoss(nn.Module):
    """
    Asymmetric Focal Loss for multi-label medical image classification.
    
    Designed to address extreme positive/negative imbalance in Chest X-rays:
    - gamma_pos controls hard-example focusing for positive cases (default 1)
    - gamma_neg penalizes easy negative false positives more aggressively (default 4)
    - pos_weight up-weights rare positive pathologies
    - Numerically stable under float16 mixed precision (AMP)
    """

    def __init__(self, gamma_pos: float = 1.0, gamma_neg: float = 4.0, pos_weight: torch.Tensor = None, eps: float = 1e-8):
        super().__init__()
        self.gamma_pos  = gamma_pos
        self.gamma_neg  = gamma_neg
        self.eps        = eps
        if pos_weight is not None:
            self.register_buffer("pos_weight", pos_weight.clone().detach())
        else:
            self.pos_weight = None

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        targets = targets.to(dtype=logits.dtype)
        
        # Clamp logits to prevent extreme values during mixed precision training
        logits = torch.clamp(logits, -30.0, 30.0)

        # Numerically stable base Binary Cross Entropy with Logits (log-sum-exp trick)
        bce_loss = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")

        # Probabilities calculated without detach so focal weights remain differentiable
        probs = torch.sigmoid(logits)
        probs_pos = probs
        probs_neg = 1.0 - probs

        # Focal weighting factors
        focal_pos = (1.0 - probs_pos).pow(self.gamma_pos)
        focal_neg = (1.0 - probs_neg).pow(self.gamma_neg)
        focal_factor = targets * focal_pos + (1.0 - targets) * focal_neg

        # Combine focal factor with BCE loss
        loss = focal_factor * bce_loss

        # Apply positive class weighting if provided
        if self.pos_weight is not None:
            pos_weight_factor = targets * self.pos_weight.unsqueeze(0) + (1.0 - targets) * 1.0
            loss = loss * pos_weight_factor

        return loss.mean()


# =============================================================================
# Exponential Moving Average (EMA) Engine
# =============================================================================

class EMAModel:
    """
    Exponential Moving Average of model parameters.
    Evaluated during validation, checkpointing, and testing for improved stability.
    """

    def __init__(self, model: nn.Module, decay: float = 0.999):
        self.decay = decay
        self.ema_state_dict = copy.deepcopy(model.state_dict())

    @torch.no_grad()
    def update(self, model: nn.Module):
        model_state = model.state_dict()
        for key, param in model_state.items():
            if key in self.ema_state_dict:
                if param.dtype in (torch.float32, torch.float16, torch.bfloat16):
                    self.ema_state_dict[key].mul_(self.decay).add_(param.detach(), alpha=1.0 - self.decay)
                else:
                    self.ema_state_dict[key].copy_(param.detach())

    def apply_shadow(self, model: nn.Module) -> dict:
        """Saves active model weights and loads EMA weights into the model."""
        active_state_dict = copy.deepcopy(model.state_dict())
        model.load_state_dict(self.ema_state_dict)
        return active_state_dict

    def restore(self, model: nn.Module, active_state_dict: dict):
        """Restores original active training weights back to the model."""
        model.load_state_dict(active_state_dict)


# =============================================================================
# Dataset Verification
# =============================================================================

def verify_dataset(data_dir: str):
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset directory does not exist: {data_dir}")

    images_dir = data_path / "images"
    if not images_dir.exists() or not images_dir.is_dir():
        raise FileNotFoundError(f"Images folder does not exist at: {images_dir}")

    csv_files = list(data_path.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV label file found in dataset directory: {data_dir}")


# =============================================================================
# Logging & TensorBoard Setup
# =============================================================================

def setup_logging(checkpoint_dir: str) -> tuple:
    Path(checkpoint_dir).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = Path(checkpoint_dir) / f"training_{timestamp}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout),
        ]
    )
    logger = logging.getLogger("ChestXrayTrainer")

    tb_writer = None
    if HAS_TENSORBOARD:
        tb_dir = Path(checkpoint_dir) / "runs" / timestamp
        tb_writer = SummaryWriter(log_dir=str(tb_dir))
        logger.info(f"TensorBoard logging initialized at: {tb_dir}")

    return logger, tb_writer


# =============================================================================
# Progressive Unfreezing & Parameter Group Helpers
# =============================================================================

def get_densenet_param_groups(model: nn.Module):
    """
    Partitions DenseNet121 into 3 parameter groups:
    1. Classifier: model.classifier
    2. DenseBlock4 & Transition3: model.features.denseblock4, model.features.transition3
    3. Rest of Backbone: Remaining features layers
    """
    classifier_params = list(model.classifier.parameters())
    
    db4_trans3_params = []
    rest_backbone_params = []

    if hasattr(model, "features"):
        for name, param in model.features.named_parameters():
            if "denseblock4" in name or "transition3" in name:
                db4_trans3_params.append(param)
            else:
                rest_backbone_params.append(param)
    else:
        rest_backbone_params = list(model.parameters())

    return classifier_params, db4_trans3_params, rest_backbone_params


def set_stage_unfreezing(model: nn.Module, stage: int, logger: logging.Logger):
    """
    Applies Progressive Fine-Tuning unfreezing logic:
    - Stage 1 (Epochs 1-5): Freeze features. Train ONLY classifier.
    - Stage 2 (Epochs 6-10): Unfreeze denseblock4, transition3, classifier.
    - Stage 3 (Epochs 11+): Unfreeze complete DenseNet backbone.
    Always freezes BatchNorm statistics.
    """
    classifier_params, db4_trans3_params, rest_backbone_params = get_densenet_param_groups(model)

    if stage == 1:
        logger.info(">>> STAGE 1 (Epochs 1-5): Training ONLY model.classifier. Freezing entire DenseNet backbone.")
        for p in rest_backbone_params:
            p.requires_grad = False
        for p in db4_trans3_params:
            p.requires_grad = False
        for p in classifier_params:
            p.requires_grad = True

    elif stage == 2:
        logger.info(">>> STAGE 2 (Epochs 6-10): Unfreezing denseblock4, transition3, and classifier. Freezing earlier layers.")
        for p in rest_backbone_params:
            p.requires_grad = False
        for p in db4_trans3_params:
            p.requires_grad = True
        for p in classifier_params:
            p.requires_grad = True

    else:  # Stage 3
        logger.info(">>> STAGE 3 (Epochs 11+): Unfreezing complete DenseNet model for full end-to-end fine-tuning.")
        for p in rest_backbone_params:
            p.requires_grad = True
        for p in db4_trans3_params:
            p.requires_grad = True
        for p in classifier_params:
            p.requires_grad = True

    # Freeze all BatchNorm parameters and running statistics
    freeze_batchnorm(model)


def get_base_lrs_for_stage(stage: int) -> dict:
    """Returns base learning rates for each parameter group based on stage."""
    if stage == 1:
        return {"classifier": 1e-3, "db4": 0.0, "rest": 0.0}
    elif stage == 2:
        return {"classifier": 1e-4, "db4": 1e-4, "rest": 0.0}
    else:  # Stage 3
        return {"classifier": 3e-5, "db4": 3e-5, "rest": 3e-5}


def build_adamw_param_groups(model: nn.Module, stage_lrs_dict: dict, weight_decay: float = 1e-4) -> list:
    """
    Constructs AdamW parameter groups with:
    1. Differential learning rates per module group (Classifier, DenseBlock4/Transition3, Rest of Backbone).
    2. Weight decay separation: Applies L2 weight decay ONLY to 2D+ parameters (weights, conv kernels)
       while excluding 1D parameters (biases, normalization vectors) to prevent over-regularization.
    """
    classifier_params, db4_trans3_params, rest_backbone_params = get_densenet_param_groups(model)

    groups = []
    param_tuples = [
        (classifier_params, stage_lrs_dict["classifier"]),
        (db4_trans3_params, stage_lrs_dict["db4"]),
        (rest_backbone_params, stage_lrs_dict["rest"]),
    ]

    for params, lr in param_tuples:
        decay_params = [p for p in params if p.dim() >= 2]
        no_decay_params = [p for p in params if p.dim() < 2]

        if decay_params:
            groups.append({"params": decay_params, "lr": lr, "weight_decay": weight_decay})
        if no_decay_params:
            groups.append({"params": no_decay_params, "lr": lr, "weight_decay": 0.0})

    return groups


# =============================================================================
# Warmup + CosineAnnealingWarmRestarts Scheduler
# =============================================================================

class WarmupCosineWarmRestarts:
    """
    Combines a 3-epoch linear warmup with CosineAnnealingWarmRestarts (T_0=10, T_mult=2, eta_min=1e-6).
    Respects differential base learning rates per parameter group and stage transitions.
    """

    def __init__(self, optimizer, warmup_epochs=3, T_0=10, T_mult=2, eta_min=1e-6):
        self.optimizer      = optimizer
        self.warmup_epochs  = warmup_epochs
        self.T_0            = T_0
        self.T_mult         = T_mult
        self.eta_min        = eta_min

    def get_lr(self, epoch: int, stage_lrs: list) -> list:
        lrs = []
        if epoch <= self.warmup_epochs:
            warmup_factor = epoch / float(self.warmup_epochs)
            for base_lr in stage_lrs:
                if base_lr <= 0.0:
                    lrs.append(0.0)
                else:
                    lrs.append(self.eta_min + warmup_factor * (base_lr - self.eta_min))
        else:
            curr_epoch = epoch - self.warmup_epochs - 1
            T_i = self.T_0
            i_restart = 0
            while curr_epoch >= T_i:
                curr_epoch -= T_i
                T_i *= self.T_mult
                i_restart += 1
            
            T_cur = curr_epoch
            for base_lr in stage_lrs:
                if base_lr <= 0.0:
                    lrs.append(0.0)
                else:
                    cosine_factor = 0.5 * (1.0 + math.cos(math.pi * T_cur / float(T_i)))
                    lrs.append(self.eta_min + (base_lr - self.eta_min) * cosine_factor)
        return lrs

    def step(self, epoch: int, stage_lrs: list):
        lrs = self.get_lr(epoch, stage_lrs)
        for pg, lr in zip(self.optimizer.param_groups, lrs):
            pg["lr"] = lr
        return lrs

    def state_dict(self) -> dict:
        """Returns scheduler configuration and state as a dictionary."""
        return {
            "warmup_epochs": self.warmup_epochs,
            "T_0"          : self.T_0,
            "T_mult"       : self.T_mult,
            "eta_min"      : self.eta_min,
        }

    def load_state_dict(self, state_dict: dict):
        """Restores scheduler configuration from state dictionary."""
        if not isinstance(state_dict, dict):
            return
        if "warmup_epochs" in state_dict:
            self.warmup_epochs = state_dict["warmup_epochs"]
        if "T_0" in state_dict:
            self.T_0 = state_dict["T_0"]
        if "T_mult" in state_dict:
            self.T_mult = state_dict["T_mult"]
        if "eta_min" in state_dict:
            self.eta_min = state_dict["eta_min"]


# =============================================================================
# Training Loop
# =============================================================================

def train_one_epoch(
    model, loader, optimizer, criterion, scaler, ema, device, logger, epoch, stage, accumulation_steps=2
) -> tuple:
    """
    Executes one training epoch with gradient accumulation, AMP, clipping, and throughput tracking.
    """
    model.train()
    freeze_batchnorm(model)  # Ensure BatchNorm layers remain in eval mode

    total_loss   = 0.0
    num_batches  = len(loader)
    total_images = len(loader.dataset)
    start_time   = time.time()
    
    optimizer.zero_grad(set_to_none=True)

    for batch_idx, (images, labels, _) in enumerate(loader):
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        with autocast(device_type=device.type, enabled=(device.type == "cuda" and CONFIG["USE_AMP"])):
            logits = model(images)
            loss   = criterion(logits, labels)
            loss_scaled = loss / accumulation_steps

        # -----------------------------------------------------------------
        # 1. Detect NaN/Inf Loss — Skip bad batch before backward pass
        # -----------------------------------------------------------------
        if not torch.isfinite(loss):
            logger.warning(
                f"⚠️ Epoch {epoch:02d} | Batch {batch_idx+1:4d}: Non-finite loss detected ({loss.item()}). "
                f"Skipping backward pass to prevent gradient corruption."
            )
            optimizer.zero_grad(set_to_none=True)
            continue

        scaler.scale(loss_scaled).backward()

        if (batch_idx + 1) % accumulation_steps == 0 or (batch_idx + 1) == num_batches:
            scaler.unscale_(optimizer)

            # -------------------------------------------------------------
            # 2. Gradient Validation — Check for NaN/Inf in gradients
            # -------------------------------------------------------------
            grad_is_finite = True
            for p in model.parameters():
                if p.requires_grad and p.grad is not None:
                    if not torch.isfinite(p.grad).all():
                        grad_is_finite = False
                        break

            if not grad_is_finite:
                logger.warning(
                    f"⚠️ Epoch {epoch:02d} | Batch {batch_idx+1:4d}: Non-finite gradient detected. "
                    f"Skipping optimizer step."
                )
                optimizer.zero_grad(set_to_none=True)
                scaler.update()
                continue

            # -------------------------------------------------------------
            # 3. Gradient Norm Logging & Clipping
            # -------------------------------------------------------------
            grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), CONFIG["GRAD_CLIP"])
            if grad_norm > 100.0:
                logger.warning(f"⚠️ Epoch {epoch:02d} | Batch {batch_idx+1:4d}: High gradient norm detected ({grad_norm:.2f}). Clipped to {CONFIG['GRAD_CLIP']}.")

            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
            ema.update(model)

        total_loss += loss.item() * images.size(0)

        # Logging every 50 batches
        if (batch_idx + 1) % 50 == 0 or (batch_idx + 1) == num_batches:
            elapsed = time.time() - start_time
            processed_imgs = (batch_idx + 1) * images.size(0)
            imgs_per_sec = processed_imgs / max(elapsed, 1e-5)
            eta = (num_batches - (batch_idx + 1)) * (elapsed / (batch_idx + 1))

            current_lrs = [f"{pg['lr']:.2e}" for pg in optimizer.param_groups if pg['lr'] > 0]
            lr_str = "/".join(current_lrs) if current_lrs else "0.0"

            logger.info(
                f"Stage {stage} | Ep {epoch:02d} | Batch {batch_idx+1:4d}/{num_batches} | "
                f"Loss: {loss.item():.4f} | Speed: {imgs_per_sec:.1f} img/s | LR: {lr_str} | ETA: {eta:.0f}s"
            )

    avg_loss = total_loss / total_images
    elapsed_time = time.time() - start_time
    throughput = total_images / max(elapsed_time, 1e-5)
    return avg_loss, throughput


@torch.no_grad()
def validate(model, loader, criterion, device, ema=None) -> tuple:
    """
    Evaluates model on validation set. Uses EMA weights if provided.
    Returns: (val_loss, macro_auc, macro_ap, y_true, y_scores, act_stats)
    """
    active_weights = None
    if ema is not None:
        active_weights = ema.apply_shadow(model)

    model.eval()
    tracker    = MetricsTracker()
    total_loss = 0.0

    min_logit = float("inf")
    max_logit = float("-inf")
    min_prob  = float("inf")
    max_prob  = float("-inf")

    for images, labels, _ in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        with autocast(device_type=device.type, enabled=(device.type == "cuda" and CONFIG["USE_AMP"])):
            logits = model(images)
            loss   = criterion(logits, labels)

        probs_t = torch.sigmoid(logits)
        probs   = probs_t.cpu().numpy()
        tracker.update(labels.cpu().numpy(), probs)
        total_loss += loss.item() * images.size(0)

        # Track activation statistics across validation batches
        min_logit = min(min_logit, float(logits.min().cpu()))
        max_logit = max(max_logit, float(logits.max().cpu()))
        min_prob  = min(min_prob, float(probs_t.min().cpu()))
        max_prob  = max(max_prob, float(probs_t.max().cpu()))

    y_true, y_scores = tracker.get_arrays()
    macro_auc = compute_macro_auc(y_true, y_scores)

    aps = []
    for i in range(y_true.shape[1]):
        if len(np.unique(y_true[:, i])) >= 2:
            aps.append(average_precision_score(y_true[:, i], y_scores[:, i]))
    macro_ap = float(np.mean(aps)) if aps else 0.0

    val_loss = total_loss / len(loader.dataset)

    if ema is not None and active_weights is not None:
        ema.restore(model, active_weights)

    act_stats = {
        "min_logit": min_logit,
        "max_logit": max_logit,
        "min_prob" : min_prob,
        "max_prob" : max_prob,
    }

    return val_loss, macro_auc, macro_ap, y_true, y_scores, act_stats


# =============================================================================
# Test-Time Augmentation (TTA) Evaluation
# =============================================================================

@torch.no_grad()
def evaluate_test_tta(model, loader, criterion, device) -> tuple:
    """
    Evaluates test set using Test-Time Augmentation (TTA):
    Averages predictions across 3 views:
      1. Original image
      2. Horizontal Flip
      3. Center Crop / Scale Crop
    Returns: (test_loss, macro_auc, macro_ap, y_true, y_scores_tta)
    """
    model.eval()
    tracker    = MetricsTracker()
    total_loss = 0.0

    for images, labels, _ in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        # 3 TTA views:
        # View 1: Original
        img_orig = images
        # View 2: Horizontal Flip
        img_flip = torch.flip(images, dims=[3])
        # View 3: Scale crop (1.07x scale interpolate + center crop)
        h, w = images.shape[2:]
        scaled = F.interpolate(images, size=(int(h * 1.07), int(w * 1.07)), mode="bilinear", align_corners=False)
        crop_top = (scaled.shape[2] - h) // 2
        crop_left = (scaled.shape[3] - w) // 2
        img_crop = scaled[:, :, crop_top:crop_top+h, crop_left:crop_left+w]

        with autocast(device_type=device.type, enabled=(device.type == "cuda" and CONFIG["USE_AMP"])):
            logits_1 = model(img_orig)
            logits_2 = model(img_flip)
            logits_3 = model(img_crop)

            probs_1 = torch.sigmoid(logits_1)
            probs_2 = torch.sigmoid(logits_2)
            probs_3 = torch.sigmoid(logits_3)

            # Average probabilities across all 3 views
            probs_avg = (probs_1 + probs_2 + probs_3) / 3.0
            
            # Loss computed on original view
            loss = criterion(logits_1, labels)

        tracker.update(labels.cpu().numpy(), probs_avg.cpu().numpy())
        total_loss += loss.item() * images.size(0)

    y_true, y_scores = tracker.get_arrays()
    macro_auc = compute_macro_auc(y_true, y_scores)

    aps = []
    for i in range(y_true.shape[1]):
        if len(np.unique(y_true[:, i])) >= 2:
            aps.append(average_precision_score(y_true[:, i], y_scores[:, i]))
    macro_ap = float(np.mean(aps)) if aps else 0.0

    test_loss = total_loss / len(loader.dataset)
    return test_loss, macro_auc, macro_ap, y_true, y_scores


# =============================================================================
# CSV Logger
# =============================================================================

def log_epoch_to_csv(csv_path: str, epoch: int, stage: int, train_loss: float,
                     val_loss: float, macro_auc: float, macro_ap: float, lr: float):
    is_new = not Path(csv_path).exists()
    with open(csv_path, "a", newline="") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(["epoch", "stage", "train_loss", "val_loss", "macro_auc", "macro_ap", "lr"])
        writer.writerow([epoch, stage, f"{train_loss:.4f}", f"{val_loss:.4f}",
                        f"{macro_auc:.4f}", f"{macro_ap:.4f}", f"{lr:.2e}"])


# =============================================================================
# Main Training Orchestrator
# =============================================================================

def train(config: dict = None):
    if config:
        CONFIG.update(config)

    # -----------------------------------------------------------------
    # Seed & Hardware Setup
    # -----------------------------------------------------------------
    seed_everything(CONFIG["SEED"])

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger, tb_writer = setup_logging(CONFIG["CHECKPOINT_DIR"])
    checkpoint_dir = Path(CONFIG["CHECKPOINT_DIR"])
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    # Save training configuration to json
    with open(checkpoint_dir / "config.json", "w") as f:
        json.dump(CONFIG, f, indent=4)

    if CONFIG["NUM_WORKERS"] <= 0:
        CONFIG["NUM_WORKERS"] = min(os.cpu_count() or 1, 8)

    logger.info("=" * 75)
    logger.info("NIH ChestX-ray14 DenseNet121 SOTA Progressive Fine-Tuning Pipeline")
    logger.info("=" * 75)
    logger.info(f"Device               : {device}")
    if device.type == "cuda":
        logger.info(f"GPU                  : {torch.cuda.get_device_name(0)}")
        logger.info(f"VRAM                 : {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    logger.info(f"Backbone             : DenseNet121")
    logger.info(f"Batch Size (Per-Step): {CONFIG['BATCH_SIZE']} | Effective: {CONFIG['BATCH_SIZE'] * CONFIG['ACCUMULATION_STEPS']}")
    logger.info(f"Loss Function        : Asymmetric Focal Loss (gamma_pos=1, gamma_neg=4)")
    logger.info(f"Optimizer            : AdamW (weight_decay=1e-4)")
    logger.info(f"Scheduler            : Warmup (3 ep) + CosineAnnealingWarmRestarts (T_0=10, T_mult=2)")
    logger.info(f"EMA Decay            : {CONFIG['EMA_DECAY']}")
    logger.info(f"Early Stop Patience  : {CONFIG['EARLY_STOP_PATIENCE']}")
    logger.info("=" * 75)

    logger.info("Verifying dataset...")
    verify_dataset(CONFIG["DATA_DIR"])

    # -----------------------------------------------------------------
    # Build Loaders & Model
    # -----------------------------------------------------------------
    logger.info("Building DataLoaders...")
    train_loader, val_loader, test_loader = build_dataloaders(
        data_dir=CONFIG["DATA_DIR"],
        batch_size=CONFIG["BATCH_SIZE"],
        num_workers=CONFIG["NUM_WORKERS"],
        image_size=CONFIG["IMAGE_SIZE"],
        use_weighted_sampler=CONFIG["USE_WEIGHTED_SAMPLER"],
    )

    logger.info("Building DenseNet121 model...")
    model = build_model(
        backbone="densenet121",
        pretrained=True,
        device=str(device),
    )

    train_ds = train_loader.dataset
    pos_weights = train_ds.get_class_weights().to(device)

    # -----------------------------------------------------------------
    # Loss, Optimizer, EMA, Scaler & Scheduler
    # -----------------------------------------------------------------
    criterion = AsymmetricFocalLoss(gamma_pos=1.0, gamma_neg=4.0, pos_weight=pos_weights)

    stage_1_lrs = get_base_lrs_for_stage(1)
    optimizer_groups = build_adamw_param_groups(model, stage_1_lrs, weight_decay=CONFIG["WEIGHT_DECAY"])
    optimizer = optim.AdamW(optimizer_groups)

    ema = EMAModel(model, decay=CONFIG["EMA_DECAY"])
    scaler = GradScaler("cuda", enabled=CONFIG["USE_AMP"])
    scheduler = WarmupCosineWarmRestarts(
        optimizer,
        warmup_epochs=CONFIG["WARMUP_EPOCHS"],
        T_0=10,
        T_mult=2,
        eta_min=1e-6,
    )

    # -----------------------------------------------------------------
    # Resume State Setup & Metrics Tracking
    # -----------------------------------------------------------------
    start_epoch        = 1
    best_val_auc       = 0.0
    best_auc_epoch     = 1
    best_val_loss      = float("inf")
    best_loss_epoch    = 1
    no_improve_count   = 0
    csv_log_path       = checkpoint_dir / "training_log.csv"
    optimal_thresholds = None
    pipeline_start_time = time.time()
    previous_stage     = None

    resume_path = CONFIG.get("RESUME")
    if resume_path and Path(resume_path).exists():
        logger.info(f"Resuming training from checkpoint: {resume_path}")
        checkpoint = torch.load(resume_path, map_location=device, weights_only=False)

        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
        if "ema_state_dict" in checkpoint:
            ema.ema_state_dict = checkpoint["ema_state_dict"]
        if "optimizer_state_dict" in checkpoint:
            optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        if "scaler_state_dict" in checkpoint:
            scaler.load_state_dict(checkpoint["scaler_state_dict"])
        if "scheduler_state_dict" in checkpoint:
            scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        if "epoch" in checkpoint:
            start_epoch = checkpoint["epoch"] + 1
        if "stage" in checkpoint:
            previous_stage = checkpoint["stage"]
        if "best_auc" in checkpoint:
            best_val_auc = checkpoint["best_auc"]
        elif "val_macro_auc" in checkpoint:
            best_val_auc = checkpoint["val_macro_auc"]
        if "best_loss" in checkpoint:
            best_val_loss = checkpoint["best_loss"]
        if "optimal_thresholds" in checkpoint and checkpoint["optimal_thresholds"] is not None:
            optimal_thresholds = np.array(checkpoint["optimal_thresholds"])

        logger.info(f"Resumed successfully! Next Epoch: {start_epoch} | Best Val Macro AUC: {best_val_auc:.4f} | Best Val Loss: {best_val_loss:.4f}")

    # -----------------------------------------------------------------
    # Main Epoch Loop
    # -----------------------------------------------------------------
    logger.info(f"\nStarting Progressive Training pipeline up to {CONFIG['EPOCHS']} epochs...")
    logger.info(f"Early stopping patience: {CONFIG['EARLY_STOP_PATIENCE']} epochs\n")

    for epoch in range(start_epoch, CONFIG["EPOCHS"] + 1):
        epoch_start = time.time()

        # Determine Stage (1: 1-5, 2: 6-10, 3: 11+)
        if epoch <= 5:
            stage = 1
        elif epoch <= 10:
            stage = 2
        else:
            stage = 3

        # Reset Optimizer State on Stage Transition (Flushes stale momentum/variance buffers)
        if previous_stage is not None and stage != previous_stage:
            logger.info(
                f"\n🔄 STAGE TRANSITION: Stage {previous_stage} → Stage {stage}. "
                f"Resetting AdamW momentum and variance buffers to prevent gradient explosion."
            )
            stage_lrs_dict = get_base_lrs_for_stage(stage)
            optimizer_groups = build_adamw_param_groups(model, stage_lrs_dict, weight_decay=CONFIG["WEIGHT_DECAY"])
            optimizer = optim.AdamW(optimizer_groups)
            scheduler.optimizer = optimizer

        previous_stage = stage

        # Apply stage unfreezing and freeze BatchNorm statistics
        set_stage_unfreezing(model, stage, logger)

        # Update learning rates
        stage_lrs_dict = get_base_lrs_for_stage(stage)
        stage_lrs_list = [stage_lrs_dict["classifier"], stage_lrs_dict["db4"], stage_lrs_dict["rest"]]
        current_lrs = scheduler.step(epoch, stage_lrs_list)
        active_lr = max(current_lrs)

        logger.info(f"\nEpoch {epoch:03d}/{CONFIG['EPOCHS']} | Stage {stage} | LRs: Classifier={current_lrs[0]:.2e}, DB4={current_lrs[1]:.2e}, Rest={current_lrs[2]:.2e}")
        logger.info("-" * 75)

        # Train one epoch
        train_loss, throughput = train_one_epoch(
            model=model,
            loader=train_loader,
            optimizer=optimizer,
            criterion=criterion,
            scaler=scaler,
            ema=ema,
            device=device,
            logger=logger,
            epoch=epoch,
            stage=stage,
            accumulation_steps=CONFIG["ACCUMULATION_STEPS"],
        )

        # Validate using EMA shadow model weights
        val_loss, val_macro_auc, val_macro_ap, y_true_val, y_scores_val, act_stats = validate(
            model=model,
            loader=val_loader,
            criterion=criterion,
            device=device,
            ema=ema,
        )

        epoch_time = time.time() - epoch_start
        total_elapsed = time.time() - pipeline_start_time
        avg_epoch_time = total_elapsed / max(epoch - start_epoch + 1, 1)
        remaining_epochs = CONFIG["EPOCHS"] - epoch
        eta_total = avg_epoch_time * remaining_epochs

        # GPU Memory Logging
        gpu_alloc_mb = torch.cuda.memory_allocated(device) / (1024 ** 2) if device.type == "cuda" else 0.0
        gpu_res_mb = torch.cuda.memory_reserved(device) / (1024 ** 2) if device.type == "cuda" else 0.0

        # Print detailed per-epoch training logs & activation stats
        logger.info(
            f"EPOCH {epoch:03d} METRICS | Stage: {stage} | LR: {active_lr:.2e} |\n"
            f"  Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} |\n"
            f"  Val Macro AUC: {val_macro_auc:.4f} | Val Macro AP: {val_macro_ap:.4f} |\n"
            f"  Activation Stats -> Logits: [{act_stats['min_logit']:.2f}, {act_stats['max_logit']:.2f}] | Probs: [{act_stats['min_prob']:.4f}, {act_stats['max_prob']:.4f}] |\n"
            f"  Best Val AUC: {best_val_auc:.4f} (Ep {best_auc_epoch}) | Best Val Loss: {best_val_loss:.4f} (Ep {best_loss_epoch}) |\n"
            f"  GPU Alloc/Res: {gpu_alloc_mb:.0f}/{gpu_res_mb:.0f} MB | Speed: {throughput:.1f} img/s | ETA: {eta_total/60:.1f} min"
        )

        # Log metrics to CSV
        log_epoch_to_csv(str(csv_log_path), epoch, stage, train_loss, val_loss, val_macro_auc, val_macro_ap, active_lr)

        # TensorBoard Logging
        if tb_writer:
            tb_writer.add_scalar("Loss/Train", train_loss, epoch)
            tb_writer.add_scalar("Loss/Val", val_loss, epoch)
            tb_writer.add_scalar("AUC/Val_Macro", val_macro_auc, epoch)
            tb_writer.add_scalar("AP/Val_Macro", val_macro_ap, epoch)
            tb_writer.add_scalar("LR/Active", active_lr, epoch)
            tb_writer.add_scalar("Performance/Throughput", throughput, epoch)
            tb_writer.add_scalar("GPU/VRAM_Allocated_MB", gpu_alloc_mb, epoch)

        # -----------------------------------------------------------------
        # Model Selection: Best AUC Checkpoint
        # -----------------------------------------------------------------
        if val_macro_auc > best_val_auc + CONFIG["MIN_DELTA"]:
            best_val_auc     = val_macro_auc
            best_auc_epoch   = epoch
            no_improve_count = 0

            optimal_thresholds = find_optimal_thresholds(y_true_val, y_scores_val)

            best_auc_ckpt_path = checkpoint_dir / f"best_{CONFIG['BACKBONE']}.pth"
            torch.save({
                "epoch"               : epoch,
                "stage"               : stage,
                "model_state_dict"    : ema.ema_state_dict,  # Best EMA weights
                "ema_state_dict"      : ema.ema_state_dict,
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "scaler_state_dict"   : scaler.state_dict(),
                "val_macro_auc"       : val_macro_auc,
                "val_loss"            : val_loss,
                "best_auc"            : best_val_auc,
                "best_loss"           : best_val_loss,
                "val_macro_ap"        : val_macro_ap,
                "backbone"            : CONFIG["BACKBONE"],
                "num_classes"         : len(CHESTXRAY14_CLASSES),
                "classes"             : CHESTXRAY14_CLASSES,
                "optimal_thresholds"  : optimal_thresholds.tolist(),
                "config"              : CONFIG,
            }, best_auc_ckpt_path)

            logger.info(f"✅ NEW BEST VAL AUC! AUC: {val_macro_auc:.4f} → Saved: {best_auc_ckpt_path}")
        else:
            no_improve_count += 1
            logger.info(
                f"No AUC improvement for {no_improve_count}/{CONFIG['EARLY_STOP_PATIENCE']} epochs. "
                f"Best AUC: {best_val_auc:.4f} (Ep {best_auc_epoch})"
            )

        # -----------------------------------------------------------------
        # Model Selection: Best Validation Loss Checkpoint
        # -----------------------------------------------------------------
        if val_loss < best_val_loss:
            best_val_loss   = val_loss
            best_loss_epoch = epoch

            best_loss_ckpt_path = checkpoint_dir / f"best_loss_{CONFIG['BACKBONE']}.pth"
            torch.save({
                "epoch"               : epoch,
                "stage"               : stage,
                "model_state_dict"    : ema.ema_state_dict,
                "ema_state_dict"      : ema.ema_state_dict,
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "scaler_state_dict"   : scaler.state_dict(),
                "val_macro_auc"       : val_macro_auc,
                "val_loss"            : val_loss,
                "best_auc"            : best_val_auc,
                "best_loss"           : best_val_loss,
                "val_macro_ap"        : val_macro_ap,
                "backbone"            : CONFIG["BACKBONE"],
                "num_classes"         : len(CHESTXRAY14_CLASSES),
                "classes"             : CHESTXRAY14_CLASSES,
                "optimal_thresholds"  : optimal_thresholds.tolist() if optimal_thresholds is not None else None,
                "config"              : CONFIG,
            }, best_loss_ckpt_path)

            logger.info(f"📉 NEW BEST VAL LOSS! Loss: {val_loss:.4f} → Saved: {best_loss_ckpt_path}")

        # Always save latest checkpoint for resume capability
        latest_ckpt_path = checkpoint_dir / "latest_checkpoint.pth"
        torch.save({
            "epoch"               : epoch,
            "stage"               : stage,
            "model_state_dict"    : model.state_dict(),
            "ema_state_dict"      : ema.ema_state_dict,
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "scaler_state_dict"   : scaler.state_dict(),
            "val_macro_auc"       : val_macro_auc,
            "val_loss"            : val_loss,
            "best_auc"            : best_val_auc,
            "best_loss"           : best_val_loss,
            "backbone"            : CONFIG["BACKBONE"],
            "num_classes"         : len(CHESTXRAY14_CLASSES),
            "classes"             : CHESTXRAY14_CLASSES,
            "optimal_thresholds"  : optimal_thresholds.tolist() if optimal_thresholds is not None else None,
            "config"              : CONFIG,
        }, latest_ckpt_path)

        # Periodic checkpoint backup
        if epoch % CONFIG["SAVE_EVERY_N"] == 0:
            backup_path = checkpoint_dir / f"epoch_{epoch:03d}_{CONFIG['BACKBONE']}.pth"
            torch.save({
                "epoch"               : epoch,
                "stage"               : stage,
                "model_state_dict"    : ema.ema_state_dict,
                "ema_state_dict"      : ema.ema_state_dict,
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "scaler_state_dict"   : scaler.state_dict(),
                "val_macro_auc"       : val_macro_auc,
                "val_loss"            : val_loss,
                "best_auc"            : best_val_auc,
                "best_loss"           : best_val_loss,
                "backbone"            : CONFIG["BACKBONE"],
                "num_classes"         : len(CHESTXRAY14_CLASSES),
                "classes"             : CHESTXRAY14_CLASSES,
                "config"              : CONFIG,
            }, backup_path)
            logger.info(f"📦 Backup checkpoint saved: {backup_path}")

        # -----------------------------------------------------------------
        # Early Stopping Check
        # -----------------------------------------------------------------
        if no_improve_count >= CONFIG["EARLY_STOP_PATIENCE"]:
            logger.info(f"\n⏹️  Early stopping triggered after {epoch} epochs.")
            logger.info(f"Best validation Macro AUC achieved: {best_val_auc:.4f} (Epoch {best_auc_epoch})")
            break

    if tb_writer:
        tb_writer.close()

    total_training_time = time.time() - pipeline_start_time

    # -----------------------------------------------------------------
    # Final Test Set Evaluation with Test-Time Augmentation (TTA)
    # -----------------------------------------------------------------
    logger.info("\n" + "=" * 75)
    logger.info("FINAL EVALUATION ON TEST SET (WITH TEST-TIME AUGMENTATION - TTA)")
    logger.info("=" * 75)

    best_auc_ckpt_path = checkpoint_dir / f"best_{CONFIG['BACKBONE']}.pth"
    best_loss_ckpt_path = checkpoint_dir / f"best_loss_{CONFIG['BACKBONE']}.pth"

    if best_auc_ckpt_path.exists():
        checkpoint = torch.load(best_auc_ckpt_path, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimal_thresholds = np.array(checkpoint["optimal_thresholds"])
        logger.info(f"Loaded best EMA model from AUC checkpoint (Epoch {checkpoint['epoch']}, Best Val Macro AUC: {checkpoint['val_macro_auc']:.4f})")
    else:
        logger.warning("No best checkpoint found! Evaluating current model state with 0.5 threshold.")
        optimal_thresholds = np.full(len(CHESTXRAY14_CLASSES), 0.5)

    # Evaluate test set with TTA (3 views averaged)
    test_loss, test_macro_auc, test_macro_ap, y_true_test, y_scores_test = evaluate_test_tta(
        model=model,
        loader=test_loader,
        criterion=criterion,
        device=device,
    )

    logger.info(f"Test Loss (TTA): {test_loss:.4f} | Test Macro AUC (TTA): {test_macro_auc:.4f} | Test Macro AP (TTA): {test_macro_ap:.4f}")

    # Detailed per-class metrics
    metrics = compute_classification_metrics(y_true_test, y_scores_test, optimal_thresholds)
    print_metrics_table(metrics)

    # Save metrics JSON
    metrics_path = checkpoint_dir / "test_metrics.json"
    metrics_clean = {}
    for k, v in metrics.items():
        metrics_clean[k] = {mk: float(mv) if isinstance(mv, (np.floating, float)) else mv
                           for mk, mv in v.items()}
    with open(metrics_path, "w") as f:
        json.dump(metrics_clean, f, indent=2)
    logger.info(f"Metrics saved: {metrics_path}")

    # Plot ROC curves and confusion matrices into checkpoint folder
    plot_roc_curves(y_true_test, y_scores_test, str(checkpoint_dir))
    plot_confusion_matrices(y_true_test, y_scores_test, optimal_thresholds, str(checkpoint_dir))

    # -----------------------------------------------------------------
    # Final Training Summary
    # -----------------------------------------------------------------
    logger.info("\n" + "=" * 75)
    logger.info("FINAL TRAINING SUMMARY")
    logger.info("=" * 75)
    logger.info(f"  • Best Validation AUC       : {best_val_auc:.4f}")
    logger.info(f"  • Epoch of Best Val AUC     : Epoch {best_auc_epoch}")
    logger.info(f"  • Best Validation Loss      : {best_val_loss:.4f}")
    logger.info(f"  • Epoch of Best Val Loss    : Epoch {best_loss_epoch}")
    logger.info(f"  • Final Test Macro AUC (TTA): {test_macro_auc:.4f}")
    logger.info(f"  • Total Training Time       : {total_training_time/3600:.2f} hours ({total_training_time/60:.1f} minutes)")
    logger.info(f"  • Best AUC Checkpoint Path  : {best_auc_ckpt_path}")
    logger.info(f"  • Best Loss Checkpoint Path : {best_loss_ckpt_path}")
    logger.info("=" * 75 + "\n")

    return model, test_macro_auc


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SOTA DenseNet121 Training on NIH ChestX-ray14")
    parser.add_argument("--data_dir",       default=CONFIG["DATA_DIR"],       help="Dataset directory")
    parser.add_argument("--backbone",       default=CONFIG["BACKBONE"],        help="Model backbone")
    parser.add_argument("--epochs",         type=int, default=CONFIG["EPOCHS"], help="Max training epochs")
    parser.add_argument("--batch_size",     type=int, default=CONFIG["BATCH_SIZE"])
    parser.add_argument("--image_size",     type=int, default=CONFIG["IMAGE_SIZE"])
    parser.add_argument("--checkpoint_dir", default=CONFIG["CHECKPOINT_DIR"])
    parser.add_argument("--resume",         type=str, default=None,            help="Path to checkpoint to resume training")
    parser.add_argument("--no_amp",         action="store_true", help="Disable mixed precision")
    args = parser.parse_args()

    CONFIG["DATA_DIR"]       = args.data_dir
    CONFIG["BACKBONE"]       = args.backbone
    CONFIG["EPOCHS"]         = args.epochs
    CONFIG["BATCH_SIZE"]     = args.batch_size
    CONFIG["IMAGE_SIZE"]     = args.image_size
    CONFIG["CHECKPOINT_DIR"] = args.checkpoint_dir
    CONFIG["RESUME"]         = args.resume
    CONFIG["USE_AMP"]        = not args.no_amp and torch.cuda.is_available()

    train()
