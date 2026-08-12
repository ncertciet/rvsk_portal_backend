export interface MenuNode {
  moduleCode: string;
  moduleName: string;
  name: string; // alias for moduleName (frontend compatibility)
  icon: string;
  displayOrder: number;
  pages: MenuPageNode[];
}

export interface MenuPageNode {
  pageCode: string;
  pageName: string;
  name: string; // alias for pageName (frontend compatibility)
  routePath: string;
  icon: string;
  displayOrder: number;
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
}
