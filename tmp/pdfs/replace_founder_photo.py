from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(r"C:\Users\pietr\fanta-app")
SOURCE_PDF = ROOT / "output" / "pdf" / "FantaChat-SMARTcup-showcase-slide-founder.pdf"
OUTPUT_PDF = ROOT / "output" / "pdf" / "FantaChat-SMARTcup-showcase-slide-founder-v2.pdf"
SOURCE_IMAGE = Path(
    r"C:\Users\pietr\.codex\generated_images\019ef8dd-92db-7662-be2b-c4dbe56b9e83\exec-8f612ae5-aab9-4bad-9ddc-edaba255d346.png"
)
TEMP_IMAGE = ROOT / "tmp" / "pdfs" / "founder-photo-cropped.png"
OVERLAY_PDF = ROOT / "tmp" / "pdfs" / "founder-photo-overlay.pdf"

PAGE_WIDTH, PAGE_HEIGHT = 960, 540
PHOTO_X, PHOTO_Y = 475, 193
PHOTO_WIDTH, PHOTO_HEIGHT = 198, 240


def main() -> None:
    image = Image.open(SOURCE_IMAGE).convert("RGB")
    target_size = (1200, 1455)
    cropped = ImageOps.fit(
        image,
        target_size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.0),
    )
    cropped.save(TEMP_IMAGE, format="PNG", optimize=True)

    canvas = Canvas(str(OVERLAY_PDF), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    canvas.drawImage(
        ImageReader(str(TEMP_IMAGE)),
        PHOTO_X,
        PHOTO_Y,
        width=PHOTO_WIDTH,
        height=PHOTO_HEIGHT,
        preserveAspectRatio=False,
        mask="auto",
    )
    canvas.save()

    base_reader = PdfReader(str(SOURCE_PDF))
    overlay_reader = PdfReader(str(OVERLAY_PDF))
    base_reader.pages[0].merge_page(overlay_reader.pages[0])

    writer = PdfWriter()
    writer.clone_document_from_reader(base_reader)
    with OUTPUT_PDF.open("wb") as stream:
        writer.write(stream)

    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
