"""
SatQuery AI — System Configuration & Geospatial Definitions
"""

import os
from pathlib import Path

# Base Paths
CORE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

STATIC_DIR = BACKEND_DIR / "static"
MASKS_DIR = STATIC_DIR / "masks"
PREVIEWS_DIR = STATIC_DIR / "previews"
SAMPLES_DIR = ROOT_DIR / "samples"
DYNAMIC_SAMPLES_DIR = SAMPLES_DIR / "dynamic"
WEIGHTS_DIR = ROOT_DIR / "finetune" / "weights"

# Ensure runtime directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(MASKS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)
os.makedirs(DYNAMIC_SAMPLES_DIR, exist_ok=True)
os.makedirs(WEIGHTS_DIR, exist_ok=True)

# Geodetic Projections & Constants
CRS_DEFINITIONS = {
    "EPSG:4326": {"name": "WGS 84 Geographic 2D", "unit": "degree", "type": "geographic"},
    "EPSG:32643": {"name": "WGS 84 / UTM Zone 43N (Gujarat / Western India)", "unit": "metre", "type": "projected"},
    "EPSG:32644": {"name": "WGS 84 / UTM Zone 44N (Assam / Eastern India)", "unit": "metre", "type": "projected"},
    "EPSG:3857": {"name": "WGS 84 / Pseudo-Mercator", "unit": "metre", "type": "projected"},
}

# Registered Scenes Catalog
SCENE_CATALOG = {
    "ahmedabad_bitemporal": {
        "id": "ahmedabad_bitemporal",
        "name": "Ahmedabad Urban Corridor (Cartosat-2S Bi-Temporal)",
        "mode": "bi_temporal",
        "location": "Ahmedabad, Gujarat, India",
        "center_coords": {"lat": 23.0338, "lon": 72.5850},
        "crs": "EPSG:32643",
        "gsd": "0.65m GSD",
        "sensor": "Cartosat-2S Panchromatic / VNIR",
        "spectral_bands": ["PAN", "NIR", "Red", "Green"],
        "timestamps": {"t1": "2021-03-14", "t2": "2024-02-18"},
        "files": {
            "t1_geotiff": str(SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.tif"),
            "t2_geotiff": str(SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif"),
            "t1_preview": "/static/previews/ahmedabad_t1.png",
            "t2_preview": "/static/previews/ahmedabad_t2.png",
        },
        "description": "Rapid urban & transit infrastructure expansion along Sardar Patel Ring Road and Sabarmati riverfront.",
        "sample_queries": [
            "What changed between these two dates and where did it occur?",
            "Tell me about riverbed and active water channel changes.",
            "Detect new transit infrastructure and industrial built-up expansion.",
            "Quantify vegetative loss vs concrete surface conversion in square kilometers."
        ]
    },
    "assam_flood_crossmodal": {
        "id": "assam_flood_crossmodal",
        "name": "Assam Brahmaputra Inundation (Optical + C-Band SAR)",
        "mode": "cross_modal",
        "location": "Kaziranga / Guwahati, Assam, India",
        "center_coords": {"lat": 26.2006, "lon": 92.9376},
        "crs": "EPSG:32644",
        "gsd": "Optical 1.0m / SAR 3.0m GSD",
        "sensor": "Optical (Cartosat/Sentinel-2) + SAR (RISAT-1 / EOS-04 C-Band)",
        "spectral_bands": ["Optical RGB", "SAR C-band HH/HV Backscatter"],
        "timestamps": {"optical": "2024-07-12 (Monsoon Cloud Occlusion)", "sar": "2024-07-13 (Cloud Penetrating)"},
        "files": {
            "optical_geotiff": str(SAMPLES_DIR / "assam" / "optical_sentinel_2024.tif"),
            "sar_geotiff": str(SAMPLES_DIR / "assam" / "sar_risat_2024.tif"),
            "optical_preview": "/static/previews/assam_optical.png",
            "sar_preview": "/static/previews/assam_sar.png",
        },
        "description": "Monsoon flood inundation across Brahmaputra floodplains. Optical imagery is cloud-occluded; C-band SAR penetrates clouds.",
        "sample_queries": [
            "Fuse optical and SAR imagery to delineate flood boundaries under monsoonal cloud cover.",
            "Identify submerged agricultural lowlands and breach points along river dykes.",
            "Filter SAR speckle noise and generate an all-weather water inundation mask."
        ]
    },
    "ahmedabad_single_baseline": {
        "id": "ahmedabad_single_baseline",
        "name": "Ahmedabad Transit Hub (Single-Image Baseline)",
        "mode": "single_image",
        "location": "Ahmedabad, Gujarat, India",
        "center_coords": {"lat": 23.0338, "lon": 72.5850},
        "crs": "EPSG:32643",
        "gsd": "0.65m GSD",
        "sensor": "Cartosat-2S VNIR",
        "spectral_bands": ["Red", "Green", "Blue"],
        "timestamps": {"baseline": "2024-02-18"},
        "files": {
            "t1_geotiff": str(SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif"),
            "t1_preview": "/static/previews/ahmedabad_t2.png",
        },
        "description": "Single-scene baseline for Remote Sensing VQA, Scene Captioning, and Visual Grounding.",
        "sample_queries": [
            "Provide high-resolution scene captioning and identify primary transport corridors.",
            "Ground bounding box coordinates for newly constructed industrial storage facilities.",
            "Estimate riverbank embankment stability and bridge infrastructure."
        ]
    }
}

# Phase 2 LoRA Slot Path
LORA_WEIGHT_PATH = WEIGHTS_DIR / "adapter_model.safetensors"
LORA_ACTIVE = LORA_WEIGHT_PATH.exists()

# Bi-Temporal Change Detection (BIT_CD) Model Path
BIT_CD_WEIGHT_PATH = WEIGHTS_DIR / "bit_cd_bitemporal_best.pt"
BIT_CD_ACTIVE = BIT_CD_WEIGHT_PATH.exists()
