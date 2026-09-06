"""
SatQuery AI — FastAPI Application Server
Operational Remote Sensing Reasoning Engine with Agentic Routing & GIS Preflight
"""

import os
import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.core.config import STATIC_DIR, SCENE_CATALOG, LORA_ACTIVE, LORA_WEIGHT_PATH, BIT_CD_ACTIVE, BIT_CD_WEIGHT_PATH
from backend.core.gis_validator import GisValidator
from backend.controller.agent_router import AgentRouter
from backend.controller.registry import ToolRegistry

app = FastAPI(
    title="SatQuery AI Backend",
    description="Agentic Multi-Temporal & Cross-Modal Remote Sensing Assistant for ISRO/SAC Telemetry",
    version="1.0.0"
)

# CORS Configuration for local Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (Change masks, GeoTIFF web previews)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Singleton Router
router = AgentRouter()

class AnalyzeRequest(BaseModel):
    scene_id: str
    query: str

class SwathTaskRequest(BaseModel):
    lat: float
    lon: float
    t1_year: int = 2021
    t2_year: int = 2024
    radius_km: float = 2.0
    max_cloud: float = 20.0
    season: Optional[str] = "any"
    auto_analyze: bool = True

@app.get("/api/health")
async def health_check():
    return {
        "status": "ONLINE",
        "service": "SatQuery AI Remote Sensing Gateway",
        "lora_adapter_present": LORA_ACTIVE,
        "lora_weight_path": str(LORA_WEIGHT_PATH),
        "bit_cd_model_present": BIT_CD_ACTIVE,
        "bit_cd_weight_path": str(BIT_CD_WEIGHT_PATH),
        "bit_cd_filename": BIT_CD_WEIGHT_PATH.name if BIT_CD_ACTIVE else None,
        "bit_cd_val_acc": 0.9469 if BIT_CD_ACTIVE else None,
        "available_scenes_count": len(SCENE_CATALOG)
    }

@app.get("/api/scenes")
async def get_scenes():
    """
    Returns registered georeferenced scenes, coordinate centers, GSD, and preview paths.
    """
    return {
        "scenes": SCENE_CATALOG,
        "active_crs_definitions": {
            "EPSG:32643": "UTM Zone 43N (Gujarat)",
            "EPSG:32644": "UTM Zone 44N (Assam)",
            "EPSG:4326": "WGS 84 Lat/Lon"
        }
    }

@app.get("/api/tools")
async def get_tools():
    """
    Returns the specialist model and tool registry.
    """
    return ToolRegistry.list_tools()

PRECONFIGURED_PLACES = [
    {"name": "Ahmedabad", "description": "Gujarat, India · ISRO Space Applications Centre (SAC)", "coordinates": [72.5850, 23.0338], "zoom": 13.5},
    {"name": "Sriharikota", "description": "Andhra Pradesh, India · Satish Dhawan Space Centre (SHAR)", "coordinates": [80.2300, 13.7190], "zoom": 13.0},
    {"name": "Bengaluru", "description": "Karnataka, India · ISRO Headquarters & URSC", "coordinates": [77.5946, 12.9716], "zoom": 13.0},
    {"name": "Hyderabad", "description": "Telangana, India · National Remote Sensing Centre (NRSC)", "coordinates": [78.4867, 17.3850], "zoom": 13.0},
    {"name": "Dehradun", "description": "Uttarakhand, India · Indian Institute of Remote Sensing (IIRS)", "coordinates": [78.0322, 30.3165], "zoom": 13.0},
    {"name": "Kaziranga", "description": "Assam, India · Brahmaputra Flood Plain Basin", "coordinates": [92.9370, 26.2000], "zoom": 12.0},
    {"name": "New Delhi", "description": "National Capital Territory of Delhi, India", "coordinates": [77.2090, 28.6139], "zoom": 12.5},
    {"name": "Mumbai", "description": "Maharashtra, India · Western Seaboard Port", "coordinates": [72.8777, 19.0760], "zoom": 12.5},
    {"name": "Kolkata", "description": "West Bengal, India · Gangetic Delta Basin", "coordinates": [88.3639, 22.5726], "zoom": 12.5},
    {"name": "Chennai", "description": "Tamil Nadu, India · Coromandel Coast", "coordinates": [80.2707, 13.0827], "zoom": 12.5},
    {"name": "Jaipur", "description": "Rajasthan, India · Thar Desert Margin", "coordinates": [75.7873, 26.9124], "zoom": 13.0},
    {"name": "Surat", "description": "Gujarat, India · Tapi River Basin", "coordinates": [72.8311, 21.1702], "zoom": 13.0},
    {"name": "Pune", "description": "Maharashtra, India · Western Ghats Foothills", "coordinates": [73.8567, 18.5204], "zoom": 13.0},
    {"name": "Chandigarh", "description": "Punjab / Haryana, India · Shivalik Foothills", "coordinates": [76.7794, 30.7333], "zoom": 13.0},
    {"name": "London", "description": "United Kingdom · River Thames Corridor", "coordinates": [-0.1276, 51.5074], "zoom": 12.0},
    {"name": "Tokyo", "description": "Japan · Tokyo Bay Megalopolis", "coordinates": [139.6917, 35.6895], "zoom": 12.0},
    {"name": "New York", "description": "New York, USA · Hudson River & Manhattan", "coordinates": [-74.0060, 40.7128], "zoom": 12.0},
    {"name": "Dubai", "description": "United Arab Emirates · Persian Gulf Coast", "coordinates": [55.2708, 25.2048], "zoom": 12.0},
    {"name": "Paris", "description": "France · Seine River Basin", "coordinates": [2.3522, 48.8566], "zoom": 12.0},
    {"name": "Singapore", "description": "Republic of Singapore · Malacca Strait", "coordinates": [103.8198, 1.3521], "zoom": 12.0},
    {"name": "Sydney", "description": "New South Wales, Australia · Port Jackson", "coordinates": [151.2093, -33.8688], "zoom": 12.0},
    {"name": "Cairo", "description": "Egypt · Nile River Delta", "coordinates": [31.2357, 30.0444], "zoom": 12.0},
]

@app.get("/api/geocode")
async def geocode_place(q: str = ""):
    """
    Geocodes places, cities, and space facilities with instant pre-indexed database + online fallback.
    """
    query = q.strip().lower()
    if not query:
        return {"results": []}

    results = []
    # 1. Check curated internal registry
    for place in PRECONFIGURED_PLACES:
        if query in place["name"].lower() or query in place["description"].lower():
            results.append(place)

    # 2. Query online geocoding API for global places if fewer than 5 results
    if len(results) < 5:
        try:
            url = f"https://photon.komoot.io/api/?q={urllib.parse.quote(query)}&limit=5"
            req = urllib.request.Request(url, headers={"User-Agent": "SatQueryAI/1.0 (ISRO/SAC Remote Sensing Assistant)"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    for feat in data.get("features", []):
                        props = feat.get("properties", {})
                        coords = feat.get("geometry", {}).get("coordinates", [])
                        if len(coords) >= 2:
                            name = props.get("name") or query.title()
                            parts = [p for p in [props.get("city"), props.get("state"), props.get("country")] if p]
                            desc = ", ".join(parts) if parts else "Geocoded Location"
                            if not any(r["name"].lower() == name.lower() and abs(r["coordinates"][0] - coords[0]) < 0.02 for r in results):
                                results.append({
                                    "name": name,
                                    "description": desc,
                                    "coordinates": [float(coords[0]), float(coords[1])],
                                    "zoom": 13.0
                                })
        except Exception:
            pass

    return {"results": results[:8]}

@app.get("/api/preflight/{scene_id}")
async def get_preflight(scene_id: str):
    """
    Performs real-time GIS preflight audit for a specified scene.
    """
    if scene_id not in SCENE_CATALOG:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found.")

    scene = SCENE_CATALOG[scene_id]
    mode = scene["mode"]
    files = scene["files"]

    if mode == "bi_temporal":
        audit = GisValidator.audit_pair(files["t1_geotiff"], files["t2_geotiff"], task_mode="bi_temporal")
        return {
            "scene_id": scene_id,
            "mode": mode,
            "audit": audit
        }
    elif mode == "cross_modal":
        audit = GisValidator.audit_pair(files["optical_geotiff"], files["sar_geotiff"], task_mode="cross_modal")
        return {
            "scene_id": scene_id,
            "mode": mode,
            "audit": audit
        }
    else:
        meta = GisValidator.inspect_raster(files.get("t1_geotiff") or files.get("optical_geotiff"))
        return {
            "scene_id": scene_id,
            "mode": mode,
            "audit": {
                "gis_preflight": "PASSED",
                "crs_match": True,
                "meta_a": meta,
                "meta_b": meta,
                "overlap_percentage": 100.0,
                "warnings": []
            }
        }

@app.post("/api/analyze")
async def analyze_scene(payload: AnalyzeRequest):
    """
    Executes agentic query analysis across optical, SAR, or bi-temporal satellite rasters.
    Returns text response, visual artifact URL, and observable execution trace.
    """
    try:
        response = router.execute_query(payload.scene_id, payload.query)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/swath/task")
async def task_swath(req: SwathTaskRequest):
    """
    On-demand temporal swath tasking via AWS Earth Search Sentinel-2 COG streaming.
    Streams T1 and T2 bounding-box crops, registers the scene, and runs BIT-CD inference.
    """
    from backend.services.stac_service import StacTemporalService
    try:
        dynamic_scene = StacTemporalService.fetch_temporal_swath(
            lat=req.lat,
            lon=req.lon,
            t1_year=req.t1_year,
            t2_year=req.t2_year,
            radius_km=req.radius_km,
            max_cloud=req.max_cloud,
            season=req.season
        )
        scene_id = dynamic_scene["id"]
        SCENE_CATALOG[scene_id] = dynamic_scene

        # Preflight audit
        preflight = GisValidator.audit_pair(
            dynamic_scene["files"]["t1_geotiff"],
            dynamic_scene["files"]["t2_geotiff"],
            task_mode="bi_temporal"
        )

        analysis = None
        if req.auto_analyze:
            default_query = f"What changed between {req.t1_year} and {req.t2_year} and where did it occur?"
            analysis = router.execute_query(scene_id, default_query)

        return {
            "status": "SUCCESS",
            "scene": dynamic_scene,
            "preflight": preflight,
            "analysis": analysis
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Swath tasking error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
