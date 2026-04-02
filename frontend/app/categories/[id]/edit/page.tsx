import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getCategory(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function updateCategoryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
  };
  const { error } = await supabase.from("categories").update(payload).eq("id", id);
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
