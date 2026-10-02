"""PDF text extraction with hyperlink extraction."""
import pdfplumber


def extract_text_from_pdf(file):
    text = ""
    hyperlinks = []
    
    with pdfplumber.open(file) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            page_text = page.extract_text() or ""
            text += page_text + "\n"
            
            # Extract hyperlinks if present
            if hasattr(page, "hyperlinks") and page.hyperlinks:
                for link in page.hyperlinks:
                    uri = link.get("uri")
                    if uri:
                        hyperlinks.append(f"Page {page_num} link: {uri}")
                        
    if hyperlinks:
        text += "\n--- Extracted Hyperlinks ---\n" + "\n".join(hyperlinks) + "\n"
        
    return text
