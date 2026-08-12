export interface EffectivePermission {
  pageId: string;
  pageCode: string;
  pageName: string;
  routePath: string;
  moduleCode: string;
  moduleName: string;
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
}

export interface PermissionSet {
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
}

export interface PermissionOverride {
  canView?: boolean | null;
  canEdit?: boolean | null;
  canExport?: boolean | null;
  canDelete?: boolean | null;
}

export interface RolePageDefaultDto {
  id: string;
  role: string;
  pageId: string;
  pageCode: string;
  pageName: string;
  moduleId: string;
  moduleCode: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canExport: boolean;
    canDelete: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserOverrideDto {
  id: string;
  userId: string;
  pageId: string;
  pageCode: string;
  pageName: string;
  moduleId: string;
  moduleCode: string;
  override: {
    canView: boolean | null;
    canEdit: boolean | null;
    canExport: boolean | null;
    canDelete: boolean | null;
  };
  updatedBy: string;
  updatedAt: string | null;
}
