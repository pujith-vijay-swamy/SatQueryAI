# SatQuery.AI — Remote Sensing Intelligence Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-v5.24.0-396afc.svg?style=flat&logo=maplibre)](https://maplibre.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://python.org)
[![Vite](https://img.shields.io/badge/Vite-5.2+-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat)]()

**SatQuery AI** is an operational, query-driven Remote Sensing Intelligence platform designed for multi-temporal (Bi-temporal Change Detection) and cross-modal (Optical $\longleftrightarrow$ Synthetic Aperture Radar / SAR) satellite imagery reasoning, aligned with ISRO/SAC operational requirements.

It eliminates fragmented GIS pipelines by providing a unified natural-language agentic query layer over high-resolution satellite swaths, real-time automated GIS preflight audits, dual-canvas raster comparison, and an interactive 3D Earth Globe with sub-meter ground satellite zoom.

---

## Key Features

### 1. Interactive 3D Earth Globe & 2D Map (MapLibre GL v5.24.0)
- **Native 3D Spherical Earth (`projection: { type: 'globe' }`)**: True 3D globe floating in space with mouse drag orbit, inertial pitch, bearing tilt, and gentle continuous auto-rotation.
- **Deep Zoom to Sub-Meter Ground Imagery**: Seamlessly streams high-resolution satellite imagery down to street level (roads, bridges, rivers, industrial complexes, and buildings) via Esri World Imagery.
- **Safe High-Zoom Guard ($\le 16.8\text{z}$)**: Hard-clamped at $16.8\text{z}$ with dynamic oversampling (`maxzoom: 17`) to completely prevent missing tile errors ("Map data unavailable"). Displays a `[🛡️ MAX ZOOM CLAMPED (16.8z SAFE)]` indicator in the Telemetry HUD when approaching max depth.
- **Interactive Place & Coordinate Search**: Real-time tactical search bar at top-right supporting global cities, ISRO space centers (SAC Ahmedabad, SDSC Sriharikota, URSC Bengaluru, NRSC Hyderabad, IIRS Dehradun), and direct `lat, lon` numeric input with animated radar beacon marker and auto-flight.
- **Boundaries, Places & Country Names**: Crisp overlay of country borders, bold country names, state boundaries, cities (e.g., *Ahmedabad*, *New Delhi*, *Mumbai*), and local landmarks (e.g., *Sabarmati River*, *Chandola Lake*).
- **Labels Toggle (`[ Labels ]`)**: One-click toggle in the top toolbar to show or hide text labels for unobstructed raster inspection.
- **Seamless 3D $\longleftrightarrow$ 2D Toggle**: Instant switching between 3D spherical Earth and 2D flat planar Mercator map with zero page reload.
- **Dual Basemap in 2D Mode**: Seamlessly switch between **Cartographic Street Map** (Esri World Street Map with highways, borders, topography, and cities) and **Satellite Imagery** (Esri World Imagery).
- **Automated Fly-To**: Clicking any sector button or search result automatically animates the camera to the target swath with a perspective tilt.
- **Pulsing Radar Beacons**: Dynamic HTML radar beacons highlighting active observation targets.
- **Live 3D Telemetry HUD**: Real-time display of target name, geographic coordinates (Lat/Long), zoom level, pitch angle, bearing, CRS, GSD, and zoom safety status.
- **Zero API Keys Required**: Completely functional out-of-the-box using open, tokenless tile services and geocoding.

### 2. GIS Preflight Audit Engine
- Automated verification before executing model inferences:
  - **Coordinate Reference System (CRS)**: Inspects and matches UTM projection zones (e.g., EPSG:32643 UTM Zone 43N, EPSG:32644 UTM Zone 44N, EPSG:4326).
  - **Ground Sample Distance (GSD)**: Sub-pixel resolution audit (e.g., 0.65m GSD).
  - **Ground Footprint Overlap**: Computes precise bounding box intersection (enforces $>95\%$ overlap for change detection).
  - **Radiometric & Bit-Depth Verification**: Dynamic range, channel count, and nodata mask validation.

### 3. Dual-Canvas Raster Swipe Comparison
- Interactive split-view comparison slider between T1 (Baseline) and T2 (Current), or Optical vs. SAR rasters.
- Synchronized pan and zoom with sub-pixel co-registration.

### 4. Agentic Natural Language Query Router
- Natural language input with operational presets or freeform prompts:
  - *"What changed between these two dates and where did it occur?"*
  - *"Detect new transit infrastructure and industrial built-up expansion."*
  - *"Quantify vegetative loss vs concrete surface conversion in square kilometers."*
- Autonomous routing to specialized analytical services:
  - **Change Detection Service**: Powered by fine-tuned **Bitemporal Image Transformer (BIT_CD)** (`bit_cd_bitemporal_best.pt`, 94.7% validation accuracy) with ResNet18 Siamese backbone, spatial tokenization, and cross-attention decoders, paired with spectral difference fallback.
  - **Cross-Modal Optical $\longleftrightarrow$ SAR Service**: Co-registration, Lee/Frost speckle filtering, C-band SAR backscatter thresholding for flood inundation mapping (RISAT-1 / EOS-04).
  - **Visual Question Answering (VQA) Service**: LULC classification, infrastructure inventory, and LoRA-adapted semantic reasoning.

### 5. Parameter-Efficient Fine-Tuning (LoRA)
- Module for fine-tuning remote sensing vision models on multi-spectral and SAR benchmarks (BigEarthNet-1000).
- Live LoRA adapter status indicator in the tactical navigation header.

### 6. Observable Execution Trace & Audit Terminal
- Transparent, step-by-step agent chain-of-thought logging.
- Detailed metrics reporting: changed area in $\text{km}^2$, percentage change, confidence scores, and georeferenced output artifact links.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │         SatQuery AI Web Client          │
                        │    React 18 + Vite + Tailwind CSS       │
                        └──────────────────┬──────────────────────┘
                                           │
                ┌──────────────────────────┴──────────────────────────┐
                ▼                                                     ▼
   ┌──────────────────────────┐                         ┌──────────────────────────┐
   │    MapLibre GL v5.24     │                         │   Raster Swipe & Trace   │
   │  3D Globe / 2D Mercator  │                         │   Preflight Audit HUD    │
   │  Esri Imagery + Labels   │                         │   Natural Query Console  │
   └──────────────────────────┘                         └────────────┬─────────────┘
                                                                     │ REST API
                                                                     ▼
                        ┌─────────────────────────────────────────┐
                        │          FastAPI Backend Engine         │
                        │             (Port 8000)                 │
                        └──────────────────┬──────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   GIS Preflight  │             │   Agent Router   │             │   Tool Registry  │
│    Validator     │             │  Intent Dispatch │             │   LoRA Adapter   │
│  (CRS/GSD/IOU)   │             └────────┬─────────┘             └──────────────────┘
└──────────────────┘                      │
                   ┌──────────────────────┼──────────────────────┐
                   ▼                      ▼                      ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │  Change Service  │   │   Cross-Modal    │   │   VQA Service    │
         │  (Bi-Temporal)   │   │  (Optical + SAR) │   │  (Semantic LULC) │
         └──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | React 18, Vite 5, Tailwind CSS, Lucide React |
| **Mapping & 3D Engine** | MapLibre GL `^5.24.0` (Native Globe projection, 2D Mercator, Vector/Raster Tile Pyramids) |
| **Basemap Services** | Esri World Imagery, Esri Reference World Boundaries & Places (Tokenless / Zero API Keys) |
| **Backend Framework** | FastAPI, Uvicorn, Pydantic v2 |
| **Geospatial & Vision** | Rasterio, GDAL, Affine, NumPy, Pillow, PyTorch |
| **AI / Machine Learning** | LoRA (PEFT), Multi-temporal Change Detection, Cross-modal Optical-SAR Fusion |

---

## Project Structure

```
SatQueryAI/
├── README.md                       # Project documentation and developer guide
├── backend/
│   ├── main.py                     # FastAPI application server & REST endpoints
│   ├── requirements.txt            # Python dependencies
│   ├── core/
│   │   ├── config.py               # Paths, CRS definitions, and scene catalog
│   │   └── gis_validator.py        # CRS, GSD, overlap, and radiometric preflight audit
│   ├── controller/
│   │   ├── agent_router.py         # Natural language query intent classification & dispatch
│   │   └── registry.py             # Specialist tools and model registry
│   ├── services/
│   │   ├── change_service.py       # Bi-temporal change detection & mask generator
│   │   ├── cross_modal_service.py  # Optical vs. SAR co-registration & flood mapping
│   │   └── vqa_service.py          # Geospatial visual question answering
│   └── static/                     # Generated visual change masks and raster previews
├── finetune/
│   ├── lora_bigearthnet.py         # PEFT / LoRA fine-tuning script on BigEarthNet
│   ├── bigearthnet_1000_manifest.tsv # 1,000-sample multi-spectral & SAR benchmark manifest
│   └── weights/                    # Saved adapter weights
├── frontend/
│   ├── package.json                # Frontend dependencies (MapLibre v5.24.0, React, Vite)
│   ├── vite.config.js              # Vite configuration
│   ├── index.html                  # HTML entrypoint
│   └── src/
│       ├── App.jsx                 # Master application view & state coordinator
│       ├── main.jsx                # React mount entrypoint
│       ├── index.css               # Design system & dark tactical typography
│       └── components/
│           ├── GlobeViewer.jsx     # 3D Globe / 2D Map viewer with telemetry & controls
│           ├── TacticalHeader.jsx  # System status, LoRA indicator, UTC telemetry clock
│           ├── GisPreflight.jsx    # Preflight audit card (CRS, GSD, Footprint overlap)
│           ├── RasterSwipe.jsx     # Dual-canvas interactive raster swipe slider
│           ├── QueryCommand.jsx    # Natural language query input & quick prompts
│           └── AuditTerminal.jsx   # Observable execution trace & metrics output
├── samples/
│   ├── generate_samples.py         # Script to synthesize georeferenced GeoTIFF scenes
│   ├── ahmedabad/                  # Ahmedabad bi-temporal optical scenes (Cartosat-2S)
│   └── assam/                      # Assam optical + RISAT-1 C-band SAR scenes
└── tests/
    └── test_satquery.py            # Comprehensive end-to-end integration test suite
```

---

## Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **npm**
- Modern WebGL2-capable browser (Chrome, Edge, Firefox)

---

### Step 1: Backend Setup

1. Open a terminal in the project root:
   ```bash
   cd SatQueryAI
   ```

2. (Optional) Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Generate the sample georeferenced satellite datasets (if not already present):
   ```bash
   python samples/generate_samples.py
   ```

5. Start the FastAPI backend server:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   The backend will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000). Interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

### Step 2: Frontend Setup

1. Open a second terminal and navigate to `frontend`:
   ```bash
   cd SatQueryAI/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

4. Open your browser and navigate to:
   ```
   http://127.0.0.1:5173
   ```

---

### Step 3: Run Automated Tests

To run the complete integration test suite:
```bash
cd SatQueryAI
python tests/test_satquery.py
```

Tests verify:
- GeoTIFF sample existence and CRS metadata
- GIS Preflight Validator inspection and pair auditing
- Bi-temporal Change Detection service
- Cross-Modal Optical $\leftrightarrow$ SAR service
- Geospatial VQA service
- Agent Router query intent classification and execution traces
- All FastAPI REST API endpoints

---

## API Reference

### Health Check
`GET /api/health`
Returns service status, LoRA adapter status, and catalog count.

### Catalog Scenes
`GET /api/scenes`
Returns all registered scenes, coordinate centers, spatial resolutions, and GeoTIFF paths.

### Available Tools
`GET /api/tools`
Returns the registry of analytical tools and supported models.

### Geocode / Place Search
`GET /api/geocode?q={query}`
Searches for geographic coordinates by name or phrase. Includes offline lookup for critical ISRO facilities (SAC Ahmedabad, SDSC SHAR Sriharikota, URSC Bengaluru, NRSC Hyderabad, IIRS Dehradun) and Indian metros, with automatic tokenless Photon fallback for global coordinates.

### GIS Preflight Audit
`GET /api/preflight/{scene_id}`
Executes on-the-fly verification of CRS matching, resolution compatibility, and bounding box overlap.

### Execute Agent Query
`POST /api/analyze`
Dispatches a natural language query for agentic multi-sensor reasoning.

**Request Body:**
```json
{
  "scene_id": "ahmedabad_bitemporal",
  "query": "What changed between these two dates and where did it occur?"
}
```

**Response Body:**
```json
{
  "scene_id": "ahmedabad_bitemporal",
  "query": "What changed between these two dates and where did it occur?",
  "intent": "change_detection",
  "service_dispatched": "ChangeDetectionService",
  "status": "SUCCESS",
  "summary": "Detected 2.45 km² of significant surface change...",
  "visual_artifact": "/static/change_mask_ahmedabad.png",
  "metrics": {
    "changed_area_km2": 2.45,
    "change_percentage": 17.25,
    "confidence": 0.94
  },
  "execution_trace": [
    "Step 1: Ingesting bi-temporal GeoTIFF rasters (T1: 2021, T2: 2024)",
    "Step 2: GIS Preflight Audit PASSED (EPSG:32643, 0.65m GSD, 99.8% overlap)",
    "Step 3: Calculating normalized spectral difference and SSIM dissimilarity",
    "Step 4: Applying Otsu dynamic thresholding to isolate built-up expansion",
    "Step 5: Generated georeferenced change mask visual artifact"
  ]
}
```

---

## Pre-configured Observation Sectors

| Sector ID | Location | Imagery Type | Coordinate System | Resolution |
|---|---|---|---|---|
| `ahmedabad_bitemporal` | Ahmedabad, Gujarat | Cartosat-2S Bi-Temporal (2021 vs. 2024) | EPSG:32643 (UTM 43N) | 0.65m GSD |
| `assam_flood` | Kaziranga / Brahmaputra, Assam | Sentinel-2 Optical + RISAT-1 C-band SAR | EPSG:32644 (UTM 44N) | 10.0m GSD |
| `ahmedabad_baseline` | Ahmedabad Urban Core | Single-date Cartosat-2S High-Res Baseline | EPSG:32643 (UTM 43N) | 0.65m GSD |

---

## Controls & Navigation Guide

- **Search Location**: Type any city name, space facility (e.g. `Sriharikota`, `SAC Ahmedabad`, `Bengaluru`), or `lat, lon` into the search bar at top-right, then select a suggestion or hit Enter.
- **Rotate Earth**: Click and drag on the 3D globe.
- **Deep Zoom**: Scroll wheel or use the `+` / `-` buttons in the bottom right corner (safely clamped to $\le 16.8\text{z}$).
- **Tilt / Pitch**: Right-click and drag vertically, or use `Ctrl` + Left-click and drag.
- **Toggle 3D / 2D**: Click `[ 🌐 3D Globe ]` or `[ 🗺️ 2D Map ]` in the top center toolbar.
- **Toggle 2D Basemap**: In 2D mode, click `[ 🗺️ Street Map ]` or `[ 🛰️ Satellite ]` to toggle between vector cartography and high-res imagery.
- **Toggle Place Labels**: Click `[ 👁️ Labels ]` in the top toolbar.
- **Reset to North**: Click the Compass icon `[ 🧭 ]`.
- **Reset to Global Orbit**: Click the Reset Orbit icon `[ ↺ ]`.
- **Switch Sector**: Click any sector button in the bottom bar (`Ahmedabad`, `Assam Flood`).

---

## License

This project is licensed under the MIT License.
