import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { FileStorageService } from '../storage/file-storage.service';
import { VskProfileDto } from './dto/vsk-profile.dto';
import { VskInfraDto } from './dto/vsk-infra.dto';
import { VskSoftwareDto } from './dto/vsk-software.dto';
import { VskPmuDto } from './dto/vsk-pmu.dto';

export interface VskPdfData {
  stateCode: string;
  stateName: string;
  profile: VskProfileDto | null;
  officers: Array<{
    officerRole: string;
    name: string;
    designation?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  }>;
  committeeMembers: Array<{
    name: string;
    designation?: string;
    phone?: string;
    email?: string;
  }>;
  infra: VskInfraDto | null;
  software: VskSoftwareDto | null;
  pmu: VskPmuDto | null;
}

// Theme colors (match the portal's purple accent)
const ACCENT = '#7C3AED';
const DARK = '#1E293B';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

/**
 * Generates the VSK Profile PDF with pdfkit. Pure Node (no headless browser),
 * so it produces a valid, openable PDF in any environment. Images are embedded
 * from local storage via {@link FileStorageService}; JPEG/PNG are supported by
 * pdfkit natively (other formats are skipped gracefully).
 */
@Injectable()
export class VskPdfService {
  private readonly logger = new Logger(VskPdfService.name);

  constructor(private readonly fileStorage: FileStorageService) {}

  async generate(data: VskPdfData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 48, right: 48 },
      bufferPages: true,
      info: {
        Title: `VSK Profile - ${data.stateName}`,
        Author: 'RVSK Portal',
        Subject: 'VSK State Profile',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.renderHeader(doc, data);
    this.renderProfile(doc, data);
    this.renderOfficers(doc, data);
    this.renderCommittee(doc, data);
    this.renderInfra(doc, data);
    this.renderSoftware(doc, data);
    this.renderPmu(doc, data);
    this.renderFooter(doc);

    doc.end();
    return done;
  }

  // ─── Sections ───────────────────────────────────────────────────────────────

  private renderHeader(doc: PDFKit.PDFDocument, data: VskPdfData) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    doc
      .fillColor(ACCENT)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(`${data.stateName} VSK`, left, 48, { width, align: 'left' });

    doc
      .fillColor(DARK)
      .fontSize(13)
      .font('Helvetica')
      .text('VSK Profile', { width });

    const submitted = (data.profile?.submissionStatus === 'SUBMITTED');
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .text(
        `State Code: ${data.stateCode}    Status: ${submitted ? 'Submitted' : 'Draft'}    Generated: ${this.fmtDate(new Date())}`,
        { width },
      );

    doc.moveTo(left, doc.y + 6).lineTo(left + width, doc.y + 6).lineWidth(1.5).strokeColor(ACCENT).stroke();
    doc.moveDown(1);
  }

  private renderProfile(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'VSK Address & Scheme');
    const p = data.profile;
    this.keyValueGrid(doc, [
      ['Address Line 1', p?.addressLine1],
      ['Address Line 2', p?.addressLine2],
      ['City', p?.city],
      ['Pincode', p?.pincode],
      ['Facilitated By', p?.facilitatedBy],
      ['Other Scheme', p?.otherSchemeName],
    ]);
  }

  private renderOfficers(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'Officers');
    const roleLabels: Record<string, string> = {
      SECRETARY: 'Secretary',
      SPD: 'SPD',
      NODAL_OFFICER: 'Nodal Officer',
    };
    const order = ['SECRETARY', 'SPD', 'NODAL_OFFICER'];
    const sorted = [...data.officers].sort(
      (a, b) => order.indexOf(a.officerRole) - order.indexOf(b.officerRole),
    );
    if (!sorted.length) {
      this.emptyNote(doc, 'No officers recorded.');
      return;
    }
    for (const o of sorted) {
      doc
        .fillColor(ACCENT)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(roleLabels[o.officerRole] || o.officerRole);
      this.keyValueGrid(doc, [
        ['Name', o.name],
        ['Designation', o.designation],
        ['Phone', o.phone],
        ['WhatsApp', o.whatsapp],
        ['Email', o.email],
      ]);
      doc.moveDown(0.3);
    }
  }

  private renderCommittee(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'Committee Members');
    if (!data.committeeMembers.length) {
      this.emptyNote(doc, 'No committee members added.');
      return;
    }
    this.table(
      doc,
      ['Name', 'Designation', 'Phone', 'Email'],
      data.committeeMembers.map((m) => [m.name || '-', m.designation || '-', m.phone || '-', m.email || '-']),
      [0.28, 0.28, 0.18, 0.26],
    );
  }

  private renderInfra(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'Infrastructure & Hardware');
    const i = data.infra;
    if (!i) {
      this.emptyNote(doc, 'No infrastructure data available.');
      return;
    }
    this.keyValueGrid(doc, [
      ['Room (L x W x H ft)', this.dims(i.roomLength, i.roomWidth, i.roomHeight)],
      ['Screen (L x H ft)', this.dims(i.screenLength, undefined, i.screenHeight)],
      ['Workstations', i.workstationCount != null ? String(i.workstationCount) : undefined],
    ]);
    this.imageRow(doc, [
      { label: 'Room', url: i.roomImageUrl },
      { label: 'Screen', url: i.screenImageUrl },
      { label: 'Workstation', url: i.workstationImageUrl },
    ]);
  }

  private renderSoftware(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'Software');
    const s = data.software;
    if (!s) {
      this.emptyNote(doc, 'No software data available.');
      return;
    }
    const starter = s.starterPack === 1 || s.starterPack === true;
    this.keyValueGrid(doc, [
      ['Starter Pack', starter ? 'Yes' : 'No'],
      ['Server Type', s.serverType],
    ]);
    if (s.items && s.items.length) {
      this.table(
        doc,
        ['Software Name', 'Type'],
        s.items.map((it) => [
          it.softwareName === 'Other' ? `${it.customSoftwareName || 'Other'} (Other)` : it.softwareName || '-',
          it.softwareType || '-',
        ]),
        [0.65, 0.35],
      );
    } else {
      this.emptyNote(doc, 'No software items added.');
    }
  }

  private renderPmu(doc: PDFKit.PDFDocument, data: VskPdfData) {
    this.sectionTitle(doc, 'PMU');
    const pmu = data.pmu;
    if (!pmu) {
      this.emptyNote(doc, 'No PMU data available.');
      return;
    }
    this.keyValueGrid(doc, [
      ['Team Type', pmu.pmuTeamType],
      ['Total Team Members', pmu.totalTeamMembers != null ? String(pmu.totalTeamMembers) : undefined],
    ]);
    if (pmu.roles && pmu.roles.length) {
      this.table(
        doc,
        ['Role', 'No. of Members'],
        pmu.roles.map((r) => [
          r.roleName === 'Other' ? `${r.customRoleName || 'Other'} (Other)` : r.roleName || '-',
          r.noOfMembers != null ? String(r.noOfMembers) : '-',
        ]),
        [0.7, 0.3],
      );
    }
  }

  private renderFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 40;
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(
          `RVSK Portal — VSK Profile    |    Page ${i - range.start + 1} of ${range.count}`,
          doc.page.margins.left,
          bottom,
          { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' },
        );
    }
  }

  // ─── Layout helpers ───────────────────────────────────────────────────────────

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 60);
    doc.moveDown(0.6);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    doc
      .fillColor(DARK)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(title, left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).lineWidth(0.75).strokeColor(LINE).stroke();
    doc.moveDown(0.5);
  }

  private keyValueGrid(doc: PDFKit.PDFDocument, pairs: Array<[string, string | undefined | null]>) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const colWidth = width / 2;
    const labelW = 110;
    let col = 0;
    let rowY = doc.y;

    for (const [label, value] of pairs) {
      this.ensureSpace(doc, 22);
      if (doc.y > rowY + 2 && col === 0) rowY = doc.y;
      const x = left + col * colWidth;
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(label, x, rowY, { width: labelW, continued: false });
      doc
        .fillColor(DARK)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(value != null && value !== '' ? String(value) : '-', x + labelW, rowY, {
          width: colWidth - labelW - 10,
        });
      const bottom = doc.y;
      if (col === 0) {
        col = 1;
        doc.y = rowY;
      } else {
        col = 0;
        doc.y = bottom;
        rowY = doc.y + 4;
        doc.y = rowY;
      }
    }
    if (col === 1) {
      // left a dangling single cell — move below it
      doc.moveDown(1);
    }
  }

  private table(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    weights: number[],
  ) {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const colX = (idx: number) => left + weights.slice(0, idx).reduce((a, w) => a + w * width, 0);
    const colW = (idx: number) => weights[idx] * width - 6;

    this.ensureSpace(doc, 30);
    // Header
    let y = doc.y;
    doc.rect(left, y, width, 18).fill('#F1F5F9');
    doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX(i) + 4, y + 5, { width: colW(i) }));
    y += 18;
    doc.y = y;

    // Rows
    doc.font('Helvetica').fontSize(8.5).fillColor(DARK);
    for (const row of rows) {
      const cellHeights = row.map((c, i) =>
        doc.heightOfString(c || '-', { width: colW(i) }),
      );
      const rowH = Math.max(16, ...cellHeights) + 6;
      this.ensureSpace(doc, rowH);
      y = doc.y;
      doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
      row.forEach((c, i) => {
        doc.fillColor(DARK).text(c || '-', colX(i) + 4, y + 4, { width: colW(i) });
      });
      doc.y = y + rowH;
    }
    doc.moveDown(0.5);
  }

  private imageRow(
    doc: PDFKit.PDFDocument,
    items: Array<{ label: string; url?: string | null }>,
  ) {
    const withImages = items.filter((it) => it.url);
    if (!withImages.length) return;

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const gap = 12;
    const boxW = (width - gap * (items.length - 1)) / items.length;
    const boxH = 90;

    this.ensureSpace(doc, boxH + 24);
    doc.moveDown(0.3);
    const top = doc.y;

    items.forEach((it, i) => {
      const x = left + i * (boxW + gap);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(it.label, x, top, { width: boxW });
      const imgTop = top + 12;
      const buf = this.loadImage(it.url);
      if (buf) {
        try {
          doc.image(buf, x, imgTop, { fit: [boxW, boxH], align: 'center', valign: 'center' });
        } catch (err) {
          this.logger.warn(`Could not embed image ${it.url}: ${(err as Error).message}`);
          this.imagePlaceholder(doc, x, imgTop, boxW, boxH, 'Unavailable');
        }
      } else {
        this.imagePlaceholder(doc, x, imgTop, boxW, boxH, it.url ? 'Unavailable' : 'No photo');
      }
    });
    doc.y = top + 12 + boxH + 8;
  }

  private imagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, label: string) {
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(LINE).stroke();
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(label, x, y + h / 2 - 4, { width: w, align: 'center' });
  }

  private emptyNote(doc: PDFKit.PDFDocument, text: string) {
    doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique').text(text);
    doc.font('Helvetica');
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
    const bottom = doc.page.height - doc.page.margins.bottom - 30;
    if (doc.y + needed > bottom) {
      doc.addPage();
    }
  }

  // ─── Data helpers ─────────────────────────────────────────────────────────────

  private loadImage(url?: string | null): Buffer | null {
    if (!url) return null;
    const rel = this.fileStorage.urlToRelative(url);
    if (!rel) return null;
    // Only JPEG/PNG are supported by pdfkit for embedding.
    if (!/\.(jpe?g|png)$/i.test(rel)) return null;
    return this.fileStorage.readRelative(rel);
  }

  private dims(a?: number | null, b?: number | null, c?: number | null): string | undefined {
    const parts = [a, b, c].filter((v) => v != null) as number[];
    if (!parts.length) return undefined;
    return parts.join(' x ');
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
