import PDFDocument from "pdfkit";

function drawHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.fontSize(20).fillColor("#0f172a").text(title, { align: "left" });
  doc.moveDown(0.4);
  doc
    .strokeColor("#cbd5e1")
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

export async function renderReportPdf(input: {
  title: string;
  markdown: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 55, right: 55 },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawHeader(doc, input.title);

    const lines = input.markdown.split("\n");
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.45);
        continue;
      }

      if (line.startsWith("# ")) {
        doc.moveDown(0.5);
        doc.fontSize(18).fillColor("#0f172a").text(line.replace(/^#\s+/, ""), {
          underline: false,
        });
        doc.moveDown(0.35);
        continue;
      }
      if (line.startsWith("## ")) {
        doc.moveDown(0.35);
        doc.fontSize(14).fillColor("#1e293b").text(line.replace(/^##\s+/, ""));
        doc.moveDown(0.25);
        continue;
      }
      if (line.startsWith("### ")) {
        doc.fontSize(12).fillColor("#334155").text(line.replace(/^###\s+/, ""));
        doc.moveDown(0.2);
        continue;
      }

      if (line.startsWith("|") && line.endsWith("|")) {
        doc.fontSize(9).fillColor("#0f172a").text(line, { lineGap: 1 });
        continue;
      }

      if (/^- /.test(line)) {
        doc.fontSize(10).fillColor("#0f172a").text(`• ${line.slice(2)}`, {
          indent: 12,
          lineGap: 2,
        });
        continue;
      }

      doc.fontSize(10).fillColor("#0f172a").text(line, { lineGap: 2 });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(`Page ${i + 1} of ${range.count}`, 0, doc.page.height - 40, { align: "center" });
    }

    doc.end();
  });
}
