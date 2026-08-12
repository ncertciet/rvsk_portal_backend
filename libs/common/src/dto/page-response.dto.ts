export class PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;

  constructor(content: T[], totalElements: number, page: number, size: number) {
    this.content = content;
    this.totalElements = totalElements;
    this.page = page;
    this.size = size;
    this.totalPages = Math.ceil(totalElements / size);
  }
}
