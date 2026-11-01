"""
NIH ChestX-ray14 Dataset Download Helper
=========================================
This script automates downloading the NIH ChestX-ray14 dataset (~45GB).

The dataset contains:
  - 112,120 frontal-view Chest X-ray images (1024x1024 PNG)
  - 30,805 unique patients
  - 14 disease labels (multi-label, one patient can have multiple)
  - Data_Entry_2017.csv  — the main label file
  - train_val_list.txt   — official train/val split
  - test_list.txt        — official test split

Download Sources:
  1. Official NIH: https://nihcc.app.box.com/v/ChestXray-NIHCC (manual, requires Box account)
  2. Kaggle: https://www.kaggle.com/datasets/nih-chest-xrays/data (requires Kaggle API)

This helper uses the Kaggle API (recommended, most reliable).

Usage:
  python download_dataset.py --method kaggle --output_dir /data/chestxray14
"""

import os
import sys
import argparse
import subprocess
import zipfile
import shutil
from pathlib import Path


def check_kaggle_credentials():
    """
    Verifies that kaggle.json API credentials exist.
    Get your credentials from: https://www.kaggle.com/settings → API → Create New Token
    """
    kaggle_json_path = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json_path.exists():
        print("=" * 70)
        print("ERROR: Kaggle API credentials not found!")
        print("=" * 70)
        print("\nTo set up Kaggle API:")
        print("  1. Go to https://www.kaggle.com/settings")
        print("  2. Scroll to 'API' section")
        print("  3. Click 'Create New Token'")
        print("  4. This downloads 'kaggle.json'")
        print("  5. Move it to: ~/.kaggle/kaggle.json")
        print("  6. chmod 600 ~/.kaggle/kaggle.json  (Linux/Mac)")
        print("\nOn Windows:")
        print(f"  Place kaggle.json at: {kaggle_json_path}")
        return False
    return True


def download_via_kaggle(output_dir: str):
    """
    Downloads the NIH ChestX-ray14 dataset using the Kaggle API.
    Dataset: https://www.kaggle.com/datasets/nih-chest-xrays/data
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("NIH ChestX-ray14 Dataset Download via Kaggle API")
    print("=" * 70)
    print(f"Target directory: {output_path.resolve()}")
    print("Dataset size: ~45GB (112,120 images across 12 zip files)")
    print("Estimated time: 1–3 hours depending on internet speed")
    print("=" * 70)

    if not check_kaggle_credentials():
        sys.exit(1)

    try:
        import kaggle
    except ImportError:
        print("Installing kaggle package...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "kaggle"])
        import kaggle

    print("\nStarting download... (this may take a while)")
    cmd = [
        sys.executable, "-m", "kaggle", "datasets", "download",
        "-d", "nih-chest-xrays/data",
        "-p", str(output_path),
        "--unzip"
    ]
    subprocess.check_call(cmd)
    print("\nDownload complete!")
    return output_path


def organize_dataset(base_dir: str):
    """
    Organizes the downloaded NIH ChestX-ray14 dataset into the expected structure:

    chestxray14/
      ├── images/           ← All 112,120 PNG images (flat directory)
      ├── Data_Entry_2017_v2020.csv   ← Main label file
      ├── train_val_list.txt
      └── test_list.txt
    """
    base_path = Path(base_dir)
    images_dir = base_path / "images"
    images_dir.mkdir(exist_ok=True)

    print("\nOrganizing dataset structure...")

    # NIH dataset comes in images_001.zip through images_012.zip
    # After unzip they appear as: images_001/images/*.png etc.
    for folder in sorted(base_path.glob("images_*")):
        if folder.is_dir():
            sub_images = folder / "images"
            if sub_images.exists():
                count = 0
                for img_file in sub_images.glob("*.png"):
                    dest = images_dir / img_file.name
                    if not dest.exists():
                        shutil.move(str(img_file), str(dest))
                        count += 1
                print(f"  Moved {count} images from {folder.name}/images/ → images/")
                # Remove empty subfolder
                try:
                    shutil.rmtree(str(folder))
                except Exception:
                    pass

    # Count final images
    total_images = len(list(images_dir.glob("*.png")))
    print(f"\n✅ Total images organized: {total_images:,}")
    if total_images < 100_000:
        print(f"⚠️  WARNING: Expected ~112,120 images but found {total_images:,}.")
        print("    Some downloads may have failed. Re-run the download command.")
    else:
        print("✅ Dataset is complete!")

    # Verify label files
    label_file = base_path / "Data_Entry_2017_v2020.csv"
    if not label_file.exists():
        # Try alternate name
        alt = base_path / "Data_Entry_2017.csv"
        if alt.exists():
            label_file = alt
    
    if label_file.exists():
        print(f"✅ Label file found: {label_file.name}")
    else:
        print("❌ Label file NOT found! The CSV file is required for training.")
        print("   Make sure Data_Entry_2017_v2020.csv is in the dataset directory.")

    for split_file in ["train_val_list.txt", "test_list.txt"]:
        sf = base_path / split_file
        if sf.exists():
            count = len(sf.read_text().strip().split('\n'))
            print(f"✅ {split_file}: {count:,} entries")
        else:
            print(f"⚠️  {split_file} not found — will use random split during training")

    print("\n" + "=" * 70)
    print("Dataset Summary:")
    print(f"  Location : {base_path.resolve()}")
    print(f"  Images   : {total_images:,} PNG files")
    print("  Labels   : 14 pathology classes (multi-label)")
    print("=" * 70)
    print("\nNext Step: Update the DATA_DIR in train_chestxray.py:")
    print(f"  DATA_DIR = '{base_path.resolve()}'")
    print("=" * 70)


def create_mini_sample(base_dir: str, sample_size: int = 5000, output_dir: str = None):
    """
    Creates a small sample dataset for quick testing and validation
    without needing the full 45GB dataset.
    
    This is useful for:
    - Testing the pipeline end-to-end
    - Quick debugging
    - Verifying model architecture
    """
    import pandas as pd
    import random

    base_path = Path(base_dir)
    if output_dir is None:
        output_dir = str(base_path.parent / "chestxray14_mini")
    
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    (out_path / "images").mkdir(exist_ok=True)

    # Find label CSV
    for csv_name in ["Data_Entry_2017_v2020.csv", "Data_Entry_2017.csv"]:
        csv_path = base_path / csv_name
        if csv_path.exists():
            break
    else:
        print("ERROR: Label CSV not found in", base_dir)
        return

    df = pd.read_csv(csv_path)
    
    # Sample evenly across diseases to avoid severe class imbalance in mini set
    DISEASES = [
        "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration",
        "Mass", "Nodule", "Pneumonia", "Pneumothorax", "Consolidation",
        "Edema", "Emphysema", "Fibrosis", "Pleural_Thickening", "Hernia"
    ]
    
    selected_indices = set()
    per_class = sample_size // len(DISEASES)
    
    for disease in DISEASES:
        disease_rows = df[df["Finding Labels"].str.contains(disease, na=False)]
        sampled = disease_rows.sample(min(per_class, len(disease_rows)), random_state=42)
        selected_indices.update(sampled.index.tolist())
    
    # Fill remainder with "No Finding"
    no_finding = df[df["Finding Labels"] == "No Finding"]
    remaining = sample_size - len(selected_indices)
    if remaining > 0:
        sampled_normal = no_finding.sample(min(remaining, len(no_finding)), random_state=42)
        selected_indices.update(sampled_normal.index.tolist())
    
    mini_df = df.loc[list(selected_indices)].copy()
    
    # Copy images
    images_dir = base_path / "images"
    copied = 0
    for _, row in mini_df.iterrows():
        src = images_dir / row["Image Index"]
        dst = out_path / "images" / row["Image Index"]
        if src.exists() and not dst.exists():
            shutil.copy2(str(src), str(dst))
            copied += 1
    
    # Save mini CSV
    mini_df.to_csv(out_path / "Data_Entry_2017_v2020.csv", index=False)
    
    # Copy split files if they exist
    for split_file in ["train_val_list.txt", "test_list.txt"]:
        sf = base_path / split_file
        if sf.exists():
            # Filter split files to only include mini images
            mini_image_names = set(mini_df["Image Index"].tolist())
            lines = [l for l in sf.read_text().strip().split('\n') if l in mini_image_names]
            (out_path / split_file).write_text('\n'.join(lines))

    print(f"\n✅ Mini dataset created at: {out_path.resolve()}")
    print(f"   Total samples: {len(mini_df):,}")
    print(f"   Images copied: {copied:,}")
    print(f"\nUsage: Set DATA_DIR = '{out_path.resolve()}' in train_chestxray.py")


def main():
    parser = argparse.ArgumentParser(
        description="NIH ChestX-ray14 Dataset Download and Organization Helper"
    )
    parser.add_argument(
        "--method",
        choices=["kaggle"],
        default="kaggle",
        help="Download method (currently: kaggle)"
    )
    parser.add_argument(
        "--output_dir",
        default="./data/chestxray14",
        help="Directory to save the dataset (default: ./data/chestxray14)"
    )
    parser.add_argument(
        "--organize_only",
        action="store_true",
        help="Skip download, only organize an already-downloaded dataset"
    )
    parser.add_argument(
        "--create_mini",
        action="store_true",
        help="Create a small 5000-sample mini dataset for testing"
    )
    parser.add_argument(
        "--mini_size",
        type=int,
        default=5000,
        help="Number of samples in mini dataset (default: 5000)"
    )
    parser.add_argument(
        "--mini_output",
        default=None,
        help="Output directory for mini dataset"
    )
    args = parser.parse_args()

    if args.organize_only:
        organize_dataset(args.output_dir)
    elif args.create_mini:
        create_mini_sample(args.output_dir, args.mini_size, args.mini_output)
    else:
        if args.method == "kaggle":
            download_via_kaggle(args.output_dir)
        organize_dataset(args.output_dir)

    if args.create_mini:
        create_mini_sample(args.output_dir, args.mini_size, args.mini_output)


if __name__ == "__main__":
    main()
