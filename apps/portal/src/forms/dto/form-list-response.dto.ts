export class FormListResponse {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null = null;
  createdDate: Date;
  questionCount: number;
}
