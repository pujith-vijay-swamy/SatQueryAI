import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Globe, Map, Compass, RotateCcw, Eye, EyeOff, Search, X, MapPin, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import Starfield from './Starfield';
import AtmosphereOverlay from './AtmosphereOverlay';

const MAX_SAFE_ZOOM = 16.8; // Safety layer limit: prevents requesting non-existent tile levels (404 / unavailable)

export default function GlobeViewer({
  // State for AtmosphereOverlay
 activeScene, onSelectScene, scenes = {}, onTaskSwath }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const isRotatingRef = useRef(true);
  const markersRef = useRef([]);
  const searchMarkerRef = useRef(null);

  const [projection, setProjection] = useState('globe'); // 'globe' (3D) or 'mercator' (2D)
  const projectionRef = useRef('globe');
  const [mapInstance, setMapInstance] = useState(null);

  const [basemapType, setBasemapType] = useState('imagery'); // 'imagery' or 'streets'
  const [showLabels, setShowLabels] = useState(true);

  // Swath Tasking State (Sentinel-2 COG on-demand)
  const [taskSwathMode, setTaskSwathMode] = useState(false);
  const taskSwathModeRef = useRef(false);
  taskSwathModeRef.current = taskSwathMode;
  const [t1Year, setT1Year] = useState(2021);
  const t1YearRef = useRef(2021);
  t1YearRef.current = t1Year;
  const [t2Year, setT2Year] = useState(2024);
  const t2YearRef = useRef(2024);
  t2YearRef.current = t2Year;
  const [radiusKm, setRadiusKm] = useState(2.0);
  const radiusKmRef = useRef(2.0);
  radiusKmRef.current = radiusKm;
  const [maxCloud, setMaxCloud] = useState(20.0);
  const maxCloudRef = useRef(20.0);
  maxCloudRef.current = maxCloud;
  const [season, setSeason] = useState('any');
  const seasonRef = useRef('any');
  seasonRef.current = season;
  const [isTasking, setIsTasking] = useState(false);
  const onTaskSwathRef = useRef(onTaskSwath);
  onTaskSwathRef.current = onTaskSwath;

  // Fully dynamic Sentinel-2 operational years from launch (2015) to current year
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const availableYears = useMemo(() => {
    const list = [];
    for (let y = 2015; y <= currentYear; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Search Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [customTargetLabel, setCustomTargetLabel] = useState(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const searchDebounceRef = useRef(null);

  const [telemetry, setTelemetry] = useState({
    lat: 20.5937,
    lng: 78.9629,
    zoom: 2.0,
    pitch: 0,
    bearing: 0,
    projection: 'globe',
    status: '3D Satellite Orbit',
  });

  const sceneList = useMemo(() => Object.values(scenes), [scenes]);
  const onSelectSceneRef = useRef(onSelectScene);
  onSelectSceneRef.current = onSelectScene;

  const sceneFootprints = useMemo(() => ({
    ahmedabad_bitemporal: {
      center: [72.585, 23.033],
      bounds: [[72.545, 22.995], [72.625, 23.071]],
      color: '#22c55e',
      label: 'Ahmedabad (Cartosat-2S)',
    },
    assam_flood_crossmodal: {
      center: [92.937, 26.200],
      bounds: [[92.890, 26.150], [92.984, 26.250]],
      color: '#3b82f6',
      label: 'Assam Brahmaputra (Opt+SAR)',
    },
    ahmedabad_single_baseline: {
      center: [72.585, 23.033],
      bounds: [[72.545, 22.995], [72.625, 23.071]],
      color: '#f59e0b',
      label: 'Ahmedabad Baseline',
    },
  }), []);

  // Stable auto-rotation loop in 3D globe mode
  const rotateGlobe = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isRotatingRef.current) return;

    if (projectionRef.current === 'globe' && map.getZoom() < 5.0) {
      const currentBearing = map.getBearing();
      map.setBearing((currentBearing + 0.08) % 360);
      requestAnimationFrame(rotateGlobe);
    }
  }, []);

  // Update cursor based on taskSwathMode
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = taskSwathMode ? 'crosshair' : '';
  }, [taskSwathMode]);

  // Execute on-demand Sentinel-2 temporal swath tasking
  const handleExecuteSwathTask = useCallback(async (lat, lon) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    setIsTasking(true);
    isRotatingRef.current = false;
    setCustomTargetLabel(`TASKED AOI [${lat.toFixed(2)}°, ${lon.toFixed(2)}°]`);

    // 1. Smooth flight to target coordinate
    map.flyTo({
      center: [lon, lat],
      zoom: 13.5,
      pitch: 35,
      duration: 1800
    });

    // 2. Draw tactical AOI polygon bounding box on map
    const rKm = radiusKmRef.current;
    const latDelta = rKm / 111.0;
    const lonDelta = rKm / (111.0 * Math.cos(lat * Math.PI / 180));
    const bbox = [
      [lon - lonDelta, lat - latDelta],
      [lon + lonDelta, lat - latDelta],
      [lon + lonDelta, lat + latDelta],
      [lon - lonDelta, lat + latDelta],
      [lon - lonDelta, lat - latDelta]
    ];

    const aoiGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [bbox]
      },
      properties: {
        label: `AOI: ${t1YearRef.current} <-> ${t2YearRef.current}`
      }
    };

    if (map.getSource('tasked-aoi-source')) {
      map.getSource('tasked-aoi-source').setData(aoiGeoJSON);
    } else {
      map.addSource('tasked-aoi-source', {
        type: 'geojson',
        data: aoiGeoJSON
      });
      map.addLayer({
        id: 'tasked-aoi-fill',
        type: 'fill',
        source: 'tasked-aoi-source',
        paint: {
          'fill-color': '#00F0FF',
          'fill-opacity': 0.2
        }
      });
      map.addLayer({
        id: 'tasked-aoi-line',
        type: 'line',
        source: 'tasked-aoi-source',
        paint: {
          'line-color': '#00F0FF',
          'line-width': 2.5
        }
      });
    }

    // 3. Drop marker beacon
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }
    const markerEl = document.createElement('div');
    markerEl.className = 'target-beacon-pulse';
    markerEl.style.cssText = `
      width: 32px; height: 32px;
      border: 2px solid #00F0FF;
      border-radius: 50% !important;
      pointer-events: none;
    `;
    const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
      .setHTML(`
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px;">
          <div style="color: #00F0FF; font-weight: bold; margin-bottom: 3px;">🛰️ TASKING SENTINEL-2 COGS</div>
          <div style="color: #fafafa; font-size: 10px;">${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</div>
          <div style="color: #f59e0b; font-size: 10px; margin-top: 2px;">T1: ${t1YearRef.current} ⟷ T2: ${t2YearRef.current}</div>
        </div>
      `);
    searchMarkerRef.current = new maplibregl.Marker({ element: markerEl })
      .setLngLat([lon, lat])
      .setPopup(popup)
      .addTo(map);
    popup.addTo(map);

    // 4. Call parent callback to fetch COGs and run BIT-CD
    if (onTaskSwathRef.current) {
      await onTaskSwathRef.current({
        lat,
        lon,
        t1_year: t1YearRef.current,
        t2_year: t2YearRef.current,
        radius_km: radiusKmRef.current,
        max_cloud: maxCloudRef.current,
        season: seasonRef.current
      });
    }
    setIsTasking(false);
  }, []);

  // Mount MapLibre instance ONCE
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Tokenless Esri High-Resolution Satellite & Cartographic Street Map
    // maxzoom: 17 on sources forces MapLibre to oversample highest available tiles rather than requesting 404s
    const mapStyle = {
      version: 8,
      sources: {
        'esri-imagery': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 17, // Safety layer: clamps requested tile pyramid to zoom 17
          attribution: 'Esri, Maxar, Earthstar Geographics'
        },
        'esri-streets': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 17,
          attribution: 'Esri, HERE, Garmin, USGS, NGA'
        },
        'esri-boundaries': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 17,
          attribution: 'Esri'
        }
      },
      layers: [
        {
          id: 'esri-imagery-layer',
          type: 'raster',
          source: 'esri-imagery',
          minzoom: 0,
          maxzoom: 18,
          layout: { visibility: 'visible' }
        },
        {
          id: 'esri-streets-layer',
          type: 'raster',
          source: 'esri-streets',
          minzoom: 0,
          maxzoom: 18,
          layout: { visibility: 'none' }
        },
        {
          id: 'esri-boundaries-layer',
          type: 'raster',
          source: 'esri-boundaries',
          minzoom: 0,
          maxzoom: 18,
          layout: { visibility: 'visible' },
          paint: { 'raster-opacity': 0.9 }
        }
      ]
    };

    const map = new maplibregl.Map({
      container: container,
      style: mapStyle,
      center: [78.9629, 20.5937],
      zoom: 2.0,
      minZoom: 1.0,
      maxZoom: MAX_SAFE_ZOOM, // Strict Safety Layer: Clamps maximum zoom to 16.8z
      maxPitch: 65,
      pitch: 0,
      bearing: 0,
      antialias: true,
      fadeDuration: 100,
      maxTileCacheSize: 250,
      attributionControl: false,
      canvasContextAttributes: {
        alpha: true,
        antialias: true
      }
    });

    mapRef.current = map;
    window._map = map;
    setMapInstance(map);

    // Set initial projection to globe & enforce safety layer
    map.on('style.load', () => {
      try {
        map.setMaxZoom(MAX_SAFE_ZOOM);
        map.setProjection({ type: projectionRef.current });
        map.setSky({
          'sky-color': 'rgba(0,0,0,0)',
          'horizon-color': 'rgba(0,0,0,0)'
        });
      } catch (e) {
        console.warn('MapLibre projection setup:', e);
      }
    });

    // Dynamic Zoom Safety Guard: Active hard clamp at 16.8z
    map.on('zoom', () => {
      const z = map.getZoom();
      if (z > MAX_SAFE_ZOOM) {
        map.setZoom(MAX_SAFE_ZOOM);
      }
    });

    // Navigation Controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');

    // Telemetry updates
    map.on('move', () => {
      const center = map.getCenter();
      const currentZoom = parseFloat(map.getZoom().toFixed(1));
      setTelemetry((prev) => ({
        ...prev,
        lat: parseFloat(center.lat.toFixed(4)),
        lng: parseFloat(center.lng.toFixed(4)),
        zoom: currentZoom,
        pitch: Math.round(map.getPitch()),
        bearing: Math.round(map.getBearing()),
        status: currentZoom >= 16.5
          ? 'Sub-Meter Limit (16.8z Clamped)'
          : currentZoom > 8
            ? 'Sub-Meter Inspection'
            : 'Satellite Orbit Overview',
      }));
    });

    map.on('load', () => {
      map.setMaxZoom(MAX_SAFE_ZOOM);
      // Start initial auto-rotation (clean globe without static hardcoded dots)
      rotateGlobe();
    });

    // Interaction listeners to pause auto-rotation
    const stopRotation = () => { isRotatingRef.current = false; };
    map.on('mousedown', stopRotation);
    map.on('zoomstart', stopRotation);
    map.on('rotatestart', stopRotation);
    map.on('dragstart', stopRotation);
    map.on('pitchstart', stopRotation);

    map.on('click', (e) => {
      if (taskSwathModeRef.current) {
        handleExecuteSwathTask(e.lngLat.lat, e.lngLat.lng);
      }
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (searchMarkerRef.current) searchMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []); // Run ONCE on mount — NEVER destroy and re-create map on state updates

  // Dedicated Fly-To when explicitly requested
  const flyToScene = (scene) => {
    const map = mapRef.current;
    if (!map || !scene) return;

    const fp = sceneFootprints[scene.id];
    const center = fp ? fp.center : (scene.center ? [scene.center.lon, scene.center.lat] : null);
    if (!center) return;

    setCustomTargetLabel(null);
    isRotatingRef.current = false;
    map.flyTo({
      center: center,
      zoom: Math.min(13.5, MAX_SAFE_ZOOM),
      pitch: projectionRef.current === 'globe' ? 40 : 0,
      bearing: -12,
      duration: 2200,
      essential: true,
    });

    Object.keys(sceneFootprints).forEach((id) => {
      const isActive = id === scene.id;
      try {
        map.setPaintProperty(`footprint-fill-${id}`, 'fill-opacity', isActive ? 0.28 : 0.05);
        map.setPaintProperty(`footprint-line-${id}`, 'line-width', isActive ? 3.0 : 1.5);
        map.setPaintProperty(`footprint-line-${id}`, 'line-opacity', isActive ? 1.0 : 0.4);
      } catch (_) {}
    });
  };

  // Dedicated Fly-To for Searched Places
  const flyToSearchResult = (place) => {
    const map = mapRef.current;
    if (!map || !place || !place.coordinates) return;

    const [lng, lat] = place.coordinates;
    isRotatingRef.current = false;
    setIsSearchOpen(false);
    setSearchQuery(place.name);
    setCustomTargetLabel(place.name.toUpperCase());

    // Drop temporary tactical search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    const el = document.createElement('div');
    el.style.cssText = `
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; position: relative;
    `;
    const pulse = document.createElement('div');
    pulse.className = 'target-beacon-pulse';
    pulse.style.cssText = `
      position: absolute; width: 30px; height: 30px;
      border: 2px solid #38bdf8; border-radius: 50% !important;
      pointer-events: none;
    `;
    const core = document.createElement('div');
    core.style.cssText = `
      width: 12px; height: 12px;
      background-color: #38bdf8; border: 2px solid #ffffff;
      border-radius: 50% !important; box-shadow: 0 0 12px #38bdf8;
    `;
    el.appendChild(pulse);
    el.appendChild(core);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .setPopup(
        new maplibregl.Popup({ offset: 16 })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:6px;min-width:150px">
              <div style="font-weight:700;font-size:12px;color:#fafafa;margin-bottom:2px">${place.name}</div>
              <div style="color:#38bdf8;font-size:11px;font-family:'JetBrains Mono',monospace">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
              <div style="color:#a1a1aa;font-size:10px;margin-top:2px">${place.description || 'Target Coordinates'}</div>
            </div>
          `)
      )
      .addTo(map);

    marker.togglePopup();
    searchMarkerRef.current = marker;

    // Fly to location (respecting the 16.8z max zoom safety layer)
    const targetZoom = Math.min(place.zoom || 13.5, MAX_SAFE_ZOOM);
    map.flyTo({
      center: [lng, lat],
      zoom: targetZoom,
      pitch: projectionRef.current === 'globe' ? 45 : 0,
      bearing: -12,
      duration: 2500,
      essential: true,
    });
  };

  // Search Input Handler (Debounced geocoding query)
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (!val.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    setIsSearchOpen(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      // Check if user entered coordinates like "23.033, 72.585"
      const coordMatch = val.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[3]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setSearchResults([{
            name: `Coordinates (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
            description: 'Custom Geodetic Lat/Lon Target',
            coordinates: [lng, lat],
            zoom: 14.0
          }]);
          return;
        }
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error('Geocode search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 220);
  };

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        flyToSearchResult(searchResults[0]);
        return;
      }
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
          if (res.ok) {
            const data = await res.json();
            if (data.results?.length > 0) {
              flyToSearchResult(data.results[0]);
            }
          }
        } catch (err) {
          console.error('Direct geocode error:', err);
        } finally {
          setIsSearching(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
    setCustomTargetLabel(null);
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
  };

  // Update footprint highlight when activeScene changes (without flying)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeScene) return;
    Object.keys(sceneFootprints).forEach((id) => {
      const isActive = id === activeScene.id;
      try {
        map.setPaintProperty(`footprint-fill-${id}`, 'fill-opacity', isActive ? 0.28 : 0.05);
        map.setPaintProperty(`footprint-line-${id}`, 'line-width', isActive ? 3.0 : 1.5);
        map.setPaintProperty(`footprint-line-${id}`, 'line-opacity', isActive ? 1.0 : 0.4);
      } catch (_) {}
    });
  }, [activeScene, sceneFootprints]);

  // Switch Projection between 3D Globe and 2D Mercator Flat Map cleanly in-place
  const switchProjection = (newProj) => {
    const map = mapRef.current;
    if (!map || projectionRef.current === newProj) return;

    try {
      projectionRef.current = newProj;
      map.setProjection({ type: newProj });
      setProjection(newProj);
      setTelemetry(prev => ({ ...prev, projection: newProj }));

      if (newProj === 'mercator') {
        isRotatingRef.current = false;
        // In 2D mode, automatically display the cartographic Street Map style
        changeBasemap('streets');
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      } else {
        isRotatingRef.current = true;
        // In 3D Globe mode, display satellite imagery on the 3D sphere
        changeBasemap('imagery');
        rotateGlobe();
      }
    } catch (err) {
      console.error('Error switching projection:', err);
    }
  };

  // Change Basemap Style: 'imagery' (Satellite) or 'streets' (Cartographic Map)
  const changeBasemap = (type) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemapType(type);

    if (type === 'streets') {
      if (map.getLayer('esri-streets-layer')) map.setLayoutProperty('esri-streets-layer', 'visibility', 'visible');
      if (map.getLayer('esri-imagery-layer')) map.setLayoutProperty('esri-imagery-layer', 'visibility', 'none');
    } else {
      if (map.getLayer('esri-streets-layer')) map.setLayoutProperty('esri-streets-layer', 'visibility', 'none');
      if (map.getLayer('esri-imagery-layer')) map.setLayoutProperty('esri-imagery-layer', 'visibility', 'visible');
    }
  };

  // Reset Orientation (North + Zero Pitch)
  const resetOrientation = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
  };

  // Reset to Global Orbit
  const resetToGlobalView = () => {
    const map = mapRef.current;
    if (!map) return;
    isRotatingRef.current = projectionRef.current === 'globe';
    map.flyTo({
      center: [78.9629, 20.5937],
      zoom: 2.0,
      pitch: 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
    if (projectionRef.current === 'globe') {
      setTimeout(() => rotateGlobe(), 2000);
    }
  };

  // Toggle boundary and place labels
  const toggleLabels = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !showLabels;
    setShowLabels(next);
    if (map.getLayer('esri-boundaries-layer')) {
      map.setLayoutProperty('esri-boundaries-layer', 'visibility', next ? 'visible' : 'none');
    }
  };

  const sceneLabel = (id, scene) => {
    if (id.includes('ahmedabad_bitemporal')) return 'Ahmedabad (Bi-Temp)';
    if (id.includes('assam')) return 'Assam Flood (Opt+SAR)';
    if (id.includes('ahmedabad_single_baseline')) return 'Ahmedabad Baseline';
    if (id.startsWith('swath_')) {
      return scene?.location ? `Tasked: ${scene.location.split(',')[0]}` : 'Tasked Swath';
    }
    return scene?.location ? scene.location.split(',')[0] : 'Scene';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#040407', overflow: 'hidden' }}>
      {/* ── Deep Space Starfield behind 3D Earth Globe ── */}
      <Starfield active={projection === 'globe'} />

      {/* ── Realistic Atmosphere & Frontal-Sun Depth Shading Overlay ── */}
      <AtmosphereOverlay map={mapInstance} projection={projection} />

      {/* ── Native 3D Globe & 2D Map Container ── */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />

      {/* ── Top-Left: Geodetic Telemetry HUD ── */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(18, 18, 22, 0.94)', backdropFilter: 'blur(16px)',
          border: '1px solid #27272a', borderRadius: 8, padding: hudCollapsed ? '6px 12px' : '10px 14px',
          minWidth: hudCollapsed ? 'auto' : 220, maxWidth: 280, pointerEvents: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          transition: 'all 0.2s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: hudCollapsed ? 0 : 8,
            borderBottom: hudCollapsed ? 'none' : '1px solid rgba(39,39,42,0.6)',
            paddingBottom: hudCollapsed ? 0 : 6,
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: projection === 'globe' ? '#22c55e' : '#3b82f6', boxShadow: `0 0 8px ${projection === 'globe' ? '#22c55e' : '#3b82f6'}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fafafa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {hudCollapsed ? `${telemetry.lat}°N, ${telemetry.lng}°E` : (projection === 'globe' ? '3D Earth' : '2D Map')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 8, padding: '2px 5px', borderRadius: 3,
                color: projection === 'globe' ? '#22c55e' : '#3b82f6',
                border: `1px solid ${projection === 'globe' ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.4)'}`,
                background: projection === 'globe' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              }}>
                {projection === 'globe' ? '3D' : '2D'}
              </span>
              <button
                onClick={() => setHudCollapsed(prev => !prev)}
                title={hudCollapsed ? "Expand telemetry HUD" : "Collapse telemetry HUD"}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#71717a', padding: '1px 2px', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
              >
                {hudCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
            </div>
          </div>

          {!hudCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#71717a' }}>TARGET</span>
                <span style={{ color: customTargetLabel ? '#38bdf8' : '#fafafa', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customTargetLabel || activeScene?.location?.split(',')[0]?.toUpperCase() || 'ORBITING...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#71717a' }}>COORDS</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{telemetry.lat}°N, {telemetry.lng}°E</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#71717a' }}>ZOOM / PITCH</span>
                <span style={{ color: '#fafafa' }}>{telemetry.zoom}z · {telemetry.pitch}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#71717a' }}>BEARING</span>
                <span style={{ color: '#22c55e' }}>{telemetry.bearing}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#71717a' }}>CRS / GSD</span>
                <span style={{ color: '#a1a1aa' }}>{activeScene?.crs || 'EPSG:32643'} · {activeScene?.gsd || '0.65m'}</span>
              </div>

              {/* Safety Layer Active Indicator */}
              {telemetry.zoom >= 16.5 && (
                <div style={{
                  marginTop: 3, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)',
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#22c55e',
                  fontWeight: 600
                }}>
                  <Shield size={10} color="#22c55e" />
                  <span>MAX ZOOM CLAMPED (16.8z SAFE)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Top-Right: 3D Globe / 2D Map Switcher & Layer Tools ── */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* 3D Globe / 2D Map Mode Switcher */}
        <div style={{
          display: 'flex', background: 'rgba(18, 18, 22, 0.95)',
          border: '1px solid #27272a', borderRadius: 6, backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', padding: 3, gap: 3,
        }}>
          <button
            onClick={() => switchProjection('globe')}
            title="Switch to Real 3D Spherical Earth Globe"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 4,
              fontSize: 11, fontWeight: projection === 'globe' ? 700 : 500,
              fontFamily: "'Inter', sans-serif",
              color: projection === 'globe' ? '#22c55e' : '#a1a1aa',
              background: projection === 'globe' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
              border: `1px solid ${projection === 'globe' ? '#22c55e' : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Globe size={13} color={projection === 'globe' ? '#22c55e' : '#71717a'} />
            3D Globe
          </button>

          <button
            onClick={() => switchProjection('mercator')}
            title="Switch to 2D Planar Map (Mercator)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 4,
              fontSize: 11, fontWeight: projection === 'mercator' ? 700 : 500,
              fontFamily: "'Inter', sans-serif",
              color: projection === 'mercator' ? '#38bdf8' : '#a1a1aa',
              background: projection === 'mercator' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: `1px solid ${projection === 'mercator' ? '#38bdf8' : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Map size={13} color={projection === 'mercator' ? '#38bdf8' : '#71717a'} />
            2D Map
          </button>
        </div>

        {/* In 2D Map mode: Basemap Selector (Satellite Imagery vs Cartographic Street Map) */}
        {projection === 'mercator' && (
          <div style={{
            display: 'flex', background: 'rgba(18, 18, 22, 0.95)',
            border: '1px solid #27272a', borderRadius: 6, backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', padding: 3, gap: 3,
          }}>
            <button
              onClick={() => changeBasemap('streets')}
              title="Cartographic Street & Border Map (Vector/Roads)"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 4,
                fontSize: 11, fontWeight: basemapType === 'streets' ? 700 : 500,
                fontFamily: "'Inter', sans-serif",
                color: basemapType === 'streets' ? '#38bdf8' : '#a1a1aa',
                background: basemapType === 'streets' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border: `1px solid ${basemapType === 'streets' ? '#38bdf8' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Map size={12} color={basemapType === 'streets' ? '#38bdf8' : '#71717a'} />
              Street Map
            </button>
            <button
              onClick={() => changeBasemap('imagery')}
              title="High-Resolution Satellite Imagery"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 4,
                fontSize: 11, fontWeight: basemapType === 'imagery' ? 700 : 500,
                fontFamily: "'Inter', sans-serif",
                color: basemapType === 'imagery' ? '#22c55e' : '#a1a1aa',
                background: basemapType === 'imagery' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                border: `1px solid ${basemapType === 'imagery' ? '#22c55e' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Globe size={12} color={basemapType === 'imagery' ? '#22c55e' : '#71717a'} />
              Satellite
            </button>
          </div>
        )}

        {/* Labels Toggle */}
        <button
          onClick={toggleLabels}
          title="Toggle Country/City/State Place Names"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 11px', borderRadius: 6,
            background: 'rgba(18, 18, 22, 0.92)',
            border: '1px solid #27272a', backdropFilter: 'blur(12px)',
            fontSize: 11, fontFamily: "'Inter', sans-serif",
            color: showLabels ? '#fafafa' : '#71717a', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {showLabels ? <Eye size={12} color="#22c55e" /> : <EyeOff size={12} color="#71717a" />}
          Labels
        </button>

        {/* Swath Tasking Mode Toggle */}
        <button
          onClick={() => setTaskSwathMode(prev => !prev)}
          title="Click-to-Task On-Demand Sentinel-2 Swath (Year Selection)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 6,
            background: taskSwathMode ? 'rgba(0, 240, 255, 0.15)' : 'rgba(18, 18, 22, 0.92)',
            border: `1px solid ${taskSwathMode ? '#00F0FF' : '#27272a'}`,
            color: taskSwathMode ? '#00F0FF' : '#fafafa',
            fontSize: 11, fontFamily: "'Inter', sans-serif",
            fontWeight: taskSwathMode ? 700 : 500,
            cursor: 'pointer',
            boxShadow: taskSwathMode ? '0 0 16px rgba(0,240,255,0.3)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Crosshair size={13} color={taskSwathMode ? '#00F0FF' : '#71717a'} />
          <span>Task Swath</span>
        </button>

        {/* Reset Orientation */}
        <button
          onClick={resetOrientation}
          title="Reset North Orientation & Pitch"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 10px', borderRadius: 6,
            background: 'rgba(18, 18, 22, 0.92)',
            border: '1px solid #27272a', backdropFilter: 'blur(12px)',
            fontSize: 11, fontFamily: "'Inter', sans-serif",
            color: '#fafafa', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Compass size={13} color="#a1a1aa" />
        </button>

        {/* Reset to Global View */}
        <button
          onClick={resetToGlobalView}
          title="Reset to Full Planetary Overview"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 10px', borderRadius: 6,
            background: 'rgba(18, 18, 22, 0.92)',
            border: '1px solid #27272a', backdropFilter: 'blur(12px)',
            fontSize: 11, fontFamily: "'Inter', sans-serif",
            color: '#fafafa', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <RotateCcw size={13} color="#38bdf8" />
        </button>
      </div>

      {/* ── Tactical Swath Tasking Control Bar (Dynamic Sentinel-2 Tasking) ── */}
      {taskSwathMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 62, right: 16, zIndex: 25,
            background: 'rgba(15, 15, 20, 0.98)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 240, 255, 0.6)', borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,240,255,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 11,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00F0FF', fontWeight: 700, fontSize: 11 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00F0FF', boxShadow: '0 0 8px #00F0FF' }} />
            <span>SENTINEL-2 TASKING</span>
          </div>

          <div style={{ height: 18, width: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* T1 Baseline Year */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid #27272a' }}>
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>T1:</span>
            <select
              value={t1Year}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setT1Year(v);
                t1YearRef.current = v;
              }}
              style={{
                background: '#121215', color: '#22c55e', border: '1px solid #3f3f46', borderRadius: 3,
                padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', outline: 'none'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <span style={{ color: '#52525b', fontWeight: 700 }}>⟷</span>

          {/* T2 Recent Year */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid #27272a' }}>
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>T2:</span>
            <select
              value={t2Year}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setT2Year(v);
                t2YearRef.current = v;
              }}
              style={{
                background: '#121215', color: '#38bdf8', border: '1px solid #3f3f46', borderRadius: 3,
                padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', outline: 'none'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Season / Period Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid #27272a' }}>
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>SEASON:</span>
            <select
              value={season}
              onChange={(e) => {
                const v = e.target.value;
                setSeason(v);
                seasonRef.current = v;
              }}
              style={{
                background: '#121215', color: '#f59e0b', border: '1px solid #3f3f46', borderRadius: 3,
                padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', outline: 'none'
              }}
            >
              <option value="any">Full Year</option>
              <option value="q1">Q1 (Jan–Mar)</option>
              <option value="q2">Q2 (Apr–Jun)</option>
              <option value="q3">Q3 (Jul–Sep)</option>
              <option value="q4">Q4 (Oct–Dec)</option>
            </select>
          </div>

          {/* Max Cloud Cover Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid #27272a' }}>
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>CLOUD:</span>
            <select
              value={maxCloud}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMaxCloud(v);
                maxCloudRef.current = v;
              }}
              style={{
                background: '#121215', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: 3,
                padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', outline: 'none'
              }}
            >
              <option value="10">&lt;10%</option>
              <option value="20">&lt;20%</option>
              <option value="35">&lt;35%</option>
              <option value="50">&lt;50%</option>
            </select>
          </div>

          {/* AOI Radius */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4, border: '1px solid #27272a' }}>
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>RADIUS:</span>
            <select
              value={radiusKm}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setRadiusKm(v);
                radiusKmRef.current = v;
              }}
              style={{
                background: '#121215', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 3,
                padding: '3px 6px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', outline: 'none'
              }}
            >
              <option value="0.5">0.5 km</option>
              <option value="1.0">1.0 km</option>
              <option value="1.5">1.5 km</option>
              <option value="2.0">2.0 km</option>
              <option value="3.0">3.0 km</option>
              <option value="5.0">5.0 km</option>
              <option value="10.0">10 km</option>
            </select>
          </div>

          <div style={{ height: 18, width: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* Direct Task Center Button */}
          <button
            onClick={() => {
              if (telemetry.lat && telemetry.lng) {
                handleExecuteSwathTask(telemetry.lat, telemetry.lng);
              }
            }}
            disabled={isTasking}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 4,
              background: isTasking ? 'rgba(39,39,42,0.6)' : 'rgba(0, 240, 255, 0.15)',
              border: `1px solid ${isTasking ? '#3f3f46' : '#00F0FF'}`,
              color: isTasking ? '#71717a' : '#00F0FF',
              fontSize: 11, fontWeight: 700, cursor: isTasking ? 'default' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              boxShadow: isTasking ? 'none' : '0 0 12px rgba(0,240,255,0.25)',
              transition: 'all 0.15s ease',
            }}
            title="Task swath at current map center coordinates"
          >
            <span>🚀 Task Center ({telemetry.lat.toFixed(2)}°, {telemetry.lng.toFixed(2)}°)</span>
          </button>

          {/* Status or Instruction */}
          {isTasking ? (
            <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
              <span>STREAMING SENTINEL-2 COGs...</span>
            </div>
          ) : (
            <span style={{ color: '#71717a', fontSize: 10, fontStyle: 'italic' }}>
              or click globe
            </span>
          )}
        </div>
      )}

      {/* ── Search Bar: Geospatial Place & Facility Finder ── */}
      <div style={{ position: 'absolute', top: taskSwathMode ? 114 : 66, right: 16, zIndex: 20, width: 330, transition: 'top 0.2s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(18, 18, 22, 0.95)', backdropFilter: 'blur(16px)',
          border: `1px solid ${isSearchOpen ? '#22c55e' : '#27272a'}`,
          borderRadius: 6,
          padding: '5px 11px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.2s ease',
        }}>
          <button
            onClick={() => { if (searchResults.length > 0) flyToSearchResult(searchResults[0]); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            title="Execute search"
          >
            <Search size={14} color={isSearching ? '#38bdf8' : '#71717a'} className={isSearching ? 'animate-pulse' : ''} />
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchResults.length > 0) setIsSearchOpen(true); }}
            placeholder="Search place, city, or lat,lon..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fafafa', fontSize: 11, fontFamily: "'Inter', sans-serif",
            }}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              title="Clear search"
            >
              <X size={12} color="#71717a" />
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {isSearchOpen && searchResults.length > 0 && (
          <div style={{
            marginTop: 6, background: 'rgba(18, 18, 22, 0.98)', backdropFilter: 'blur(20px)',
            border: '1px solid #27272a', borderRadius: 6, maxHeight: 260, overflowY: 'auto',
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column',
          }}>
            {searchResults.map((place, i) => (
              <div
                key={i}
                data-search-item="true"
                onClick={() => flyToSearchResult(place)}
                style={{
                  padding: '8px 12px', borderBottom: '1px solid rgba(39,39,42,0.4)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', paddingRight: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={12} color="#22c55e" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#fafafa', fontFamily: "'Inter', sans-serif" }}>
                      {place.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#a1a1aa', paddingLeft: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {place.description}
                  </span>
                </div>
                <span style={{
                  fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.08)', padding: '2px 5px', border: '1px solid rgba(56,189,248,0.2)',
                  whiteSpace: 'nowrap'
                }}>
                  {place.coordinates[1].toFixed(2)}°, {place.coordinates[0].toFixed(2)}°
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
  );
}
