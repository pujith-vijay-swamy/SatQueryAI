"""
SatQuery AI — Specialist Model & Tool Registry
Defines remote sensing specialist tools, capabilities, schemas, and LoRA adapter slots.
"""

from typing import Dict, Any
from backend.core.config import LORA_WEIGHT_PATH, LORA_ACTIVE, BIT_CD_WEIGHT_PATH, BIT_CD_ACTIVE

class ToolRegistry:
    """
    Central catalog of remote sensing reasoning tools and vision-language models.
    """

    TOOLS = {
        "SINGLE_VQA": {
            "name": "Single-Image Remote Sensing VQA & Captioning",
            "model_family": "Florence-2 / GeoChat-7B",
            "adapter_slot": "BigEarthNet LoRA",
            "lora_active": LORA_ACTIVE,
            "latency_target_ms": 250,
            "capabilities": ["scene_captioning", "infrastructure_identification", "attribute_vqa"],
            "inputs": ["single_geotiff"]
        },
        "VISUAL_GROUNDING": {
            "name": "Geospatial Phrase Grounding & Target Bounding",
            "model_family": "Florence-2-base (Grounding Head)",
            "adapter_slot": "BigEarthNet LoRA",
            "lora_active": LORA_ACTIVE,
            "latency_target_ms": 320,
            "capabilities": ["phrase_grounding", "bounding_box_extraction", "target_localization"],
            "inputs": ["single_geotiff", "target_query"]
        },
        "BITEMPORAL_CHANGE_DETECTION": {
            "name": "Bitemporal Image Transformer (BIT_CD) & Change Mask Engine",
            "model_family": "Bitemporal Image Transformer (BIT_CD - ResNet18 + Cross-Attention)" if BIT_CD_ACTIVE else "Siamese-Spectral Difference + GeoChat-7B (BigEarthNet LoRA)",
            "adapter_slot": BIT_CD_WEIGHT_PATH.name if BIT_CD_ACTIVE else "BigEarthNet LoRA",
            "lora_active": BIT_CD_ACTIVE or LORA_ACTIVE,
            "val_accuracy": 0.9469 if BIT_CD_ACTIVE else None,
            "latency_target_ms": 310,
            "capabilities": ["subpixel_coregistration", "spectral_change_vector", "urban_expansion", "vegetation_loss", "neural_transformer_attention"],
            "inputs": ["t1_geotiff", "t2_geotiff"]
        },
        "CROSS_MODAL_FUSION": {
            "name": "Optical-SAR Deep Fusion & All-Weather Penetration",
            "model_family": "Optical-SAR Deep Fusion + RISAT-1 C-Band Despeckler",
            "adapter_slot": "Multi-Modal Feature Projector",
            "lora_active": True,
            "latency_target_ms": 380,
            "capabilities": ["sar_speckle_filtering", "cloud_penetration", "flood_inundation", "false_color_composite"],
            "inputs": ["optical_geotiff", "sar_geotiff"]
        },
        "GIS_PREFLIGHT_AUDITOR": {
            "name": "Rasterio Geodetic Preflight & CRS Auditor",
            "model_family": "Deterministic GDAL/Rasterio Engine",
            "adapter_slot": "Native C-Cores",
            "lora_active": True,
            "latency_target_ms": 45,
            "capabilities": ["crs_verification", "gsd_extraction", "spatial_overlap_calculation", "percentile_contrast_stretch"],
            "inputs": ["any_geotiff"]
        }
    }

    @classmethod
    def get_tool(cls, tool_key: str) -> Dict[str, Any]:
        return cls.TOOLS.get(tool_key, None)

    @classmethod
    def list_tools(cls) -> Dict[str, Any]:
        return cls.TOOLS
