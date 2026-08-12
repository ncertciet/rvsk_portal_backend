export interface ErrorResponse {
  status: number;
  errorCode: string;
  message: string;
  traceId: string;
  timestamp: string;
}
