export class FormDetailResponse {
  id: string;
  title: string;
  description: string | null = null;
  instructions: string | null = null;
  status: string;
  dueDate: Date | null = null;
  publishDate: Date | null = null;
  createdBy: string;
  createdDate: Date;
  updatedBy: string | null = null;
  updatedDate: Date;
  questionCount: number;
}
