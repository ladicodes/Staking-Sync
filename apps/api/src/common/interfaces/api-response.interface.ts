export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiErrorDetail[];
  requestId?: string;
}
