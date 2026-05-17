import io
import base64
import modal
from pydantic import BaseModel

MODELS_DIR = "/models"
FLUX_REPO = "black-forest-labs/FLUX.1-dev"
CONTROLNET_REPO = "Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0"
IP_ADAPTER_REPO = "XLabs-AI/flux-ip-adapter"
CLIP_REPO = "openai/clip-vit-large-patch14"

hf_secret = modal.Secret.from_name("huggingface-secret")
volume = modal.Volume.from_name("pose2img-models", create_if_missing=True)


def _download_models():
    import os
    from huggingface_hub import snapshot_download

    token = os.environ.get("HF_TOKEN")
    print(f"Downloading {FLUX_REPO}...")
    snapshot_download(
        FLUX_REPO,
        local_dir=f"{MODELS_DIR}/flux-dev",
        token=token,
        ignore_patterns=["*.bin"],
    )
    print(f"Downloading {CONTROLNET_REPO}...")
    snapshot_download(CONTROLNET_REPO, local_dir=f"{MODELS_DIR}/controlnet")

    print(f"Downloading {IP_ADAPTER_REPO}...")
    snapshot_download(IP_ADAPTER_REPO, local_dir=f"{MODELS_DIR}/ip-adapter")

    print(f"Downloading {CLIP_REPO}...")
    snapshot_download(CLIP_REPO, local_dir=f"{MODELS_DIR}/clip")

    print("Done.")


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "diffusers>=0.32.0",
        "transformers>=4.44.0",
        "accelerate>=1.0.0",
        "sentencepiece",
        "pillow",
        "huggingface-hub",
        "pydantic>=2.0",
        "fastapi[standard]",
    )
    .run_function(
        _download_models,
        secrets=[hf_secret],
        volumes={MODELS_DIR: volume},
    )
)

app = modal.App("pose2img", image=image)


class GenerateRequest(BaseModel):
    pose_image: str           # base64 PNG — DWPose-style skeleton render
    reference_image: str | None = None
    ip_adapter_scale: float = 0.6
    prompt: str
    width: int = 1024
    height: int = 1024
    num_steps: int = 28
    guidance_scale: float = 3.5
    pose_strength: float = 0.9
    seed: int | None = None


class GenerateResponse(BaseModel):
    image: str  # base64 PNG


@app.cls(
    gpu="A100-40GB",
    volumes={MODELS_DIR: volume},
    timeout=300,
    secrets=[hf_secret],
)
class PoseToImage:
    @modal.enter()
    def load_pipeline(self):
        import torch
        from diffusers import FluxControlNetModel, FluxControlNetPipeline

        class FixedFluxControlNetPipeline(FluxControlNetPipeline):
            """
            Fixes _pack_latents to use the actual batch size from the latent tensor
            rather than the `batch_size` argument, which is wrong when IP-Adapter
            doubles the batch internally for classifier-free guidance.
            """
            @staticmethod
            def _pack_latents(latents, batch_size, num_channels_latents, height, width):
                batch_size = latents.shape[0]
                latents = latents.view(batch_size, num_channels_latents, height // 2, 2, width // 2, 2)
                latents = latents.permute(0, 2, 4, 1, 3, 5)
                latents = latents.reshape(batch_size, (height // 2) * (width // 2), num_channels_latents * 4)
                return latents

        print("Loading ControlNet...")
        controlnet = FluxControlNetModel.from_pretrained(
            f"{MODELS_DIR}/controlnet",
            torch_dtype=torch.bfloat16,
        )
        print("Loading Flux pipeline...")
        self.pipe = FixedFluxControlNetPipeline.from_pretrained(
            f"{MODELS_DIR}/flux-dev",
            controlnet=controlnet,
            torch_dtype=torch.bfloat16,
        )
        self.pipe.enable_model_cpu_offload()

        print("Loading IP-Adapter...")
        self.pipe.load_ip_adapter(
            f"{MODELS_DIR}/ip-adapter",
            weight_name="ip_adapter.safetensors",
            image_encoder_pretrained_model_name_or_path=f"{MODELS_DIR}/clip",
        )
        print("Pipeline ready.")

    @modal.fastapi_endpoint(method="POST")
    def generate(self, req: GenerateRequest) -> GenerateResponse:
        import torch
        from PIL import Image

        def b64_to_image(b64: str) -> Image.Image:
            return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

        pose_img = b64_to_image(req.pose_image).resize((req.width, req.height))

        generator = None
        if req.seed is not None:
            generator = torch.Generator(device="cuda").manual_seed(req.seed)

        ip_kwargs: dict = {}
        if req.reference_image:
            self.pipe.set_ip_adapter_scale(req.ip_adapter_scale)
            ip_kwargs["ip_adapter_image"] = b64_to_image(req.reference_image)
        else:
            self.pipe.set_ip_adapter_scale(0.0)

        result = self.pipe(
            req.prompt,
            control_image=pose_img,
            width=req.width,
            height=req.height,
            controlnet_conditioning_scale=req.pose_strength,
            control_guidance_end=0.65,
            num_inference_steps=req.num_steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
            **ip_kwargs,
        ).images[0]

        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return GenerateResponse(image=base64.b64encode(buf.getvalue()).decode())
