# Running GeoChat-7B on Kaggle for SatQuery AI

Follow these quick steps to run the full **GeoChat-7B** Remote Sensing Vision-Language Model on a free Kaggle GPU (T4 / P100) and connect it to SatQuery AI:

---

## 1. Create a Kaggle Notebook
1. Go to [Kaggle](https://www.kaggle.com/) and click **Create → New Notebook**.
2. Under **Notebook settings** (right sidebar):
   - **Accelerator**: Select **GPU T4 x2** or **GPU P100**.
   - **Internet**: Toggle **Internet ON**.

---

## 2. Cell 1: Install Dependencies
```bash
!pip install -q transformers accelerate bitsandbytes fastapi uvicorn pyngrok nest_asyncio pillow torch torchvision
```

---

## 3. Cell 2: Run the Server
Paste the contents of `finetune/kaggle_geochat_server.py` or run:

```python
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
from pyngrok import ngrok

app = FastAPI(title="GeoChat-7B Kaggle Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "MBZUAI/geochat-7b"
print(f"Loading {MODEL_ID} in 4-bit...")

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

class VqaRequest(BaseModel):
    image_base64: str
    query: str
    temperature: float = 0.2
    max_new_tokens: int = 512

@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ONLINE", "model": "MBZUAI/geochat-7b"}

@app.post("/api/vqa")
@app.post("/vqa")
async def vqa_inference(req: VqaRequest):
    img_bytes = base64.b64decode(req.image_base64)
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    prompt = f"USER: <image>\n{req.query}\nASSISTANT:"
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
    return {"status": "SUCCESS", "model": "GeoChat-7B", "response": generated_text}

# Connect ngrok tunnel (add your auth token from https://dashboard.ngrok.com)
NGROK_AUTH = "YOUR_NGROK_AUTHTOKEN"  # Optional if token is saved
if NGROK_AUTH and NGROK_AUTH != "YOUR_NGROK_AUTHTOKEN":
    ngrok.set_auth_token(NGROK_AUTH)

tunnel = ngrok.connect(8000)
print(f"\n==========================================")
print(f"🛰️ GeoChat Server Public URL: {tunnel.public_url}")
print(f"==========================================\n")

nest_asyncio.apply()
uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 4. Connect to SatQuery AI
1. Copy the printed ngrok URL (e.g. `https://xxxx-xx-xx-xx.ngrok-free.app`).
2. In the SatQuery AI header, click **GeoChat Kaggle** and paste your URL into the endpoint field.
3. Click **Connect & Verify**.
4. You now have full 7-billion parameter Remote Sensing VQA directly connected into SatQuery AI!
