import { Controller, Get } from '@nestjs/common';
import { Public } from '@rvsk/common';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'rvsk6a',
      timestamp: new Date().toISOString(),
    };
  }
}
