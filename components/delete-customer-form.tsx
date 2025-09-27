"use client";

import { Button } from "@/components/ui/button";

interface DeleteCustomerFormProps {
  customerId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteCustomerForm({ customerId, deleteAction }: DeleteCustomerFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("¿Eliminar este cliente?")) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteAction} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={customerId} />
      <Button variant="destructive" type="submit">Eliminar</Button>
    </form>
  );
}
