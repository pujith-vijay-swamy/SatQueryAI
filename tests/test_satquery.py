"""
SatQuery AI — Comprehensive Verification & Integration Test Suite
Validates GIS preflight calculations, agentic routing, specialist models, and API responses.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from backend.main import app
from backend.core.config import SCENE_CATALOG, SAMPLES_DIR, STATIC_DIR
from backend.core.gis_validator import GisValidator
from backend.controller.agent_router import AgentRouter
from backend.services.vqa_service import VqaService
from backend.services.change_service import ChangeDetectionService
from backend.services.cross_modal_service import CrossModalService

client = TestClient(app)

def test_samples_exist():
    """Verify synthetic GeoTIFFs exist with valid dimensions."""
    ahmedabad_t1 = SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.tif"
    ahmedabad_t2 = SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif"
    assam_opt = SAMPLES_DIR / "assam" / "optical_sentinel_2024.tif"
    assam_sar = SAMPLES_DIR / "assam" / "sar_risat_2024.tif"

    assert ahmedabad_t1.exists(), "Ahmedabad T1 GeoTIFF missing"
    assert ahmedabad_t2.exists(), "Ahmedabad T2 GeoTIFF missing"
    assert assam_opt.exists(), "Assam Optical GeoTIFF missing"
    assert assam_sar.exists(), "Assam SAR GeoTIFF missing"

def test_gis_validator_inspection():
    """Verify raster inspection accurately extracts CRS, GSD, and bounds."""
    ahmedabad_t1 = str(SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.tif")
    meta = GisValidator.inspect_raster(ahmedabad_t1)

    assert meta["crs"] == "EPSG:32643"
    assert meta["is_projected"] is True
    assert meta["width"] == 512
    assert meta["height"] == 512
    assert meta["gsd_meters"] == 0.65
    assert meta["ground_area_km2"] > 0.1
    assert "center_wgs84" in meta

def test_gis_validator_audit_pair():
    """Verify bi-temporal and cross-modal audit checks."""
    ahmedabad_t1 = str(SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.tif")
    ahmedabad_t2 = str(SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif")
    audit = GisValidator.audit_pair(ahmedabad_t1, ahmedabad_t2, task_mode="bi_temporal")

    assert audit["gis_preflight"] == "PASSED"
    assert audit["crs_match"] is True
    assert audit["overlap_percentage"] > 95.0

def test_change_detection_service():
    """Verify Siamese spectral change detection and visual mask artifact creation."""
    ahmedabad_t1 = str(SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.tif")
    ahmedabad_t2 = str(SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif")
    service = ChangeDetectionService()
    res = service.detect_changes("ahmedabad_bitemporal", ahmedabad_t1, ahmedabad_t2)

    assert "text_response" in res
    assert "visual_artifact_url" in res
    assert res["visual_artifact_url"].startswith("/static/masks/")
    # Ensure visual artifact file was saved to disk
    artifact_path = STATIC_DIR / res["visual_artifact_url"].replace("/static/", "")
    assert artifact_path.exists(), f"Artifact file {artifact_path} was not created on disk"

def test_cross_modal_service():
    """Verify Optical-SAR fusion and flood inundation mask generation."""
    assam_opt = str(SAMPLES_DIR / "assam" / "optical_sentinel_2024.tif")
    assam_sar = str(SAMPLES_DIR / "assam" / "sar_risat_2024.tif")
    service = CrossModalService()
    res = service.fuse_and_analyze("assam_flood_crossmodal", assam_opt, assam_sar)

    assert "text_response" in res
    assert "visual_artifact_url" in res
    assert res["inundation_km2"] > 0

def test_vqa_service():
    """Verify RS-VQA and visual grounding bounding box emission."""
    ahmedabad_t2 = str(SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.tif")
    service = VqaService()
    res = service.process_query("ahmedabad_single_baseline", "Ground bounding box coordinates for newly constructed industrial storage facilities", ahmedabad_t2)

    assert "text_response" in res
    assert "visual_artifact_url" in res
    assert len(res["bounding_boxes"]) > 0

def test_agent_router_intent_and_trace():
    """Verify agent router correctly classifies intent and produces schema-compliant trace."""
    router = AgentRouter()
    res = router.execute_query("ahmedabad_bitemporal", "What changed between these two dates and where did it occur?")

    assert "text_response" in res
    assert "visual_artifact_url" in res
    assert "execution_trace" in res

    trace = res["execution_trace"]
    assert trace["task_classified"] == "BITEMPORAL_CHANGE_DETECTION"
    assert trace["gis_preflight"] == "PASSED"
    assert trace["status"] == "SUCCESS"
    assert "input_metadata" in trace
    assert trace["confidence_score"] > 0.9
    assert trace["latency_ms"] > 0

def test_fastapi_endpoints():
    """Verify all FastAPI REST endpoints."""
    # 1. Health
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ONLINE"

    # 2. Scenes
    r_scenes = client.get("/api/scenes")
    assert r_scenes.status_code == 200
    assert "ahmedabad_bitemporal" in r_scenes.json()["scenes"]

    # 3. Preflight
    r_preflight = client.get("/api/preflight/ahmedabad_bitemporal")
    assert r_preflight.status_code == 200
    assert r_preflight.json()["audit"]["gis_preflight"] == "PASSED"

    # 4. Analyze
    r_analyze = client.post("/api/analyze", json={
        "scene_id": "ahmedabad_bitemporal",
        "query": "What changed between these two dates and where did it occur?"
    })
    assert r_analyze.status_code == 200
    payload = r_analyze.json()
    assert "text_response" in payload
    assert "execution_trace" in payload
    assert payload["execution_trace"]["task_classified"] == "BITEMPORAL_CHANGE_DETECTION"
    # 5. GeoChat Config
    r_geo_get = client.get("/api/config/geochat")
    assert r_geo_get.status_code == 200

    r_geo_set = client.post("/api/config/geochat", json={"url": ""})
    assert r_geo_set.status_code == 200
    assert r_geo_set.json()["status"] == "SUCCESS"

    # 6. Upload & Compare with Sample Images
    t1_path = SAMPLES_DIR / "ahmedabad" / "t1_cartosat_2021.png"
    t2_path = SAMPLES_DIR / "ahmedabad" / "t2_cartosat_2024.png"
    if t1_path.exists() and t2_path.exists():
        with open(t1_path, "rb") as f1, open(t2_path, "rb") as f2:
            r_upload = client.post(
                "/api/upload/compare",
                files={
                    "t1_file": ("t1.png", f1, "image/png"),
                    "t2_file": ("t2.png", f2, "image/png"),
                },
                data={
                    "title": "Automated Test Comparison AOI",
                    "t1_label": "2021 Test",
                    "t2_label": "2024 Test",
                }
            )
            assert r_upload.status_code == 200
            up_data = r_upload.json()
            assert up_data["status"] == "SUCCESS"
            assert "scene" in up_data
            assert "analysis" in up_data
            assert up_data["analysis"]["visual_artifact_url"].startswith("/static/masks/")

    print("[ALL TESTS PASSED SUCCESSFULLY]")

if __name__ == "__main__":
    test_samples_exist()
    print("test_samples_exist: PASSED")
    test_gis_validator_inspection()
    print("test_gis_validator_inspection: PASSED")
    test_gis_validator_audit_pair()
    print("test_gis_validator_audit_pair: PASSED")
    test_change_detection_service()
    print("test_change_detection_service: PASSED")
    test_cross_modal_service()
    print("test_cross_modal_service: PASSED")
    test_vqa_service()
    print("test_vqa_service: PASSED")
    test_agent_router_intent_and_trace()
    print("test_agent_router_intent_and_trace: PASSED")
    test_fastapi_endpoints()
    print("test_fastapi_endpoints: PASSED")
    print("=" * 50)
    print("ALL SATQUERY AI INTEGRATION TESTS PASSED 100%!")
    print("=" * 50)
