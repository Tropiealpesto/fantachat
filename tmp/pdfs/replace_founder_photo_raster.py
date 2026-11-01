from pathlib import Path

from PIL import Image, ImageOps
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(r"C:\Users\pietr\fanta-app")
BASE_RENDER = ROOT / "tmp" / "pdfs" / "founder-base-300.png"
OUTPUT_PDF = ROOT / "output" / "pdf" / "FantaChat-SMARTcup-showcase-slide-founder-v4.pdf"
SOURCE_IMAGE = Path(
    r"C:\Users\pietr\.codex\generated_images\019ef8dd-92db-7662-be2b-c4dbe56b9e83\exec-8f612ae5-aab9-4bad-9ddc-edaba255d346.png"
)
COMPOSITED_RENDER = ROOT / "tmp" / "pdfs" / "founder-composited-300.png"

PAGE_WIDTH, PAGE_HEIGHT = 960, 540
PHOTO_X, PHOTO_TOP = 474, 106
PHOTO_WIDTH, PHOTO_HEIGHT = 200, 242
RENDER_DPI = 300
SCALE = RENDER_DPI / 72


def main() -> None:
    base = Image.open(BASE_RENDER).convert("RGB")
    target = (round(PHOTO_WIDTH * SCALE), round(PHOTO_HEIGHT * SCALE))
    portrait = Image.open(SOURCE_IMAGE).convert("RGB")
    portrait = ImageOps.fit(
        portrait,
        target,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.0),
    )
    x = round(PHOTO_X * SCALE)
    y = round(PHOTO_TOP * SCALE)
    base.paste(portrait, (x, y))
    base.save(COMPOSITED_RENDER, format="PNG", optimize=True)

    canvas = Canvas(str(OUTPUT_PDF), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    canvas.drawImage(
        ImageReader(str(COMPOSITED_RENDER)),
        0,
        0,
        width=PAGE_WIDTH,
        height=PAGE_HEIGHT,
        preserveAspectRatio=False,
    )
    canvas.save()
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
