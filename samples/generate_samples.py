"""
SatQuery AI — Synthetic Satellite GeoTIFF Generator
Generates realistic georeferenced GeoTIFFs for:
1. Ahmedabad Urban Corridor (Bi-Temporal Cartosat-2S, EPSG:32643)
2. Assam Brahmaputra Flood Inundation (Optical + C-Band SAR RISAT-1, EPSG:32644)
"""

import os
import math
import numpy as np
import rasterio
from rasterio.transform import from_origin
from PIL import Image

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def generate_ahmedabad_pair():
    out_dir = os.path.join(os.path.dirname(__file__), "ahmedabad")
    ensure_dir(out_dir)
    
    # Dimensions: 512x512 pixels
    # Resolution: 0.65m per pixel (Cartosat-2S)
    # Total ground coverage ~ 332.8m x 332.8m
    # UTM 43N Coordinates for Ahmedabad (~ 271000m E, 2550000m N)
    width, height = 512, 512
    res = 0.65
    west, north = 271000.0, 2550000.0
    transform = from_origin(west, north, res, res)
    crs = "EPSG:32643"
    
    # Full 2D coordinate meshgrids
    y, x = np.mgrid[:height, :width]
    
    # Base terrain: River Sabarmati flowing diagonally
    river_path = 0.4 * x + 100
    river_mask = np.abs(y - river_path) < 38
    
    # T1 (2021): Urban baseline with open agricultural / fallow land
    np.random.seed(42)
    t1 = np.zeros((height, width, 3), dtype=np.uint16)
    
    # Background terrain (fallow / vegetation): moderate green-brown
    noise = np.random.normal(0, 1500, (height, width))
    t1[:, :, 0] = np.clip(14000 + noise, 0, 65535) # Red
    t1[:, :, 1] = np.clip(18000 + noise, 0, 65535) # Green
    t1[:, :, 2] = np.clip(11000 + noise, 0, 65535) # Blue
    
    # Old urban fabric on the west bank
    urban_t1 = (x < 180) & (~river_mask)
    t1[urban_t1, 0] = np.clip(t1[urban_t1, 0] + 12000, 0, 65535)
    t1[urban_t1, 1] = np.clip(t1[urban_t1, 1] + 11000, 0, 65535)
    t1[urban_t1, 2] = np.clip(t1[urban_t1, 2] + 10000, 0, 65535)
    
    # Existing road
    road1 = np.abs(y - 250) < 6
    t1[road1, 0] = 32000
    t1[road1, 1] = 32000
    t1[road1, 2] = 32000
    
    # Water: River Sabarmati (deep absorption in NIR/R, lower reflectance)
    t1[river_mask, 0] = 4200
    t1[river_mask, 1] = 6800
    t1[river_mask, 2] = 11200
    
    # T2 (2024): New ring road transit corridor + rapid built-up industrial expansion
    t2 = t1.copy()
    
    # New transit corridor: diagonal highway
    highway = (np.abs((y - 0.7 * x - 80)) < 12) & (~river_mask)
    t2[highway, 0] = 38000
    t2[highway, 1] = 37000
    t2[highway, 2] = 36000
    
    # New built-up commercial / industrial complexes on east side
    new_complexes = (
        ((x > 260) & (x < 360) & (y > 100) & (y < 220)) |
        ((x > 330) & (x < 440) & (y > 270) & (y < 410)) |
        ((x > 210) & (x < 280) & (y > 340) & (y < 420))
    ) & (~river_mask)
    
    t2[new_complexes, 0] = np.clip(t2[new_complexes, 0] + 19000, 0, 65535)
    t2[new_complexes, 1] = np.clip(t2[new_complexes, 1] + 17500, 0, 65535)
    t2[new_complexes, 2] = np.clip(t2[new_complexes, 2] + 16000, 0, 65535)
    
    # Save T1 GeoTIFF
    t1_path = os.path.join(out_dir, "t1_cartosat_2021.tif")
    with rasterio.open(
        t1_path, 'w',
        driver='GTiff',
        height=height, width=width, count=3,
        dtype=rasterio.uint16,
        crs=crs,
        transform=transform
    ) as dst:
        for i in range(3):
            dst.write(t1[:, :, i], i + 1)
            
    # Save T2 GeoTIFF
    t2_path = os.path.join(out_dir, "t2_cartosat_2024.tif")
    with rasterio.open(
        t2_path, 'w',
        driver='GTiff',
        height=height, width=width, count=3,
        dtype=rasterio.uint16,
        crs=crs,
        transform=transform
    ) as dst:
        for i in range(3):
            dst.write(t2[:, :, i], i + 1)
            
    # Save 8-bit web previews
    def save_preview(arr16, path):
        # 2% to 98% percentile stretch
        p2, p98 = np.percentile(arr16, (2, 98))
        norm = np.clip((arr16 - p2) / (p98 - p2 + 1e-5) * 255.0, 0, 255).astype(np.uint8)
        img = Image.fromarray(norm)
        img.save(path)
        
    save_preview(t1, os.path.join(out_dir, "t1_cartosat_2021.png"))
    save_preview(t2, os.path.join(out_dir, "t2_cartosat_2024.png"))
    print(f"[OK] Generated Ahmedabad Bi-Temporal Pair in {out_dir}")

def generate_assam_pair():
    out_dir = os.path.join(os.path.dirname(__file__), "assam")
    ensure_dir(out_dir)
    
    # Dimensions: 512x512 pixels
    # Optical resolution: ~1.0m, SAR resolution: ~3.0m
    # UTM 44N Coordinates for Assam (~ 490000m E, 2900000m N)
    width, height = 512, 512
    res = 1.0
    west, north = 490000.0, 2900000.0
    transform = from_origin(west, north, res, res)
    crs = "EPSG:32644"
    
    y, x = np.mgrid[:height, :width]
    np.random.seed(99)
    
    # 1. OPTICAL SCENE:
    # Heavy monsoonal cloud occlusion over Brahmaputra river basin
    optical = np.zeros((height, width, 3), dtype=np.uint16)
    
    # Base terrain: lush vegetation (high green/NIR)
    veg_noise = np.random.normal(0, 1200, (height, width))
    optical[:, :, 0] = np.clip(11000 + veg_noise, 0, 65535) # Red
    optical[:, :, 1] = np.clip(24000 + veg_noise, 0, 65535) # Green
    optical[:, :, 2] = np.clip(13000 + veg_noise, 0, 65535) # Blue
    
    # Brahmaputra river main braided channel
    river_ch = (y > 200 + 40 * np.sin(x / 45.0)) & (y < 280 + 35 * np.sin(x / 40.0))
    optical[river_ch, 0] = 5000
    optical[river_ch, 1] = 9000
    optical[river_ch, 2] = 16000
    
    # Clouds (dense white puffs with drop shadows)
    cloud_dist1 = np.sqrt((x - 220)**2 + (y - 180)**2)
    cloud_dist2 = np.sqrt((x - 380)**2 + (y - 270)**2)
    cloud_dist3 = np.sqrt((x - 140)**2 + (y - 340)**2)
    clouds = (cloud_dist1 < 110) | (cloud_dist2 < 130) | (cloud_dist3 < 95)
    
    optical[clouds, 0] = 58000
    optical[clouds, 1] = 58000
    optical[clouds, 2] = 58000
    
    # Cloud shadows
    shadow_shift_x, shadow_shift_y = 25, 20
    shadows = (
        (np.sqrt((x - 220 - shadow_shift_x)**2 + (y - 180 - shadow_shift_y)**2) < 100) |
        (np.sqrt((x - 380 - shadow_shift_x)**2 + (y - 270 - shadow_shift_y)**2) < 120)
    ) & (~clouds)
    optical[shadows] = optical[shadows] // 3
    
    # 2. SAR SCENE (RISAT-1 / EOS-04 C-Band):
    # C-band radar penetrates clouds completely!
    # Water surfaces cause specular reflection (reflect radar away from sensor), appearing very dark.
    sar = np.zeros((height, width), dtype=np.uint16)
    
    # Base terrain: volume scattering with characteristic speckle noise (Rayleigh/Gamma distribution)
    speckle = np.random.gamma(shape=3.5, scale=4000.0, size=(height, width))
    sar = np.clip(speckle, 3000, 45000).astype(np.uint16)
    
    # Severe flood inundation extending far beyond normal river channel
    flood_mask = (
        ((y > 170 + 40 * np.sin(x / 45.0)) & (y < 350 + 50 * np.sin(x / 35.0))) |
        ((x > 80) & (x < 240) & (y > 330) & (y < 430))
    )
    
    # Specular water reflection in SAR: very low backscatter
    water_speckle = np.random.gamma(shape=1.5, scale=800.0, size=(height, width))
    sar[flood_mask] = np.clip(water_speckle[flood_mask], 500, 3200).astype(np.uint16)
    
    # Infrastructure: Flood embankments / highway bridges (high double-bounce)
    dyke = (np.abs(y - 165) < 3) & (x > 50) & (x < 450)
    sar[dyke] = 62000
    
    # Save Optical GeoTIFF
    opt_path = os.path.join(out_dir, "optical_sentinel_2024.tif")
    with rasterio.open(
        opt_path, 'w',
        driver='GTiff',
        height=height, width=width, count=3,
        dtype=rasterio.uint16,
        crs=crs,
        transform=transform
    ) as dst:
        for i in range(3):
            dst.write(optical[:, :, i], i + 1)
            
    # Save SAR GeoTIFF
    sar_path = os.path.join(out_dir, "sar_risat_2024.tif")
    with rasterio.open(
        sar_path, 'w',
        driver='GTiff',
        height=height, width=width, count=1,
        dtype=rasterio.uint16,
        crs=crs,
        transform=transform
    ) as dst:
        dst.write(sar, 1)
        
    # Save previews
    p2, p98 = np.percentile(optical, (2, 98))
    norm_opt = np.clip((optical - p2) / (p98 - p2 + 1e-5) * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(norm_opt).save(os.path.join(out_dir, "optical_sentinel_2024.png"))
    
    p2_s, p98_s = np.percentile(sar, (2, 98))
    norm_sar = np.clip((sar - p2_s) / (p98_s - p2_s + 1e-5) * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(norm_sar).save(os.path.join(out_dir, "sar_risat_2024.png"))
    print(f"[OK] Generated Assam Optical + SAR Pair in {out_dir}")

if __name__ == "__main__":
    generate_ahmedabad_pair()
    generate_assam_pair()
