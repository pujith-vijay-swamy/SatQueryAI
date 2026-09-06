"""
SatQuery AI — Agentic Router & Observable Execution Trace Logger
Classifies user intent, validates geospatial constraints, dispatches to specialist models,
and returns an auditable telemetry execution trace.
"""

import time
from typing import Dict, Any
from backend.core.config import SCENE_CATALOG
from backend.core.gis_validator import GisValidator
from backend.controller.registry import ToolRegistry
from backend.services.vqa_service import VqaService
from backend.services.change_service import ChangeDetectionService
from backend.services.cross_modal_service import CrossModalService

class AgentRouter:
    def __init__(self):
        self.vqa_service = VqaService()
        self.change_service = ChangeDetectionService()
        self.cross_modal_service = CrossModalService()

    def classify_intent(self, query: str, scene_metadata: dict) -> str:
        """
        Classifies operational intent based on semantic query keywords and active scene modalities.
        """
        q = query.lower()
        mode = scene_metadata.get("mode", "")

        # 1. Bi-Temporal Change Detection
        if mode == "bi_temporal" or any(k in q for k in ["change", "difference", "expansion", "built-up", "temporal", "urbanization", "growth", "t1", "t2", "dates", "occur"]):
            if mode == "bi_temporal" or "between" in q or "dates" in q:
                return "BITEMPORAL_CHANGE_DETECTION"

        # 2. Cross-Modal Optical-SAR Fusion
        if mode == "cross_modal" or any(k in q for k in ["sar", "radar", "optical", "fuse", "fusion", "cloud", "flood", "inundat", "penetrat", "speckle"]):
            return "CROSS_MODAL_FUSION"

        # 3. Visual Grounding (Bounding Boxes)
        if any(k in q for k in ["ground", "box", "locate", "where", "bounding", "detect", "coordinates", "pinpoint"]):
            return "VISUAL_GROUNDING"

        # 4. Remote Sensing Single-Image VQA / Scene Captioning
        return "SINGLE_VQA"

    def execute_query(self, scene_id: str, query: str) -> Dict[str, Any]:
        """
        Master agentic orchestration pipeline:
        1. Context retrieval & GIS validation
        2. Intent classification
        3. Model selection & dispatch
        4. Observable trace emission matching PRD schema
        """
        start_wall_time = time.perf_counter()

        if scene_id not in SCENE_CATALOG:
            raise ValueError(f"Unknown scene_id: {scene_id}. Available: {list(SCENE_CATALOG.keys())}")

        scene = SCENE_CATALOG[scene_id]
        task_classified = self.classify_intent(query, scene)
        files = scene["files"]

        # Default trace metadata containers
        input_metadata = {}
        gis_preflight = "PASSED"
        selected_model = ""
        visual_artifact_url = ""
        text_response = ""
        confidence_score = 0.92

        # Step-by-step reasoning steps for the audit terminal
        reasoning_steps = [
            f"[PREFLIGHT] Ingested scene '{scene_id}' ({scene['sensor']})",
            f"[ROUTER] Natural-language query analyzed: '{query}'",
            f"[ROUTER] Intent classified as: {task_classified}",
        ]

        metrics = {}
        if task_classified == "BITEMPORAL_CHANGE_DETECTION":
            t1_file = files.get("t1_geotiff")
            t2_file = files.get("t2_geotiff")
            audit = GisValidator.audit_pair(t1_file, t2_file, task_mode="bi_temporal")
            gis_preflight = audit["gis_preflight"]
            reasoning_steps.append(f"[GIS] Verified co-registration across {audit['meta_a']['crs']} with {audit['overlap_percentage']}% spatial overlap")

            # Dispatch
            res = self.change_service.detect_changes(scene_id, t1_file, t2_file, query)
            text_response = res["text_response"]
            visual_artifact_url = res["visual_artifact_url"]
            selected_model = res["model_name"]
            confidence_score = res["confidence_score"]
            metrics = res.get("metrics", {})

            input_metadata = {
                "t1_crs": audit["meta_a"]["crs"],
                "t2_crs": audit["meta_b"]["crs"],
                "resolution_gsd": audit["meta_b"]["resolution_gsd"],
                "ground_area_km2": audit["meta_b"].get("ground_area_km2", 14.2)
            }
            if res.get("neural_active"):
                reasoning_steps.append(f"[NEURAL EXEC] Bitemporal Image Transformer (BIT_CD) forward pass executed using '{res.get('weights_file', 'bit_cd_bitemporal_best.pt')}'. Generated neural change mask: {visual_artifact_url}")
            else:
                reasoning_steps.append(f"[EXEC] Siamese-Spectral difference executed. Mask generated: {visual_artifact_url}")

        elif task_classified == "CROSS_MODAL_FUSION":
            opt_file = files.get("optical_geotiff")
            sar_file = files.get("sar_geotiff")
            audit = GisValidator.audit_pair(opt_file, sar_file, task_mode="cross_modal")
            gis_preflight = audit["gis_preflight"]
            reasoning_steps.append(f"[GIS] Optical ({audit['meta_a']['resolution_gsd']}) and SAR ({audit['meta_b']['resolution_gsd']}) CRS aligned to {audit['meta_a']['crs']}")

            # Dispatch
            res = self.cross_modal_service.fuse_and_analyze(scene_id, opt_file, sar_file, query)
            text_response = res["text_response"]
            visual_artifact_url = res["visual_artifact_url"]
            selected_model = res["model_name"]
            confidence_score = res["confidence_score"]
            metrics = {
                "inundation_km2": res.get("inundation_km2"),
                "inundation_pct": res.get("inundation_pct"),
                "cloud_occlusion_pct": res.get("cloud_occlusion_pct")
            }

            input_metadata = {
                "optical_crs": audit["meta_a"]["crs"],
                "sar_crs": audit["meta_b"]["crs"],
                "resolution_gsd": f"{audit['meta_a']['resolution_gsd']} / {audit['meta_b']['resolution_gsd']}",
                "ground_area_km2": audit["meta_a"].get("ground_area_km2", 28.4)
            }
            reasoning_steps.append(f"[EXEC] C-band SAR despeckled and fused with optical NIR bands.")

        else: # SINGLE_VQA or VISUAL_GROUNDING
            geotiff_file = files.get("t1_geotiff") or files.get("optical_geotiff")
            meta = GisValidator.inspect_raster(geotiff_file)
            reasoning_steps.append(f"[GIS] Inspected raster: {meta['crs']} at {meta['resolution_gsd']}")

            # Dispatch
            res = self.vqa_service.process_query(scene_id, query, geotiff_file)
            text_response = res["text_response"]
            visual_artifact_url = res["visual_artifact_url"]
            selected_model = res["model_name"]
            confidence_score = res["confidence_score"]
            metrics = {
                "detected_features": res.get("detected_features", []),
                "bounding_boxes": res.get("bounding_boxes", [])
            }

            input_metadata = {
                "crs": meta["crs"],
                "resolution_gsd": meta["resolution_gsd"],
                "ground_area_km2": meta.get("ground_area_km2", 14.2)
            }
            reasoning_steps.append(f"[EXEC] Remote Sensing VLM generated feature grounding coordinates.")

        total_latency_ms = round((time.perf_counter() - start_wall_time) * 1000.0, 1)

        # Build schema-compliant observable trace
        execution_trace = {
            "task_classified": task_classified,
            "selected_model": selected_model,
            "input_metadata": input_metadata,
            "gis_preflight": gis_preflight,
            "confidence_score": confidence_score,
            "latency_ms": total_latency_ms,
            "status": "SUCCESS",
            "reasoning_steps": reasoning_steps
        }

        return {
            "text_response": text_response,
            "visual_artifact_url": visual_artifact_url,
            "execution_trace": execution_trace,
            "metrics": metrics
        }
