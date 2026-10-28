"""Ask the model to describe photos in free text (no constraint) — checks it sees the image.

Usage: python -I probe.py <model.litertlm> <prompt> <image> [<image> ...]
"""
import sys
import time

import litert_lm as L


def main(model: str, prompt: str, images: list[str]) -> None:
    gpu = L.Backend.GPU()
    with L.Engine(model, backend=gpu, vision_backend=gpu, max_num_tokens=2048, max_num_images=1) as engine:
        for img in images:
            conv = engine.create_conversation(sampler_config=L.SamplerConfig(top_k=1, temperature=0.0, seed=0), max_output_tokens=200)
            t = time.time()
            reply = conv.send_message(L.Contents.of([L.Content.ImageFile(absolute_path=img), L.Content.Text(prompt)]))
            print(f"--- {img.rsplit('/', 1)[-1]} ({time.time() - t:.1f}s)\n{reply}\n", flush=True)
            conv.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
