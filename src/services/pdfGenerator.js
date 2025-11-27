import PDFDocument from "pdfkit";

const getStatusColor = (status) => {
  switch (status) {
    case "Paid":
      return "#22bb33";
    case "Pending":
      return "#f0ad4e";
    case "Overdue":
      return "#d9534f";
    default:
      return "#666";
  }
};

const generateInvoicePDF = async (invoice, company = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, left: 30, right: 30, bottom: 30 }
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const left = 30;
      const right = pageWidth - 30;
      const contentWidth = right - left;

      // colors & sizes from reference
      const headerTitleSize = 36;
      const smallText = 9;
      const normalText = 10;
      const tableHeaderBg = "#111827"; // dark navy
      const tableHeaderText = "#ffffff";
      const tableBorder = "#e6e6e6";
      const notesBg = "#f5f7f8";
      const totalsLabelColor = "#6b7280";
      const totalsValueColor = "#111827";
      const totalBoxBg = "#111827";
      const totalBoxText = "#ffffff";

      let y = 20;

      // ---------- Header: Logo + Title + Invoice ID ----------
      if (company?.logo) {
        try {
          // try to fit logo into 64x64
          doc.image(company.logo, left, y, { width: 64, height: 64 });
        } catch (e) {
          // ignore if logo path invalid
        }
      }

      // Title "INVOICE"
      const titleX = left + 0; // more left like screenshot
      doc.font("Helvetica-Bold").fontSize(headerTitleSize).fillColor("#111827").text("INVOICE", titleX, y);
      y += headerTitleSize + 6;

      // Small invoice id under title
      doc.font("Helvetica").fontSize(smallText).fillColor("#6b7280").text(`Invoice ID: ${invoice.invoiceNumber}`, titleX, y);
      // Move y down a bit to align with columns
      y += 18;

      // ---------- Invoice To (left), Center space, and From (right) ----------
      const leftColX = left;
      const middleSpace = 40;
      const colWidth = (contentWidth - middleSpace) / 2;
      const rightColX = left + colWidth + middleSpace;

      // INVOICE TO title
      doc.font("Helvetica-Bold").fontSize(normalText).fillColor("#111827").text("INVOICE TO", leftColX, y);
      doc.font("Helvetica").fontSize(smallText).fillColor("#111827");
      let curY = y + 14;
      doc.text(invoice.clientId?.name || "", leftColX, curY, { width: colWidth });
      curY += 12;
      if (invoice.clientId?.email) { doc.text(invoice.clientId.email, leftColX, curY, { width: colWidth }); curY += 12; }
      if (invoice.clientId?.phone) { doc.text(invoice.clientId.phone, leftColX, curY, { width: colWidth }); curY += 12; }
      if (invoice.clientId?.address) { doc.text(invoice.clientId.address, leftColX, curY, { width: colWidth }); curY += 12; }

      // FROM column (right side)
      doc.font("Helvetica-Bold").fontSize(normalText).text("FROM", rightColX, y);
      doc.font("Helvetica").fontSize(smallText).fillColor("#111827");
      let rightY = y + 14;
      doc.text(company.businessName || "", rightColX, rightY, { width: colWidth });
      rightY += 12;
      if (company.email) { doc.text(company.email, rightColX, rightY, { width: colWidth }); rightY += 12; }
      if (company.phone) { doc.text(company.phone, rightColX, rightY, { width: colWidth }); rightY += 12; }
      if (company.address) { doc.text(company.address, rightColX, rightY, { width: colWidth }); rightY += 12; }

      y = Math.max(curY, rightY) + 12;

      // ---------- Dates and Status row ----------
      const datesY = y;
      const datesHeaderHeight = 24;
      const datesRowHeight = 20;
      
      doc.rect(left, datesY, contentWidth, datesHeaderHeight).fill(tableHeaderBg);
      doc.fillColor(tableHeaderText).font("Helvetica-Bold").fontSize(10);
      
      doc.text("Invoice Date", leftColX + 10, datesY + 6);
      doc.text("Due Date", rightColX + 10, datesY + 6);
      
      const statusLabelX = right - 78;
      doc.text("Status", statusLabelX, datesY + 6);
      
      // Dates data row
      const datesDataY = datesY + datesHeaderHeight;
      doc.font("Helvetica").fontSize(9).fillColor("#111827");
      doc.text(new Date(invoice.invoiceDate).toLocaleDateString(), leftColX + 10, datesDataY + 4);
      doc.text(new Date(invoice.dueDate).toLocaleDateString(), rightColX + 10, datesDataY + 4);
      
      // Status badge
      const statusColor = getStatusColor(invoice.status);
      const pillW = 60, pillH = 16;
      doc.roundedRect(statusLabelX, datesDataY + 2, pillW, pillH, 3).fill(statusColor);
      doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9).text(invoice.status, statusLabelX + 6, datesDataY + 4);
      doc.fillColor("#000");
      
      // divider line
      doc.moveTo(left + 2, datesDataY + datesRowHeight - 4).lineTo(left + contentWidth - 2, datesDataY + datesRowHeight - 4).strokeColor(tableBorder).stroke();
      
      y = datesDataY + datesRowHeight + 8;

      // ---------- Table header ----------
      const tableTop = y + 4;
      const tableLeft = leftColX;
      const tableRight = right;
      const tableWidth = tableRight - tableLeft;
      const headerHeight = 24;

      doc.rect(tableLeft, tableTop, tableWidth, headerHeight).fill(tableHeaderBg);
      doc.fillColor(tableHeaderText).font("Helvetica-Bold").fontSize(10);
      
      const colProductX = tableLeft + 10;
      const colPriceX = tableLeft + Math.round(tableWidth * 0.45);
      const colQtyX = tableLeft + Math.round(tableWidth * 0.65);
      const colTotalX = tableLeft + Math.round(tableWidth * 0.82);

      doc.text("PRODUCT", colProductX, tableTop + 6);
      doc.text("PRICE", colPriceX, tableTop + 6, { width: colQtyX - colPriceX - 5, align: "right" });
      doc.text("QTY", colQtyX, tableTop + 6, { width: colTotalX - colQtyX - 5, align: "right" });
      doc.text("TOTAL", colTotalX, tableTop + 6, { width: tableLeft + tableWidth - colTotalX - 10, align: "right" });

      y = tableTop + headerHeight + 6;

      // ---------- Table rows ----------
      doc.font("Helvetica").fontSize(9).fillColor("#111827");
      const rowHeight = 20;
      const maxRows = 12;
      let rows = invoice.items || [];
      rows = rows.slice(0, maxRows);

      rows.forEach((item, idx) => {
        const rowY = y + idx * rowHeight;
        
        doc.fillColor("#111827").text(item.name, colProductX, rowY, { width: colPriceX - colProductX - 10 });
        
        doc.text(`$${item.price.toFixed(2)}`, colPriceX, rowY, { width: colQtyX - colPriceX - 5, align: "right" });
        
        doc.text(item.quantity.toString(), colQtyX, rowY, { width: colTotalX - colQtyX - 5, align: "right" });
        
        const rowTotal = (item.price * item.quantity).toFixed(2);
        doc.font("Helvetica-Bold").text(`$${rowTotal}`, colTotalX, rowY, { width: tableLeft + tableWidth - colTotalX - 10, align: "right" });
        doc.font("Helvetica").fontSize(9);
        
        doc.moveTo(tableLeft + 2, rowY + rowHeight - 4).lineTo(tableLeft + tableWidth - 2, rowY + rowHeight - 4).strokeColor(tableBorder).stroke();
      });

      y = y + rows.length * rowHeight + 12;

      // ---------- Totals box below table, aligned to right ----------
      const totalsWidth = 160;
      const totalsX = right - totalsWidth;
      let totalsY = y;

      const drawTotalsRow = (label, value, isBold = false, negative = false) => {
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(totalsLabelColor).text(label, totalsX, totalsY, { width: totalsWidth - 60, align: "left" });
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fillColor(totalsValueColor).text((negative ? "-" : "") + value, totalsX + 60, totalsY, { width: totalsWidth - 60, align: "right" });
        totalsY += 16;
      };

      drawTotalsRow("SUB-TOTAL", `$${invoice.subtotal.toFixed(2)}`);
      drawTotalsRow(`TAX ($${invoice.tax.toFixed(2)})`, `$${invoice.tax.toFixed(2)}`);
      if (invoice.discount && invoice.discount !== 0) {
        drawTotalsRow("DISCOUNT", `-$${invoice.discount.toFixed(2)}`);
      }

      // separator
      doc.moveTo(totalsX, totalsY).lineTo(right, totalsY).strokeColor(tableBorder).stroke();
      totalsY += 8;

      // TOTAL box
      const totalBoxW = totalsWidth;
      const totalBoxH = 26;
      doc.rect(totalsX, totalsY, totalBoxW, totalBoxH).fill(totalBoxBg);
      doc.fillColor(totalBoxText).font("Helvetica-Bold").fontSize(11).text("TOTAL", totalsX + 8, totalsY + 6);
      doc.text(`$${invoice.total.toFixed(2)}`, totalsX + 60, totalsY + 6, { width: totalBoxW - 60, align: "right" });
      doc.fillColor("#000");

      y = totalsY + totalBoxH + 12;

      // ---------- Notes box ----------
      if (invoice.notes) {
        const notesTop = y + 8;
        const notesHeight = 48;
        doc.roundedRect(left, notesTop, contentWidth, notesHeight, 4).fill(notesBg);
        doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("NOTES", left + 8, notesTop + 6);
        doc.font("Helvetica").fontSize(9).fillColor("#444").text(invoice.notes, left + 8, notesTop + 22, {
          width: contentWidth - 16,
        });
        y = notesTop + notesHeight + 12;
      } else {
        y += 18;
      }

      // ---------- Bottom divider and footer ----------
      const footerY = pageHeight - 90;
      doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(tableBorder).stroke();

      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#444").text("Thank You For Your Business", left, footerY + 10, {
        width: contentWidth,
        align: "center",
      });

      // ensure end
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default generateInvoicePDF;
