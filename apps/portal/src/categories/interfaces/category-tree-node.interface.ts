export interface CategoryTreeNode {
  code: string;
  label: string;
  sortOrder: number;
  subCategories: { code: string; label: string; sortOrder: number }[];
}
