"use client";

import { Button } from "@/components/ui/button";

interface DeleteWarehouseFormProps {
  warehouseId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteWarehouseForm({ warehouseId, deleteAction }: DeleteWarehouseFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("Delete this warehouse?")) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteAction} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={warehouseId} />
      <Button variant="destructive" type="submit">Delete</Button>
    </form>
  );
}
