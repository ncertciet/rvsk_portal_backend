import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { Public } from '@rvsk/common';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Public()
  @Post('generate')
  async generateReport(
    @Body() body: { format: 'csv' | 'excel' | 'pdf'; schemeCode: string },
    @Res() res: Response,
  ) {
    const { format, schemeCode } = body;

    const result = await this.reportsService.generateReport(format, schemeCode);

    if ('error' in result) {
      return res.status(400).json({
        success: false,
        timestamp: new Date().toISOString(),
        data: result,
      });
    }

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return res.send(result.buffer);
  }

  @Public()
  @Get('formats')
  getFormats() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: { formats: ['csv', 'excel', 'pdf'] },
    };
  }
}
