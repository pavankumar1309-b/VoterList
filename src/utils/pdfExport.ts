import { jsPDF } from 'jspdf';
import type { PublicVoterRecord } from '../types.ts';

export function downloadVoterPdf(
  voter: PublicVoterRecord,
  fileName: string,
  officerName: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Top Navy Header Bar
  doc.setFillColor(15, 41, 66); // #0F2942
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Subtle Saffron Accent Line
  doc.setFillColor(217, 119, 6); // #D97706
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Smart Voter Search', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Official Individual Voter Information Extract', margin, 20.5);

  doc.setFontSize(8.5);
  const generatedLabel = `Generated: ${new Date().toLocaleString()}`;
  doc.text(generatedLabel, pageWidth - margin, 20.5, { align: 'right' });

  // Source Metadata Block
  let y = 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SOURCE FILE:', margin + 4, y + 6.5);
  doc.text('WORKSHEET & ROW:', margin + 4, y + 13.5);
  doc.text('AUTHORIZED OFFICER:', margin + contentWidth / 2, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(fileName.slice(0, 40), margin + 29, y + 6.5);
  doc.text(`${voter.sheetName} · Row #${voter.excelRowNumber}`, margin + 39, y + 13.5);
  doc.text(officerName.slice(0, 34), margin + contentWidth / 2 + 37, y + 6.5);

  // Primary Name Heading
  y += 28;
  const primaryName =
    voter.summary.name ||
    Object.values(voter.fields).find((v) => v && v.trim().length > 0) ||
    'Voter Record';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 41, 66);
  doc.text(primaryName, margin, y);

  if (voter.summary.voterId) {
    y += 6;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`EPIC / Voter ID: ${voter.summary.voterId}`, margin, y);
  }

  // Table of All Excel Columns
  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 41, 66);
  doc.text('Complete Excel Record Fields', margin, y);
  y += 5;

  const col1Width = 58;
  const col2Width = contentWidth - col1Width;

  for (let i = 0; i < voter.headers.length; i++) {
    const header = voter.headers[i];
    const value = voter.fields[header] || '—';

    const labelLines = doc.splitTextToSize(header, col1Width - 6) as string[];
    const valueLines = doc.splitTextToSize(value, col2Width - 6) as string[];
    const rowLines = Math.max(labelLines.length, valueLines.length);
    const rowHeight = Math.max(8, rowLines * 4.8 + 3.5);

    if (y + rowHeight > pageHeight - 20) {
      doc.addPage();
      y = 18;
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');
    doc.line(margin + col1Width, y, margin + col1Width, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    doc.text(labelLines, margin + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(valueLines, margin + col1Width + 3, y + 5);

    y += rowHeight;
  }

  // Footer
  const footerY = pageHeight - 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Confidential electoral roll extract · Generated solely for authorized verification.',
    margin,
    footerY
  );

  const safeId = (voter.summary.voterId || `row_${voter.excelRowNumber}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`voter_record_${safeId}.pdf`);
}
