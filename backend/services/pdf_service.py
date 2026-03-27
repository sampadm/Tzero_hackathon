import pdfplumber


def extract_text(pdf_path: str) -> dict:
    """Extract text from PDF. Returns dict with pages list and is_image_pdf flag."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = []
            total_text = ""
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                tables = page.extract_tables() or []
                pages.append({"page_num": i + 1, "text": text, "tables": tables})
                total_text += text + "\n"

            is_image_pdf = len(total_text.strip()) < 50
            return {
                "pages": pages,
                "full_text": total_text,
                "page_count": len(pdf.pages),
                "is_image_pdf": is_image_pdf,
            }
    except Exception as e:
        return {"error": str(e), "is_image_pdf": False, "pages": [], "full_text": ""}
