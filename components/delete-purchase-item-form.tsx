"use client";

import { Button } from "@/components/ui/button";

interface DeletePurchaseItemFormProps {
  itemId: string;
  orderId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeletePurchaseItemForm({ itemId, orderId, deleteAction }: DeletePurchaseItemFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("¿Eliminar este artículo?")) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteAction} onSubmit={handleSubmit}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Button variant="destructive" type="submit" size="sm">Eliminar</Button>
    </form>
  );
}
