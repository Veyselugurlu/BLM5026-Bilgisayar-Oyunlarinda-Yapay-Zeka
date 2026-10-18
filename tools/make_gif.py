"""
Turns frames saved by FrameRecorder into a GIF (README) and a film strip (report).
  RollerBallInference.exe -batchmode -recordFrames <dir> -recordCount 400 -recordEvery 2
  python tools/make_gif.py <dir> <name>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

src_dir, name = Path(sys.argv[1]), sys.argv[2]
out = Path("docs/week05/images")
out.mkdir(parents=True, exist_ok=True)
src = sorted(src_dir.glob("frame_*.png"))
crop = (240, 120, 720, 450)  # floor region of the 960x540 frame
frames = [Image.open(p).crop(crop).convert("RGB") for p in src[:300]]

small = [f.resize((360, 248)) for f in frames]
small[0].save(out / f"{name}.gif", save_all=True, append_images=small[1:], duration=40, loop=0, optimize=True)

# 8 frames, 0.4 s apart (one saved frame = 2 game frames = 0.04 s)
w, h = 300, 206
strip = Image.new("RGB", (w * 4 + 50, h * 2 + 70), (255, 255, 255))
draw = ImageDraw.Draw(strip)
for k, i in enumerate(range(0, 80, 10)):
    x, y = 10 + (k % 4) * (w + 10), 10 + (k // 4) * (h + 30)
    strip.paste(frames[i].resize((w, h)), (x, y))
    draw.text((x + 4, y + h + 4), f"t = {i * 0.04:.1f} s", fill=(30, 30, 30))
strip.save(out / f"{name}_filmstrip.png")
print(name, (out / f"{name}.gif").stat().st_size // 1024, "KB")
