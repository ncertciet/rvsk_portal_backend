import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '@rvsk/common';
import { MenuService, MenuNode } from './menu.service';

@Controller('api/v1/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * GET /api/v1/menu
   * Returns the menu tree as an array (backward compatible).
   */
  @Get()
  async getMenuTree(@CurrentUser() user: AuthenticatedUser): Promise<MenuNode[]> {
    return this.menuService.getMenuTree(user.userId, user.role);
  }

  /**
   * GET /api/v1/menu/tree
   * Returns the menu tree wrapped in { modules: [...] } format expected by the frontend.
   */
  @Get('tree')
  async getMenuTreeWrapped(@CurrentUser() user: AuthenticatedUser): Promise<{ modules: MenuNode[] }> {
    const modules = await this.menuService.getMenuTree(user.userId, user.role);
    return { modules };
  }
}
