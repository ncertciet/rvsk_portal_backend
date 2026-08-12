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

    // Header row: State Code, then question texts in displayOrder
    const headers = ['State Code', ...questions.map((q) => q.questionText)];
    sheet.addRow(headers);

    // Data rows: one per response
    for (const response of responses) {
      const answers = await this.answerRepository.find({
        where: { responseId: response.id },
      });

      const row: string[] = [response.stateCode || ''];
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
      '"State Code"',
      ...questions.map((q) => `"${q.questionText.replace(/"/g, '""')}"`),
    ];
    let csv = headers.join(',') + '\n';

    // Data rows
    for (const response of responses) {
      const answers = await this.answerRepository.find({
        where: { responseId: response.id },
      });

      const row = [
        `"${response.stateCode || ''}"`,
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
}
