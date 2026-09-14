import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '@rvsk/common';

import { HomeService, HomeData } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /**
   * GET /api/v1/home
   * Returns aggregated home page data (counts of users, grievances, forms, etc.)
   * Filtered by the authenticated user's role and state scope.
   */
  @Get()
  async getHomeData(@CurrentUser() user: AuthenticatedUser): Promise<HomeData> {
    return this.homeService.getHomeData(user.userId, user.role, user.stateCode);
  }

  /**
   * GET /api/v1/home/super-admin
   * Frontend calls this for Super_Admin home page.
   */
  @Get('super-admin')
  async getSuperAdminHome(@CurrentUser() user: AuthenticatedUser): Promise<HomeData> {
    return this.homeService.getHomeData(user.userId, user.role, user.stateCode);
  }

  /**
   * GET /api/v1/home/rvsk-admin
   * Frontend calls this for RVSK_Admin home page.
   */
  @Get('rvsk-admin')
  async getRvskAdminHome(@CurrentUser() user: AuthenticatedUser): Promise<HomeData> {
    return this.homeService.getHomeData(user.userId, user.role, user.stateCode);
  }

  /**
   * GET /api/v1/home/state-admin
   * Frontend calls this for State_Admin home page.
   */
  @Get('state-admin')
  async getStateAdminHome(@CurrentUser() user: AuthenticatedUser): Promise<HomeData> {
    return this.homeService.getHomeData(user.userId, user.role, user.stateCode);
  }

  /**
   * GET /api/v1/home/spoc
   * Frontend calls this for RVSK_SPOC home page.
   */
  @Get('spoc')
  async getSpocHome(@CurrentUser() user: AuthenticatedUser): Promise<HomeData> {
    return this.homeService.getHomeData(user.userId, user.role, user.stateCode);
  }
}
