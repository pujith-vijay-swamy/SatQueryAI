# SatQuery AI — Phase 2 LoRA Weights Drop-In Directory

This directory is monitored by the SatQuery AI backend runtime (`backend/core/config.py` and `backend/services/vqa_service.py`).

## Instructions for Phase 2 Deployment:
1. Run `python finetune/lora_bigearthnet.py` on Google Colab or locally.
2. Download the resulting `adapter_model.safetensors` and `adapter_config.json`.
3. Drop them into this directory (`finetune/weights/`).
4. The SatQuery AI backend automatically detects the weights, switching the agentic router's model identifier from `Phase 1 Adapter Slot: UNLOADED` to `GeoChat-7B (BigEarthNet LoRA Adapter: ACTIVE)` without requiring a server reboot!
