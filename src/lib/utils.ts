import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiResponse } from '@/types/api';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class ApiError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    if (fieldErrors && Object.keys(fieldErrors).length) {
      this.fieldErrors = fieldErrors;
    }
  }
}

function extractFieldErrors(error: unknown): Record<string, string> {
  const errors = (error as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
  if (!Array.isArray(errors)) return {};
  const out: Record<string, string> = {};
  for (const e of errors) {
    const path = (e as { path?: unknown })?.path;
    const message = (e as { message?: unknown })?.message;
    const key = Array.isArray(path) ? path[0] : undefined;
    if (typeof key === 'string' && typeof message === 'string' && !out[key]) {
      out[key] = message;
    }
  }
  return out;
}

export async function handleApiCall<T>(
  apiCall: () => Promise<{ data: ApiResponse<T> }>,
  successMessage?: string
): Promise<T> {
  try {
    const { data } = await apiCall();
    if (!data.data) throw new Error(data.message || "Unexpected server response");
    if (successMessage) {
      toast.success(successMessage);
    }
    return data.data;
  } catch (error: unknown) {
    const errObj = error as { response?: { data?: { message?: string } }; message?: string };
    const errMessage =
      errObj?.response?.data?.message ||
      errObj?.message ||
      "An unexpected error occurred.";
    const fieldErrors = extractFieldErrors(error);
    if (!Object.keys(fieldErrors).length) {
      toast.error(errMessage);
    }
    throw new ApiError(errMessage, fieldErrors);
  }
}
