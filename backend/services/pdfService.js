const PDFDocument = require('pdfkit');

const generateQuotationPDF = (quotation, customer, items, stream) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Pipe the PDF document to the stream
  doc.pipe(stream);

  // --- HEADER SECTION ---
  doc.fillColor('#1e293b') // Dark slate
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('RD BEARING MILL & STORE', 50, 45);

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#64748b') // Light slate
     .text('123, Industrial Area, Phase II, New Delhi - 110020', 50, 72)
     .text('Mobile: +91 98765 43210 | Email: sales@rdbearingmill.com', 50, 85)
     .text('GSTIN: 07AAAAA1111A1Z1', 50, 98);

  // Right-aligned Title and Quotation Info
  doc.fillColor('#0f172a')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text('QUOTATION', 400, 45, { align: 'right' });

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#334155')
     .text(`Quote No: ${quotation.quotation_number}`, 400, 72, { align: 'right' })
     .text(`Date: ${quotation.date}`, 400, 85, { align: 'right' })
     .text(`Status: ${quotation.status || 'Draft'}`, 400, 98, { align: 'right' });

  // Horizontal separator line
  doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // --- CUSTOMER DETAILS SECTION ---
  doc.fillColor('#0f172a')
     .fontSize(11)
     .font('Helvetica-Bold')
     .text('QUOTATION FOR:', 50, 130);

  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#1e293b')
     .text(customer.name, 50, 145)
     .text(`Mobile: ${customer.mobile}`, 50, 158)
     .text(`GSTIN: ${customer.gst_number || 'N/A'}`, 50, 171)
     .text(`Address: ${customer.address || 'N/A'}`, 50, 184, { width: 300 });

  // Box around customer details
  doc.rect(45, 123, 505, 78).strokeColor('#f1f5f9').lineWidth(1).stroke();

  // --- PRODUCTS TABLE SECTION ---
  let tableTop = 215;
  
  // Headers
  doc.fillColor('#ffffff');
  // Header background box
  doc.rect(45, tableTop, 505, 20).fill('#3b82f6').stroke(); // Blue header
  
  doc.fillColor('#ffffff')
     .fontSize(9)
     .font('Helvetica-Bold')
     .text('S.No', 50, tableTop + 6)
     .text('Product Description', 85, tableTop + 6)
     .text('Company', 245, tableTop + 6)
     .text('Size', 315, tableTop + 6)
     .text('Qty', 380, tableTop + 6, { width: 30, align: 'right' })
     .text('Rate', 420, tableTop + 6, { width: 50, align: 'right' })
     .text('Amount', 485, tableTop + 6, { width: 60, align: 'right' });

  let yPosition = tableTop + 20;
  doc.font('Helvetica').fillColor('#334155');

  items.forEach((item, index) => {
    // Check page overflow
    if (yPosition > 650) {
      doc.addPage();
      yPosition = 50;
      
      // Reprint headers on new page
      doc.fillColor('#ffffff');
      doc.rect(45, yPosition, 505, 20).fill('#3b82f6').stroke();
      doc.fillColor('#ffffff')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('S.No', 50, yPosition + 6)
         .text('Product Description', 85, yPosition + 6)
         .text('Company', 245, yPosition + 6)
         .text('Size', 315, yPosition + 6)
         .text('Qty', 380, yPosition + 6, { width: 30, align: 'right' })
         .text('Rate', 420, yPosition + 6, { width: 50, align: 'right' })
         .text('Amount', 485, yPosition + 6, { width: 60, align: 'right' });
         
      yPosition += 20;
      doc.font('Helvetica').fillColor('#334155');
    }

    const serial = index + 1;
    const productName = item.product_name || 'Unknown Product';
    const company = item.company_name || 'N/A';
    const size = item.size_name || 'N/A';
    const qty = item.quantity;
    const rate = parseFloat(item.rate).toFixed(2);
    const amount = parseFloat(item.total_amount).toFixed(2);

    // Zebra striping background
    if (serial % 2 === 0) {
      doc.rect(45, yPosition, 505, 20).fill('#f8fafc').stroke();
    } else {
      doc.rect(45, yPosition, 505, 20).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
    }

    doc.fillColor('#334155')
       .fontSize(9)
       .text(serial.toString(), 50, yPosition + 6)
       .text(productName, 85, yPosition + 6, { width: 155, height: 12, ellipsis: true })
       .text(company, 245, yPosition + 6, { width: 65, height: 12, ellipsis: true })
       .text(size, 315, yPosition + 6, { width: 60, height: 12, ellipsis: true })
       .text(qty.toString(), 380, yPosition + 6, { width: 30, align: 'right' })
       .text(rate, 420, yPosition + 6, { width: 50, align: 'right' })
       .text(amount, 485, yPosition + 6, { width: 60, align: 'right' });

    yPosition += 20;
  });

  // Draw table bottom border line
  doc.moveTo(45, yPosition).lineTo(550, yPosition).strokeColor('#cbd5e1').lineWidth(1).stroke();

  // --- TOTALS SECTION ---
  yPosition += 15;
  
  if (yPosition > 650) {
    doc.addPage();
    yPosition = 50;
  }

  const subtotal = parseFloat(quotation.subtotal).toFixed(2);
  const discount = parseFloat(quotation.discount_amount).toFixed(2);
  const gst = parseFloat(quotation.gst_amount).toFixed(2);
  const grandTotal = parseFloat(quotation.grand_total).toFixed(2);

  doc.font('Helvetica').fontSize(9).fillColor('#475569');
  
  doc.text('Subtotal:', 380, yPosition, { width: 80, align: 'right' });
  doc.font('Helvetica-Bold').text(subtotal, 465, yPosition, { width: 80, align: 'right' });

  yPosition += 15;
  doc.font('Helvetica').text('Discount:', 380, yPosition, { width: 80, align: 'right' });
  doc.font('Helvetica-Bold').text(`-${discount}`, 465, yPosition, { width: 80, align: 'right' });

  yPosition += 15;
  doc.font('Helvetica').text('GST Tax (18% Avg):', 380, yPosition, { width: 80, align: 'right' });
  doc.font('Helvetica-Bold').text(gst, 465, yPosition, { width: 80, align: 'right' });

  yPosition += 18;
  doc.rect(370, yPosition - 4, 180, 22).fill('#f1f5f9');
  
  doc.fillColor('#0f172a')
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('Grand Total:', 380, yPosition + 2, { width: 80, align: 'right' });
  doc.text(`Rs. ${grandTotal}`, 465, yPosition + 2, { width: 80, align: 'right' });

  // --- TERMS & CONDITIONS & SIGNATURE ---
  yPosition += 45;
  
  if (yPosition > 680) {
    doc.addPage();
    yPosition = 50;
  }

  // Terms (Left)
  doc.fillColor('#0f172a')
     .font('Helvetica-Bold')
     .fontSize(9)
     .text('TERMS & CONDITIONS:', 50, yPosition);

  doc.font('Helvetica')
     .fontSize(8)
     .fillColor('#475569')
     .text('1. Quotation is valid for 30 days from the date of issue.', 50, yPosition + 15)
     .text('2. Goods once sold will not be taken back or exchanged.', 50, yPosition + 25)
     .text('3. 100% payment required against delivery.', 50, yPosition + 35)
     .text('4. Subject to Delhi Jurisdiction.', 50, yPosition + 45);

  // Signature Block (Right)
  doc.fillColor('#0f172a')
     .font('Helvetica-Bold')
     .fontSize(9)
     .text('For RD BEARING MILL & STORE', 360, yPosition, { align: 'right', width: 185 });

  doc.moveTo(370, yPosition + 55).lineTo(545, yPosition + 55).strokeColor('#94a3b8').lineWidth(0.5).stroke();

  doc.font('Helvetica')
     .fontSize(8)
     .fillColor('#64748b')
     .text('Authorized Signatory', 360, yPosition + 60, { align: 'right', width: 185 });

  // Finalize PDF
  doc.end();
};

module.exports = {
  generateQuotationPDF
};
