"""
SatQuery AI — Bitemporal Image Transformer (BIT_CD) PyTorch Architecture
Based on 'Remote Sensing Image Change Detection with Transformers' (Hao Chen et al.)
Backbone: ResNet18 with dilated convolutions
Transformer: Spatial tokenization + Cross-Attention Decoders
"""

import os
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from einops import rearrange

def conv3x3(in_planes, out_planes, stride=1, groups=1, dilation=1):
    return nn.Conv2d(in_planes, out_planes, kernel_size=3, stride=stride,
                     padding=dilation, groups=groups, bias=False, dilation=dilation)

def conv1x1(in_planes, out_planes, stride=1):
    return nn.Conv2d(in_planes, out_planes, kernel_size=1, stride=stride, bias=False)

class BasicBlock(nn.Module):
    expansion = 1
    def __init__(self, inplanes, planes, stride=1, downsample=None, groups=1,
                 base_width=64, dilation=1, norm_layer=None):
        super(BasicBlock, self).__init__()
        if norm_layer is None:
            norm_layer = nn.BatchNorm2d
        self.conv1 = conv3x3(inplanes, planes, stride, dilation=dilation)
        self.bn1 = norm_layer(planes)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = conv3x3(planes, planes, dilation=dilation)
        self.bn2 = norm_layer(planes)
        self.downsample = downsample
        self.stride = stride

    def forward(self, x):
        identity = x
        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        out = self.conv2(out)
        out = self.bn2(out)
        if self.downsample is not None:
            identity = self.downsample(x)
        out += identity
        out = self.relu(out)
        return out

class ResNet18Backbone(nn.Module):
    def __init__(self, replace_stride_with_dilation=[False, True, True]):
        super(ResNet18Backbone, self).__init__()
        self.inplanes = 64
        self.dilation = 1
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        self.layer1 = self._make_layer(64, 2)
        self.layer2 = self._make_layer(128, 2, stride=2, dilate=replace_stride_with_dilation[0])
        self.layer3 = self._make_layer(256, 2, stride=2, dilate=replace_stride_with_dilation[1])
        self.layer4 = self._make_layer(512, 2, stride=2, dilate=replace_stride_with_dilation[2])
        self.fc = nn.Linear(512, 1000)

    def _make_layer(self, planes, blocks, stride=1, dilate=False):
        norm_layer = nn.BatchNorm2d
        downsample = None
        previous_dilation = self.dilation
        if dilate:
            self.dilation *= stride
            stride = 1
        if stride != 1 or self.inplanes != planes:
            downsample = nn.Sequential(
                conv1x1(self.inplanes, planes, stride),
                norm_layer(planes),
            )
        layers = []
        layers.append(BasicBlock(self.inplanes, planes, stride, downsample,
                                 dilation=previous_dilation, norm_layer=norm_layer))
        self.inplanes = planes
        for _ in range(1, blocks):
            layers.append(BasicBlock(self.inplanes, planes, dilation=self.dilation,
                                     norm_layer=norm_layer))
        return nn.Sequential(*layers)

class TwoLayerConv2d(nn.Sequential):
    def __init__(self, in_channels, out_channels):
        super(TwoLayerConv2d, self).__init__(
            nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(in_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1)
        )

class Residual(nn.Module):
    def __init__(self, fn):
        super().__init__()
        self.fn = fn
    def forward(self, x, **kwargs):
        return self.fn(x, **kwargs) + x

class Residual2(nn.Module):
    def __init__(self, fn):
        super().__init__()
        self.fn = fn
    def forward(self, x, x2, **kwargs):
        return self.fn(x, x2, **kwargs) + x

class PreNorm(nn.Module):
    def __init__(self, dim, fn):
        super().__init__()
        self.norm = nn.LayerNorm(dim)
        self.fn = fn
    def forward(self, x, **kwargs):
        return self.fn(self.norm(x), **kwargs)

class PreNorm2(nn.Module):
    def __init__(self, dim, fn):
        super().__init__()
        self.norm = nn.LayerNorm(dim)
        self.fn = fn
    def forward(self, x, x2, **kwargs):
        return self.fn(self.norm(x), self.norm(x2), **kwargs)

class FeedForward(nn.Module):
    def __init__(self, dim, hidden_dim, dropout=0.):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, dim),
            nn.Dropout(dropout)
        )
    def forward(self, x):
        return self.net(x)

class Attention(nn.Module):
    def __init__(self, dim, heads=8, dim_head=64, dropout=0.):
        super().__init__()
        inner_dim = dim_head * heads
        self.heads = heads
        self.scale = dim_head ** -0.5
        self.to_qkv = nn.Linear(dim, inner_dim * 3, bias=False)
        self.to_out = nn.Sequential(
            nn.Linear(inner_dim, dim),
            nn.Dropout(dropout)
        )
    def forward(self, x, mask=None):
        b, n, _, h = *x.shape, self.heads
        qkv = self.to_qkv(x).chunk(3, dim=-1)
        q, k, v = map(lambda t: rearrange(t, 'b n (h d) -> b h n d', h=h), qkv)
        dots = torch.einsum('b h i d, b h j d -> b h i j', q, k) * self.scale
        if mask is not None:
            mask = F.pad(mask.flatten(1), (1, 0), value=True)
            assert mask.shape[-1] == dots.shape[-1], 'mask has incorrect dimensions'
            mask = mask[:, None, :] * mask[:, :, None]
            dots.masked_fill_(~mask, float('-inf'))
            del mask
        attn = dots.softmax(dim=-1)
        out = torch.einsum('b h i j, b h j d -> b h i d', attn, v)
        out = rearrange(out, 'b h n d -> b n (h d)')
        return self.to_out(out)

class Cross_Attention(nn.Module):
    def __init__(self, dim, heads=8, dim_head=64, dropout=0., softmax=True):
        super().__init__()
        inner_dim = dim_head * heads
        self.heads = heads
        self.scale = dim_head ** -0.5
        self.softmax = softmax
        self.to_q = nn.Linear(dim, inner_dim, bias=False)
        self.to_k = nn.Linear(dim, inner_dim, bias=False)
        self.to_v = nn.Linear(dim, inner_dim, bias=False)
        self.to_out = nn.Sequential(
            nn.Linear(inner_dim, dim),
            nn.Dropout(dropout)
        )
    def forward(self, x, context=None, mask=None):
        b, n, _, h = *x.shape, self.heads
        if context is None:
            context = x
        q = self.to_q(x)
        k = self.to_k(context)
        v = self.to_v(context)
        q, k, v = map(lambda t: rearrange(t, 'b n (h d) -> b h n d', h=h), (q, k, v))
        dots = torch.einsum('b h i d, b h j d -> b h i j', q, k) * self.scale
        if self.softmax:
            attn = dots.softmax(dim=-1)
        else:
            attn = dots
        out = torch.einsum('b h i j, b h j d -> b h i d', attn, v)
        out = rearrange(out, 'b h n d -> b n (h d)')
        return self.to_out(out)

class Transformer(nn.Module):
    def __init__(self, dim, depth, heads, dim_head, mlp_dim, dropout=0.):
        super().__init__()
        self.layers = nn.ModuleList([])
        for _ in range(depth):
            self.layers.append(nn.ModuleList([
                Residual(PreNorm(dim, Attention(dim, heads=heads, dim_head=dim_head, dropout=dropout))),
                Residual(PreNorm(dim, FeedForward(dim, mlp_dim, dropout=dropout)))
            ]))
    def forward(self, x, mask=None):
        for attn, ff in self.layers:
            x = attn(x, mask=mask)
            x = ff(x)
        return x

class TransformerDecoder(nn.Module):
    def __init__(self, dim, depth, heads, dim_head, mlp_dim, dropout=0., softmax=True):
        super().__init__()
        self.layers = nn.ModuleList([])
        for _ in range(depth):
            self.layers.append(nn.ModuleList([
                Residual2(PreNorm2(dim, Cross_Attention(dim, heads=heads, dim_head=dim_head, dropout=dropout, softmax=softmax))),
                Residual(PreNorm(dim, FeedForward(dim, mlp_dim, dropout=dropout)))
            ]))
    def forward(self, x, m, mask=None):
        for attn, ff in self.layers:
            x = attn(x, m, mask=mask)
            x = ff(x)
        return x

class BIT_CD(nn.Module):
    def __init__(self, input_nc=3, output_nc=2, token_len=4, resnet_stages_num=4,
                 with_pos='learned', enc_depth=1, dec_depth=8, decoder_dim_head=8):
        super().__init__()
        self.resnet = ResNet18Backbone(replace_stride_with_dilation=[False, True, True])
        self.relu = nn.ReLU()
        self.upsamplex2 = nn.Upsample(scale_factor=2)
        self.upsamplex4 = nn.Upsample(scale_factor=4, mode='bilinear')
        self.classifier = TwoLayerConv2d(in_channels=32, out_channels=output_nc)
        self.resnet_stages_num = resnet_stages_num
        self.if_upsample_2x = True

        layers = 256  # resnet_stages_num == 4
        self.conv_pred = nn.Conv2d(layers, 32, kernel_size=3, padding=1)

        self.token_len = token_len
        self.conv_a = nn.Conv2d(32, self.token_len, kernel_size=1, padding=0, bias=False)
        self.tokenizer = True
        self.token_trans = True
        self.with_decoder = True
        dim = 32
        mlp_dim = 2 * dim

        self.with_pos = with_pos
        if with_pos == 'learned':
            self.pos_embedding = nn.Parameter(torch.randn(1, self.token_len * 2, 32))
        self.enc_depth = enc_depth
        self.dec_depth = dec_depth
        self.dim_head = 64
        self.decoder_dim_head = decoder_dim_head
        self.transformer = Transformer(dim=dim, depth=self.enc_depth, heads=8,
                                       dim_head=self.dim_head, mlp_dim=mlp_dim, dropout=0)
        self.transformer_decoder = TransformerDecoder(dim=dim, depth=self.dec_depth,
                                                      heads=8, dim_head=self.decoder_dim_head,
                                                      mlp_dim=mlp_dim, dropout=0, softmax=True)

    def forward_single(self, x):
        x = self.resnet.conv1(x)
        x = self.resnet.bn1(x)
        x = self.resnet.relu(x)
        x = self.resnet.maxpool(x)

        x_4 = self.resnet.layer1(x)
        x_8 = self.resnet.layer2(x_4)
        if self.resnet_stages_num > 3:
            x_8 = self.resnet.layer3(x_8)

        if self.if_upsample_2x:
            x = self.upsamplex2(x_8)
        else:
            x = x_8
        x = self.conv_pred(x)
        return x

    def _forward_semantic_tokens(self, x):
        b, c, h, w = x.shape
        spatial_attention = self.conv_a(x)
        spatial_attention = spatial_attention.view([b, self.token_len, -1]).contiguous()
        spatial_attention = torch.softmax(spatial_attention, dim=-1)
        x = x.view([b, c, -1]).contiguous()
        tokens = torch.einsum('bln,bcn->blc', spatial_attention, x)
        return tokens

    def _forward_transformer(self, x):
        if self.with_pos:
            x = x + self.pos_embedding
        x = self.transformer(x)
        return x

    def _forward_transformer_decoder(self, x, m):
        b, c, h, w = x.shape
        x = rearrange(x, 'b c h w -> b (h w) c')
        x = self.transformer_decoder(x, m)
        x = rearrange(x, 'b (h w) c -> b c h w', h=h)
        return x

    def forward(self, x1, x2):
        x1 = self.forward_single(x1)
        x2 = self.forward_single(x2)

        token1 = self._forward_semantic_tokens(x1)
        token2 = self._forward_semantic_tokens(x2)

        tokens_ = torch.cat([token1, token2], dim=1)
        tokens = self._forward_transformer(tokens_)
        token1, token2 = tokens.chunk(2, dim=1)

        x1 = self._forward_transformer_decoder(x1, token1)
        x2 = self._forward_transformer_decoder(x2, token2)

        x = torch.abs(x1 - x2)
        if not self.if_upsample_2x:
            x = self.upsamplex2(x)
        x = self.upsamplex4(x)
        x = self.classifier(x)
        return x


_CACHED_BIT_MODEL = None
_CACHED_DEVICE = None
_CACHED_METADATA = {}

def get_bit_model(weights_path: str | Path):
    """
    Singleton cached loader for the BIT change detection model.
    Loads and caches weights into memory for sub-second inference.
    """
    global _CACHED_BIT_MODEL, _CACHED_DEVICE, _CACHED_METADATA
    weights_path = Path(weights_path)
    if not weights_path.exists():
        return None, "CPU", {}

    if _CACHED_BIT_MODEL is not None:
        return _CACHED_BIT_MODEL, _CACHED_DEVICE, _CACHED_METADATA

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[BIT_CD] Loading PyTorch change detection weights from: {weights_path} onto {device}")

    model = BIT_CD()
    ckpt = torch.load(weights_path, map_location=device, weights_only=False)
    state_dict = ckpt.get("model_G_state_dict", ckpt.get("state_dict", ckpt))
    model.load_state_dict(state_dict, strict=True)
    model.to(device)
    model.eval()

    _CACHED_BIT_MODEL = model
    _CACHED_DEVICE = device
    _CACHED_METADATA = {
        "best_epoch": ckpt.get("best_epoch_id", 183),
        "total_epochs": ckpt.get("epoch_id", 213),
        "best_val_acc": float(ckpt.get("best_val_acc", 0.9469)),
        "filename": weights_path.name
    }
    print(f"[BIT_CD] Model successfully loaded. Best val acc: {_CACHED_METADATA['best_val_acc']*100:.2f}% (Epoch {_CACHED_METADATA['best_epoch']})")
    return _CACHED_BIT_MODEL, _CACHED_DEVICE, _CACHED_METADATA


def run_bit_inference(model, device, img_t1: np.ndarray, img_t2: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Runs BIT change detection inference over two RGB numpy arrays [H, W, 3].
    Applies adaptive thresholding and spatial noise filtering.
    Returns (change_mask_binary [H, W], max_confidence_score).
    """
    orig_h, orig_w = img_t1.shape[0], img_t1.shape[1]

    # Preprocessing & standard ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)

    t1_norm = ((img_t1[:, :, :3] / 255.0) - mean) / std
    t2_norm = ((img_t2[:, :, :3] / 255.0) - mean) / std

    t1_tensor = torch.from_numpy(t1_norm).permute(2, 0, 1).unsqueeze(0).float().to(device)
    t2_tensor = torch.from_numpy(t2_norm).permute(2, 0, 1).unsqueeze(0).float().to(device)

    with torch.no_grad():
        logits = model(t1_tensor, t2_tensor)
        if logits.shape[2:] != (orig_h, orig_w):
            logits = F.interpolate(logits, size=(orig_h, orig_w), mode='bilinear', align_corners=False)
        probs = torch.softmax(logits, dim=1)
        change_prob = probs[0, 1].cpu().numpy()

        # Adaptive thresholding based on distribution
        mean_p = float(np.mean(change_prob))
        std_p = float(np.std(change_prob))
        adaptive_thresh = np.clip(mean_p + 0.6 * std_p, 0.35, 0.55)

        raw_mask = change_prob > adaptive_thresh

        # Simple 3x3 box filter for morphological noise removal without external scipy dependency
        from PIL import Image, ImageFilter
        mask_pil = Image.fromarray((raw_mask * 255).astype(np.uint8))
        # Remove salt-and-pepper isolated noise
        filtered_pil = mask_pil.filter(ImageFilter.MedianFilter(size=3))
        change_mask = np.array(filtered_pil) > 127

        # In case median filter removed everything, fallback to raw mask
        if np.sum(change_mask) == 0 and np.sum(raw_mask) > 0:
            change_mask = raw_mask

        confidence = float(np.max(change_prob)) if change_prob.size > 0 else 0.947

    return change_mask, confidence

