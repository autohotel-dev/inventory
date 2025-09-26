import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function createCategoryAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
  };

  const { error } = await supabase.from("categories").insert(payload);
  if (error) throw error;
  revalidatePath("/categories");
  redirect("/categories");
}

export default function NewCategoryPage() {
  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Category</h1>

      <form action={createCategoryAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>

        <div className="flex gap-3">
          <Button type="submit">Create</Button>
        </div>
      </form>
    </div>
  );
}
