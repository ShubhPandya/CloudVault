import io
from typing import Tuple, Dict, Any
from PIL import Image
from pypdf import PdfReader


def generate_image_thumbnail(
    input_bytes: bytes,
    max_size: Tuple[int, int] = (256, 256)
) -> bytes:
    """
    Resizes raw images into an aspect-ratio-preserved thumbnail in WEBP format.
    """
    with Image.open(io.BytesIO(input_bytes)) as img:
        # Convert RGBA/P modes to RGB for compatibility
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="WEBP", quality=80, optimize=True)
        return output_buffer.getvalue()


def extract_pdf_metadata_and_info(input_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts page count, author, and title metadata from PDF streams.
    """
    reader = PdfReader(io.BytesIO(input_bytes))
    meta = reader.metadata or {}
    
    return {
        "page_count": len(reader.pages),
        "title": str(meta.get("/Title", "Untitled")),
        "author": str(meta.get("/Author", "Unknown")),
    }