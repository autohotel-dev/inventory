import { apiClient } from "@/lib/api/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getCategory(id: string) {
  const { apiClient } = await import("@/lib/api/client");
  try {
    const { data } = await apiClient.get(`/system/crud/categories/${id}`);
    return data;
  } catch (e) {
    return null;
  }
}

async function updateCategoryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
  };
  const { error } = await apiClient.patch(`/system/crud/categories/${id}`, payload) as any;
  if (error) throw error;
  revalidatePath("/categories");
  redirect("/categories");
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const category = await getCategory(resolvedParams.id).catch(() => null);
  if (!category) return notFound();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Edit Category</h1>

      <form action={updateCategoryAction} className="space-y-4">
        <input type="hidden" name="id" defaultValue={category.id} />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={category.name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" defaultValue={category.description ?? ""} />
        </div>

        <div className="flex gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}
