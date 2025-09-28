import { toast } from "sonner";

export const useToast = () => {
  const success = (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
    });
  };

  const error = (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 6000,
    });
  };

  const info = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  };

  const warning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 5000,
    });
  };

  const loading = (message: string) => {
    return toast.loading(message);
  };

  const promise = <T,>(
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
  };

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
