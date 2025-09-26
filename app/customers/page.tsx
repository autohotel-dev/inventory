import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getCustomers({ q, page, pageSize }: { q?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("customers")
    .select("id, name, tax_id, email, phone, address, is_active", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`name.ilike.${like},tax_id.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

async function deleteCustomerAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/customers");
}

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = searchParams?.q ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? 1));
  const pageSize = 10;
  const { rows: customers, count } = await getCustomers({ q, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button asChild>
          <Link href="/customers/new">New Customer</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/customers" method="get">
        <input
          type="text"
          name="q"
          placeholder="Search by Name, Tax ID, Email, Phone"
          defaultValue={q}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Tax ID</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Address</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.tax_id}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.address}</td>
                <td className="p-3 text-center">{c.is_active ? "✅" : "❌"}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" asChild>
                      <Link href={`/customers/${c.id}/edit`}>Edit</Link>
                    </Button>
                    <form action={deleteCustomerAction} onSubmit={(e) => {
                      if (!confirm("Delete this customer?")) e.preventDefault();
                    }}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button variant="destructive" type="submit">Delete</Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Total: {count}</div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild disabled={page <= 1}>
            <Link href={`/customers?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}>Prev</Link>
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="secondary" asChild disabled={page >= totalPages}>
            <Link href={`/customers?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
