import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SCHEME_CODES, TABLE_NAMES } from '../schemes/constants';

interface ReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

interface ReportError {
  error: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly schema: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.schema = this.configService.get<string>('SCHEMES_SCHEMA', 'WKSP_VSKDEV');
  }

  async generateReport(
    format: 'csv' | 'excel' | 'pdf',
    schemeCode: string,
  ): Promise<ReportResult | ReportError> {
    const tableName = this.getTableForScheme(schemeCode);
    if (!tableName) {
      return { error: `Unknown scheme: ${schemeCode}` };
    }

    const rows = await this.fetchSchemeData(tableName);

    switch (format) {
      case 'csv':
        return this.generateCsv(rows, schemeCode);
      case 'excel':
        return this.generateExcelPlaceholder(schemeCode);
      case 'pdf':
        return this.generatePdfPlaceholder(schemeCode);
      default:
        return { error: `Unsupported format: ${format}` };
    }
  }

  private async fetchSchemeData(tableName: string): Promise<any[]> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        const sql = `SELECT * FROM ${this.schema}.${tableName} WHERE ROWNUM <= 10000`;
        return await queryRunner.query(sql, []);
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      this.logger.error(`Report query failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generateCsv(rows: any[], schemeCode: string): ReportResult {
    if (!rows || rows.length === 0) {
      const buffer = Buffer.from('No data available', 'utf-8');
      return {
        buffer,
        contentType: 'text/csv',
        filename: `${schemeCode}_report.csv`,
      };
    }

    const headers = Object.keys(rows[0]);
    const csvLines: string[] = [headers.join(',')];

    for (const row of rows) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const strVal = String(val);
        // Escape CSV special characters
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      csvLines.push(values.join(','));
    }

    const csvString = csvLines.join('\n');
    const buffer = Buffer.from(csvString, 'utf-8');

    return {
      buffer,
      contentType: 'text/csv',
      filename: `${schemeCode}_report.csv`,
    };
  }

  private generateExcelPlaceholder(schemeCode: string): ReportResult {
    // Placeholder: Excel generation can be implemented with exceljs
    const buffer = Buffer.from(
      `Excel report for ${schemeCode} - implementation pending`,
      'utf-8',
    );
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${schemeCode}_report.xlsx`,
    };
  }

  private generatePdfPlaceholder(schemeCode: string): ReportResult {
    // Placeholder: PDF generation can be implemented with pdfkit or similar
    const buffer = Buffer.from(
      `PDF report for ${schemeCode} - implementation pending`,
      'utf-8',
    );
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${schemeCode}_report.pdf`,
    };
  }

  private getTableForScheme(schemeCode: string): string | null {
    const mapping: Record<string, string> = {
      [SCHEME_CODES.PM_SHRI]: TABLE_NAMES.PMSHRI,
      [SCHEME_CODES.PGI]: TABLE_NAMES.PGI,
      [SCHEME_CODES.NAS]: TABLE_NAMES.NAS,
      [SCHEME_CODES.UDISE_PLUS]: TABLE_NAMES.UDISE,
      [SCHEME_CODES.NIPUN_BHARAT]: TABLE_NAMES.NIPUN_CONTENT,
      [SCHEME_CODES.NCERT_QUIZ]: TABLE_NAMES.NCERT_QUIZ_STATE,
      [SCHEME_CODES.NCF]: TABLE_NAMES.NCF,
      [SCHEME_CODES.PRASHAST]: TABLE_NAMES.PRASHAST,
      [SCHEME_CODES.NISHTHA]: TABLE_NAMES.NISHTHA_PARTICIPANTS,
      [SCHEME_CODES.PM_POSHAN]: TABLE_NAMES.PM_POSHAN,
      [SCHEME_CODES.MICRO_IMPROVEMENT]: TABLE_NAMES.MICRO_IMPROVEMENTS_STATE,
      [SCHEME_CODES.DIKSHA_ETB]: TABLE_NAMES.DIKSHA_ETB_COVERAGE,
    };
    return mapping[schemeCode] || null;
  }
}
