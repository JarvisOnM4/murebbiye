# Decision: Image & Video Generation — SWOT Analysis

**Date**: 2026-03-04
**Status**: Research complete, pending implementation
**Budget constraint**: $5-20/month for media generation

---

## Recommendation

**Primary**: Self-hosted FLUX.1 Schnell (free, Apache 2.0) for bulk educational images
**Fallback**: AWS Bedrock Titan Image ($0.01/image) or OpenAI GPT Image 1 Mini ($0.005/image)
**Video**: Deferred — too expensive at current budget. Use Lottie/SVG animations instead.

---

## 1. IMAGE GENERATION — Viable Options

### 1.1 FLUX.1 Schnell (Self-Hosted) — RECOMMENDED PRIMARY

**Cost**: $0/month (Apache 2.0, commercial OK)
**Setup**: ComfyUI or diffusers on M4/32GB Mac, ~12GB unified memory
**Speed**: 10-40s per image at 1024x1024 on M4
**Quality**: Very good for educational illustrations. 1-4 step generation.

| SWOT | |
|---|---|
| **Strengths** | Free; no API limits; no vendor lock-in; Apache 2.0; runs on existing M4; can fine-tune for Turkish educational style |
| **Weaknesses** | 10-40s/image is slow for real-time; consumes Mac resources (conflicts with Ollama/R2); no built-in safety filter |
| **Opportunities** | Fine-tune with educational LoRA; pre-generate libraries during off-hours; prompt templates for consistent style |
| **Threats** | Mac resource contention with R2; safety is our responsibility; generation speed limits throughput |

**Safety**: Must implement prompt-level filtering + post-generation image classifier. Critical for children's platform.

---

### 1.2 AWS Bedrock Titan Image Generator — RECOMMENDED FALLBACK

**Cost**: $0.01/image → 1,000 images for $10/mo
**Integration**: Same SDK as existing Claude Haiku (BedrockRuntimeClient)

| SWOT | |
|---|---|
| **Strengths** | Zero new infrastructure; same billing; built-in content safety; cheapest API option |
| **Weaknesses** | Quality below FLUX and GPT Image; limited model selection |
| **Opportunities** | Simplest integration path; consolidated billing; AWS may add better models |
| **Threats** | Quality gap may frustrate; Titan is behind the curve |

---

### 1.3 OpenAI GPT Image 1 Mini — QUALITY ALTERNATIVE

**Cost**: $0.005-0.05/image depending on quality tier
**Best at**: Diagrams, flowcharts, text-in-image (Turkish labels on illustrations)

| SWOT | |
|---|---|
| **Strengths** | Highest safety guarantees (non-bypassable); best prompt understanding; excellent text rendering in images |
| **Weaknesses** | Closed-source; vendor lock-in; requires internet; adds new vendor dependency |
| **Opportunities** | Mini tier makes it budget-viable (~4,000 images for $20/mo at Low quality) |
| **Threats** | Pricing changes; dependency on single vendor; Turkish prompt handling may be inconsistent |

---

### 1.4 Stability AI API (SD 3.5 / SDXL)

**Cost**: SDXL $0.002-0.006/image, SD 3.5 Turbo ~$0.04/image

| SWOT | |
|---|---|
| **Strengths** | Very cheap at SDXL tier; credit-based; community license free for <$1M revenue |
| **Weaknesses** | Weaker text-in-image; Stability AI's business viability uncertain |
| **Opportunities** | Community license allows free self-hosting of SD 3.5 |
| **Threats** | Company financial instability; API may be discontinued; falling behind FLUX |

---

### 1.5 Google Imagen 4 (Vertex AI)

**Cost**: ~$0.02/image, batch API at ~$0.01/image (50% discount)

| SWOT | |
|---|---|
| **Strengths** | Strong safety (SynthID watermarking); competitive pricing; Google reliability |
| **Weaknesses** | Requires GCP account (adds complexity to existing AWS stack) |
| **Opportunities** | Batch API is competitive; GCP free tier credits |
| **Threats** | Adding GCP to AWS stack increases operational complexity; Google's product kill history |

---

### NOT VIABLE

- **Adobe Firefly API**: Enterprise pricing $5,000+/year. Skip.
- **Midjourney**: No affordable API. Third-party wrappers violate ToS. Skip.

---

## 2. VIDEO GENERATION — Deferred

**Budget reality**: At $5-20/mo, video is too expensive.

| Service | Cost/clip | Clips at $20/mo |
|---|---|---|
| Runway Gen-3 Turbo | $0.50/10s | 40 |
| Google Veo 3 Fast | $1.20/8s | 16 |
| Kling | $0.70-1.40/10s | 14-28 |

**Alternative**: Pre-made Lottie/SVG animations, CSS animations, animated GIFs. These are free, lightweight, and work offline — aligning with the equity strategy (Tier 3: Unplugged Only).

**Future**: When Zeus GPU is available or revenue justifies it, reconsider Runway Gen-3 Turbo ($0.05/sec) or self-hosted Stable Video Diffusion.

---

## 3. CONTENT SAFETY RANKING (Critical for Children)

1. **OpenAI GPT Image** — Strongest. Non-optional, non-bypassable.
2. **Google Imagen/Vertex AI** — Strong. SynthID + content filtering.
3. **AWS Bedrock (Titan/Nova)** — Good. AWS-managed safety layers.
4. **Stability AI API** — Moderate. Default NSFW filter, less rigorous.
5. **FLUX API (BFL/Replicate)** — Moderate. Content filtering present but less documented.
6. **Self-hosted anything** — OUR responsibility. Must build safety pipeline.

---

## 4. RECOMMENDED ARCHITECTURE

### Monthly Budget: $5-15

| Component | Cost | Capacity |
|---|---|---|
| FLUX.1 Schnell self-hosted (bulk) | $0 | Unlimited (slow) |
| Bedrock Titan OR GPT Image Mini (quality) | $5-15 | 500-3,000 images |
| Video generation | $0 | Deferred (use Lottie/SVG) |
| **Total** | **$5-15/mo** | **Thousands of images** |

### Safety Pipeline for Self-Hosted

1. **Pre-generation**: Prompt keyword blocklist + Turkish-language safety check
2. **Post-generation**: Lightweight NSFW classifier on output image
3. **Audit trail**: Log all generated images with prompt + timestamp

---

## Sources

- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [Stability AI Developer Platform](https://platform.stability.ai/pricing)
- [FLUX.1 Schnell (HuggingFace)](https://huggingface.co/black-forest-labs/FLUX.1-schnell)
- [Black Forest Labs Pricing](https://bfl.ai/pricing)
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Google Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Replicate FLUX Collection](https://replicate.com/collections/flux)
- [Runway API Pricing](https://docs.dev.runwayml.com/guides/pricing/)
- [Google Veo Pricing](https://costgoat.com/pricing/google-veo)
