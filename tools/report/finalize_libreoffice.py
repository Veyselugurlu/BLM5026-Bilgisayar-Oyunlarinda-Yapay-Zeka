"""
Opens the generated .docx in LibreOffice (headless), fills in the table of contents
with page numbers, and saves the result as .docx and .pdf.
LibreOffice does not update fields on open the way Word does, so without this step
the table of contents would be empty for a LibreOffice user.

Run with LibreOffice's own Python:
  "C:/Program Files/LibreOffice/program/python.exe" tools/report/finalize_libreoffice.py <in.docx> <out.docx> <out.pdf>
"""
import os
import subprocess
import sys
import time

import uno
from com.sun.star.beans import PropertyValue

SOFFICE = os.path.join(os.path.dirname(sys.executable), "soffice.exe")
PIPE = "report_finalize_pipe"


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def url(path):
    return uno.systemPathToFileUrl(os.path.abspath(path))


def main(src, out_docx, out_pdf):
    office = subprocess.Popen([SOFFICE, "--headless", "--invisible", "--norestore", "--nologo",
                               f"--accept=pipe,name={PIPE};urp;StarOffice.ComponentContext"])
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        for _ in range(60):
            try:
                ctx = resolver.resolve(f"uno:pipe,name={PIPE};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("LibreOffice did not start")

        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        doc = desktop.loadComponentFromURL(url(src), "_blank", 0, (prop("Hidden", True),))
        indexes = doc.getDocumentIndexes()
        for i in range(indexes.getCount()):
            indexes.getByIndex(i).update()
        doc.refresh()
        # second pass: page numbers settle after the index itself has been laid out
        for i in range(indexes.getCount()):
            indexes.getByIndex(i).update()

        doc.storeToURL(url(out_docx), (prop("FilterName", "MS Word 2007 XML"),))
        doc.storeToURL(url(out_pdf), (prop("FilterName", "writer_pdf_Export"),))
        print(f"indexes updated: {indexes.getCount()} -> {out_docx}, {out_pdf}")
        doc.close(True)
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        office.wait(timeout=30)


if __name__ == "__main__":
    main(*sys.argv[1:4])
