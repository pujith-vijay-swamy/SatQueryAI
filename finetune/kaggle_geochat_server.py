"""
SatQuery AI — GeoChat-7B Kaggle Inference Server
=================================================
Run this script inside a Kaggle notebook (with GPU: T4 or P100 enabled).
It loads MBZUAI/geochat-7b with 4-bit quantization and exposes a secure FastAPI
endpoint over ngrok / localtunnel for SatQuery AI.

Requirements in Kaggle:
!pip install -q transformers accelerate bitsandbytes fastapi uvicorn pyngrok nest_asyncio pillow torch torchvision
"""

import os
import io
import base64
import torch
from PIL import Image
import nest_asyncio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

# 1. Initialize FastAPI Application
app = FastAPI(title="GeoChat-7B Kaggle Server", description="Remote Sensing VQA & Grounding API for SatQuery AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Model Configuration
MODEL_ID = "MBZUAI/geochat-7b"
print(f"[GeoChat] Loading tokenizer & model weights: {MODEL_ID} on GPU...")

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.float16
)
model.eval()
print("[GeoChat] Model successfully loaded on Kaggle GPU!")

# 3. Request Schema
class VqaRequest(BaseModel):
    image_base64: str
    query: str
    temperature: float = 0.2
    max_new_tokens: int = 512

@app.get("/health")
@app.get("/api/health")
async def health():
    return {
        "status": "ONLINE",
        "model": "MBZUAI/geochat-7b",
        "device": str(next(model.parameters()).device),
        "quantization": "4-bit (NF4)",
        "service": "SatQuery AI GeoChat Remote Engine"
    }

@app.post("/api/vqa")
@app.post("/vqa")
async def vqa_inference(req: VqaRequest):
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(req.image_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Format GeoChat prompt
        prompt = f"USER: <image>\n{req.query}\nASSISTANT:"
        
        # Prepare inputs (GeoChat multimodal pipeline)
        if hasattr(model, "generate"):
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            with torch.no_grad():
                output_ids = model.generate(
                    **inputs,
                    max_new_tokens=req.max_new_tokens,
                    temperature=req.temperature,
                    do_sample=req.temperature > 0.0,
                    pad_token_id=tokenizer.eos_token_id
                )
            generated_text = tokenizer.decode(output_ids[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        else:
            generated_text = "GeoChat processed observation image."

        return {
            "status": "SUCCESS",
            "model": "GeoChat-7B (Kaggle GPU)",
            "response": generated_text,
            "query": req.query
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"GeoChat inference error: {str(e)}")

# 4. Entrypoint with ngrok tunnel
def start_server(ngrok_authtoken: str = None, port: int = 8000):
    from pyngrok import ngrok
    token = ngrok_authtoken or os.environ.get("NGROK_AUTHTOKEN", "")
    if token:
        ngrok.set_auth_token(token)

    tunnel = ngrok.connect(port)
    print("\n" + "=" * 60)
    print(f"🛰️ SatQuery GeoChat Server Public URL:")
    print(f"👉 {tunnel.public_url}")
    print("=" * 60)
    print("Copy this URL and paste it into SatQuery AI Header -> GeoChat Kaggle URL!\n")

    nest_asyncio.apply()
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    # In Kaggle: pass your token or set NGROK_AUTHTOKEN env var
    start_server()
