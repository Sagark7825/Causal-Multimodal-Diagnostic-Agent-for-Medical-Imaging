"""
Model Factory — Architecture Comparison & Selection
=====================================================
Theory:
  We evaluate 4 state-of-the-art architectures for chest X-ray classification:

  1. DenseNet121 (CheXNet — Rajpurkar et al., 2017)
     - Dense connectivity: each layer receives feature maps from ALL prior layers
     - Extremely parameter-efficient (7M params) — avoids overfitting on medical data
     - Proven clinical benchmark: AUC 0.841 on NIH ChestX-ray14
     - Fast inference (~15ms/image on GPU)
     - 🏆 RECOMMENDED for this project

  2. EfficientNet-B4 (Tan & Le, 2019)
     - Compound scaling: simultaneously scales depth, width, and resolution
     - Better accuracy at same compute cost vs ResNet/VGG
     - AUC ~0.849 on NIH ChestX-ray14
     - Larger model (19M params) — needs more data to avoid overfitting

  3. ConvNeXt-Small (Liu et al., 2022)
     - Modernized ConvNet: incorporates transformer design principles
     - Layer normalization, inverted bottleneck, GELU activation
     - AUC ~0.851 on NIH ChestX-ray14
     - Good balance between accuracy and speed
     - Newer, less validated in clinical literature

  4. ViT-Base (Dosovitskiy et al., 2020)
     - Pure attention mechanism: splits image into 16x16 patches
     - Best results on very large datasets (100M+ images)
     - Needs heavy augmentation + more data to avoid overfitting
     - AUC ~0.845 on NIH ChestX-ray14
     - Slow inference without GPU optimization

  Architecture Selection Summary:
  ┌──────────────┬───────────┬────────┬──────┬────────────┐
  │ Model        │ AUC (NIH) │ Params │ Speed│ Recommend  │
  ├──────────────┼───────────┼────────┼──────┼────────────┤
  │ DenseNet121  │   0.841   │  7M    │ Fast │ ✅ Primary  │
  │ EfficientB4  │   0.849   │  19M   │ Med  │ Alternative│
  │ ConvNeXt-S   │   0.851   │  50M   │ Med  │ Alternative│
  │ ViT-Base     │   0.845   │  86M   │ Slow │ Experimental│
  └──────────────┴───────────┴────────┴──────┴────────────┘

  DenseNet121 is the gold standard for chest X-ray AI because:
  - It was specifically validated on this exact dataset (CheXNet paper)
  - Small parameter count → less risk of overfitting on medical data
  - Dense connections provide excellent gradient flow → better training on few positives
  - Widely deployed in FDA-approved medical AI (e.g., Google's CheXpert model)
  - GradCAM produces clean, interpretable attention maps on its final conv layer
"""

import torch
import torch.nn as nn
import torchvision.models as models
from typing import Tuple

from training.dataset import NUM_CLASSES  # 14


# =============================================================================
# Base Model Wrapper
# =============================================================================

class ChestXrayModel(nn.Module):
    """
    Base wrapper for all chest X-ray classification models.
    
    Handles:
    - Loading a pretrained backbone
    - Replacing the classification head for 14 classes
    - Exposing feature maps for GradCAM visualization
    """

    def __init__(self, backbone_name: str, num_classes: int = NUM_CLASSES, pretrained: bool = True):
        super().__init__()
        self.backbone_name = backbone_name
        self.num_classes   = num_classes

        # Build the backbone
        self.features, self.classifier, self.feature_dim = \
            self._build_backbone(backbone_name, pretrained)

        # GradCAM hooks — we attach these to the last conv layer
        self._gradients = None
        self._activations = None

    def _build_backbone(self, name: str, pretrained: bool):
        """
        Builds and returns (feature_extractor, classifier_head, feature_dim).
        """
        if name == "densenet121":
            # ----------------------------------------------------------------
            # DenseNet121 — CheXNet Architecture
            # ----------------------------------------------------------------
            # The original model ends with an AdaptiveAvgPool2d → Linear(1000)
            # We:
            #   1. Keep all Dense Blocks as the feature extractor
            #   2. Replace the final linear with a 14-class head
            # ----------------------------------------------------------------
            weights = models.DenseNet121_Weights.DEFAULT if pretrained else None
            base = models.densenet121(weights=weights)
            # DenseNet121 feature extraction = all layers except classifier
            features   = base.features  # Output: [B, 1024, 7, 7] for 224x224 input
            feature_dim = 1024
            # New classifier: global average pool → dropout → linear
            classifier = nn.Sequential(
                nn.AdaptiveAvgPool2d((1, 1)),   # [B, 1024, 7, 7] → [B, 1024, 1, 1]
                nn.Flatten(),                    # → [B, 1024]
                nn.Dropout(p=0.3),               # Regularization
                nn.Linear(feature_dim, self.num_classes),  # → [B, 14]
            )
            return features, classifier, feature_dim

        elif name == "efficientnet_b4":
            # ----------------------------------------------------------------
            # EfficientNet-B4
            # ----------------------------------------------------------------
            weights = models.EfficientNet_B4_Weights.DEFAULT if pretrained else None
            base = models.efficientnet_b4(weights=weights)
            features   = base.features   # Output: [B, 1792, 7, 7]
            feature_dim = 1792
            classifier = nn.Sequential(
                nn.AdaptiveAvgPool2d((1, 1)),
                nn.Flatten(),
                nn.Dropout(p=0.4),
                nn.Linear(feature_dim, self.num_classes),
            )
            return features, classifier, feature_dim

        elif name == "convnext_small":
            # ----------------------------------------------------------------
            # ConvNeXt-Small
            # ----------------------------------------------------------------
            weights = models.ConvNeXt_Small_Weights.DEFAULT if pretrained else None
            base = models.convnext_small(weights=weights)
            features    = base.features   # Output: [B, 768, 7, 7]
            feature_dim = 768
            classifier = nn.Sequential(
                nn.AdaptiveAvgPool2d((1, 1)),
                nn.Flatten(),
                nn.LayerNorm(feature_dim),   # ConvNeXt uses LayerNorm
                nn.Dropout(p=0.3),
                nn.Linear(feature_dim, self.num_classes),
            )
            return features, classifier, feature_dim

        elif name == "vit_base":
            # ----------------------------------------------------------------
            # Vision Transformer ViT-Base/16
            # ----------------------------------------------------------------
            # ViT doesn't have a standard "features" extractor like CNNs.
            # We use the encoder output and attach a new head.
            # Note: GradCAM doesn't apply directly to ViT; use attention rollout instead.
            # ----------------------------------------------------------------
            weights = models.ViT_B_16_Weights.DEFAULT if pretrained else None
            base = models.vit_b_16(weights=weights)
            feature_dim = 768  # ViT-Base hidden dim
            # Keep the encoder; replace the classification head
            base.heads = nn.Sequential(
                nn.Dropout(p=0.3),
                nn.Linear(feature_dim, self.num_classes)
            )
            # For ViT, features IS the full model (no standard CNN feature map)
            features   = base
            classifier = nn.Identity()  # Included in features for ViT
            return features, classifier, feature_dim

        else:
            raise ValueError(
                f"Unknown backbone: '{name}'. "
                "Choose from: densenet121, efficientnet_b4, convnext_small, vit_base"
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Input:  x [B, 3, 224, 224]
        Output: logits [B, 14]  (raw scores before sigmoid)
        
        Note: We return logits (not probabilities) because BCEWithLogitsLoss
        is numerically more stable than BCELoss(sigmoid(logits)).
        """
        if self.backbone_name == "vit_base":
            # ViT has its own forward that handles patch embedding + classification
            return self.features(x)

        # CNN forward: extract spatial features, then classify
        feat_map = self.features(x)     # [B, C, H, W]  (spatial feature maps)
        logits   = self.classifier(feat_map)  # [B, 14]
        return logits

    def get_feature_maps(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Returns BOTH feature maps AND logits.
        Used by GradCAM to get the spatial activation maps.
        
        Returns:
            feat_map : [B, C, H, W] — spatial features (before global avg pool)
            logits   : [B, 14] — class predictions
        """
        if self.backbone_name == "vit_base":
            logits = self.features(x)
            return None, logits  # ViT doesn't produce spatial feature maps

        feat_map = self.features(x)
        logits   = self.classifier(feat_map)
        return feat_map, logits


# =============================================================================
# Factory Function — Create Model by Name
# =============================================================================

def build_model(
    backbone: str = "densenet121",
    num_classes: int = NUM_CLASSES,
    pretrained: bool = True,
    checkpoint_path: str = None,
    device: str = "cuda",
) -> ChestXrayModel:
    """
    Factory function to create and optionally load a checkpoint.
    
    Args:
        backbone       : Architecture name
        num_classes    : Number of output classes (14 for NIH ChestX-ray14)
        pretrained     : Use ImageNet pretrained weights as initialization
        checkpoint_path: Path to a saved .pth checkpoint to resume training
        device         : 'cuda' or 'cpu'
    
    Returns:
        model: ChestXrayModel ready for training or inference
    """
    print(f"[Model] Building {backbone.upper()} | Classes={num_classes} | Pretrained={pretrained}")

    model = ChestXrayModel(backbone, num_classes, pretrained).to(device)

    # Print parameter count
    total_params   = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[Model] Total params: {total_params:,} | Trainable: {trainable_params:,}")

    if checkpoint_path:
        print(f"[Model] Loading checkpoint: {checkpoint_path}")
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
            print(f"[Model] Resumed from epoch {checkpoint.get('epoch', '?')}")
        else:
            model.load_state_dict(checkpoint)

    return model


def load_pretrained_chexnet_weights(model: ChestXrayModel, weights_path: str, device: str = "cuda"):
    """
    Loads CheXNet-compatible pretrained weights.
    
    CheXNet was published by Stanford ML Group and uses the exact same
    DenseNet121 architecture. Community-trained weights are available at:
    https://github.com/arnoweng/CheXNet
    
    These weights give ~0.840 AUC on NIH ChestX-ray14 out of the box,
    giving you a strong starting point even before fine-tuning.
    """
    print(f"[Model] Loading CheXNet weights from: {weights_path}")
    state = torch.load(weights_path, map_location=device, weights_only=False)
    
    # Handle different checkpoint formats
    if "state_dict" in state:
        state = state["state_dict"]
    elif "model_state_dict" in state:
        state = state["model_state_dict"]
    
    # Remove 'module.' prefix if saved with DataParallel
    new_state = {}
    for k, v in state.items():
        new_key = k.replace("module.", "").replace("densenet121.", "")
        new_state[new_key] = v
    
    # Load with strict=False to handle minor architecture differences
    missing, unexpected = model.load_state_dict(new_state, strict=False)
    if missing:
        print(f"[Model] Missing keys (will use ImageNet init): {len(missing)}")
    if unexpected:
        print(f"[Model] Unexpected keys (ignored): {len(unexpected)}")
    
    print("[Model] CheXNet weights loaded successfully!")
    return model
