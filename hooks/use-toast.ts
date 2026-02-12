import { toast } from "sonner";
import { useCallback } from "react";

const bigStyle = {
  fontSize: "1.2rem",
  fontWeight: "600" as const,
  padding: "20px 24px",
};

export const useToast = () => {
  const success = useCallback((message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 5000,
      style: bigStyle,
    });
  }, []);

  const error = useCallback((message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 8000,
      style: bigStyle,
    });
  }, []);

  const info = useCallback((message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 5000,
      style: bigStyle,
    });
  }, []);

  const warning = useCallback((message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 6000,
      style: bigStyle,
    });
  }, []);

  const loading = useCallback((message: string) => {
    return toast.loading(message, {
      style: bigStyle,
    });
  }, []);

  const promise = useCallback(<T,>(
    promise: Promise<T>,
    {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    });
  }, []);

  return {
    success,
    error,
    info,
    warning,
    loading,
    promise,
    dismiss: toast.dismiss,
  };
};
