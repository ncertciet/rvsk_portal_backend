import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

import { StateOverallStatus } from './vsk.service';

export interface AdminStateRow {
  stateCode: string;
  stateName: string;
  step1Status: string;
  step2Status: string;
  step3Status: string;
  step4Status: string;
  submissionStatus: string;
  overallStatus: StateOverallStatus;
  completedSteps: number;
  totalSteps: number;
  hasProfile: boolean;
  hasInfra: boolean;
  hasSoftware: boolean;
  hasPmu: boolean;
  hasSecretary: boolean;
  completedSections: number;
  totalSections: number;
  updatedAt?: string;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  SUBMITTED: 'Submitted',
  COMPLETE: 'Complete',
  DRAFT: 'Draft',
  PENDING: 'Pending',
};

/**
 * Builds the VSK admin "Export to Excel" workbook using exceljs. Produces a
 * genuine .xlsx (not a stub buffer), with a styled header row, sensible column
 * widths, and human-readable status labels.
 */
@Injectable()
export class VskExportService {
  async buildStatesWorkbook(rows: AdminStateRow[]): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'RVSK Portal';
    wb.created = new Date();

    const ws = wb.addWorksheet('State VSK Progress', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'S.No', key: 'sno', width: 6 },
      { header: 'State Code', key: 'stateCode', width: 12 },
      { header: 'State / UT', key: 'stateName', width: 28 },
      { header: 'Overall Status', key: 'overallStatus', width: 16 },
      { header: 'Steps Completed', key: 'completed', width: 16 },
      { header: 'Officers (Step 1)', key: 'step1', width: 16 },
      { header: 'Infrastructure (Step 2)', key: 'step2', width: 20 },
      { header: 'Software (Step 3)', key: 'step3', width: 18 },
      { header: 'PMU (Step 4)', key: 'step4', width: 16 },
      { header: 'Secretary On Record', key: 'secretary', width: 18 },
      { header: 'Submission', key: 'submission', width: 14 },
      { header: 'Last Updated', key: 'updatedAt', width: 20 },
    ];

    // Header styling
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    rows.forEach((r, idx) => {
      const row = ws.addRow({
        sno: idx + 1,
        stateCode: r.stateCode,
        stateName: r.stateName,
        overallStatus: this.label(r.overallStatus),
        completed: `${r.completedSteps} / ${r.totalSteps}`,
        step1: this.label(r.step1Status),
        step2: this.label(r.step2Status),
        step3: this.label(r.step3Status),
        step4: this.label(r.step4Status),
        secretary: r.hasSecretary ? 'Yes' : 'No',
        submission: this.label(r.submissionStatus),
        updatedAt: this.fmtDate(r.updatedAt),
      });

      // Zebra striping
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }

      // Color the overall-status cell
      const statusCell = row.getCell('overallStatus');
      statusCell.font = { bold: true, color: { argb: this.statusColor(r.overallStatus) } };
      statusCell.alignment = { horizontal: 'center' };

      row.getCell('sno').alignment = { horizontal: 'center' };
      row.getCell('stateCode').alignment = { horizontal: 'center' };
      row.getCell('completed').alignment = { horizontal: 'center' };
      row.getCell('secretary').alignment = { horizontal: 'center' };
    });

    if (!rows.length) {
      ws.addRow({ stateName: 'No states have started a VSK profile yet.' });
    }

    ws.autoFilter = { from: 'A1', to: 'L1' };

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private label(value?: string): string {
    if (!value) return '-';
    return STATUS_LABELS[value.toUpperCase()] || value;
  }

  private statusColor(status: StateOverallStatus): string {
    switch (status) {
      case 'SUBMITTED':
      case 'COMPLETED':
        return 'FF16A34A'; // green
      case 'IN_PROGRESS':
        return 'FFD97706'; // amber
      default:
        return 'FF64748B'; // slate
    }
  }

  private fmtDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
