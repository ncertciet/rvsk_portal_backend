import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { FormResponse } from '../responses/entities/form-response.entity';
import { FormAnswer } from '../responses/entities/form-answer.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';

@Injectable()
export class FormExportService {
  constructor(
    @InjectRepository(FormResponse)
    private readonly responseRepository: Repository<FormResponse>,
    @InjectRepository(FormAnswer)
    private readonly answerRepository: Repository<FormAnswer>,
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
  ) {}

  async exportToExcel(formId: string): Promise<Buffer> {
    const questions = await this.questionRepository.find({
      where: { formId },
      order: { displayOrder: 'ASC' },
    });

    const responses = await this.responseRepository.find({
      where: { formId },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Responses');

    // Header row: State, then question texts in displayOrder
    const headers = ['State', ...questions.map((q) => q.questionText)];
    sheet.addRow(headers);

    // Resolve state names for the response state keys (one lookup).
    const stateNameByKey = await this.resolveStateNames(responses.map((r) => r.stateKey));

    // Data rows: one per response
    for (const response of responses) {
      const answers = await this.answerRepository.find({
        where: { responseId: response.id },
      });

      const row: string[] = [stateNameByKey.get(String(response.stateKey)) || String(response.stateKey || '')];
      for (const question of questions) {
        const answer = answers.find((a) => a.questionId === question.id);
        row.push(answer?.answerText || '');
      }
      sheet.addRow(row);
    }

    // Return as buffer
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exportToCsv(formId: string): Promise<string> {
    const questions = await this.questionRepository.find({
      where: { formId },
      order: { displayOrder: 'ASC' },
    });

    const responses = await this.responseRepository.find({
      where: { formId },
    });

    // Header row
    const headers = [
      '"State"',
      ...questions.map((q) => `"${q.questionText.replace(/"/g, '""')}"`),
    ];
    let csv = headers.join(',') + '\n';

    // Resolve state names for the response state keys.
    const stateNameByKey = await this.resolveStateNames(responses.map((r) => r.stateKey));

    // Data rows
    for (const response of responses) {
      const answers = await this.answerRepository.find({
        where: { responseId: response.id },
      });

      const stateLabel = stateNameByKey.get(String(response.stateKey)) || String(response.stateKey || '');
      const row = [
        `"${stateLabel.replace(/"/g, '""')}"`,
        ...questions.map((q) => {
          const answer = answers.find((a) => a.questionId === q.id);
          const val = answer?.answerText || '';
          return `"${val.replace(/"/g, '""')}"`;
        }),
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Resolve a map of state_key -> state_name for the given keys, so exports
   * show readable state names instead of bigint keys.
   */
  private async resolveStateNames(
    keys: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = Array.from(
      new Set(keys.filter((k): k is string => !!k && /^\d+$/.test(String(k))).map(String)),
    );
    const map = new Map<string, string>();
    if (unique.length === 0) return map;
    const rows = await this.responseRepository.manager.query(
      `SELECT state_key, state_name FROM rvsk_portal.vw_state_master WHERE state_key = ANY($1::bigint[])`,
      [unique],
    );
    for (const r of rows) map.set(String(r.state_key), r.state_name);
    return map;
  }
}
