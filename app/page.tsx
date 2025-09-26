import Link from "next/link";

export default function Home() {
  const links = [
    { href: "/products", label: "Products" },
    { href: "/categories", label: "Categories" },
    { href: "/warehouses", label: "Warehouses" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/customers", label: "Customers" },
    { href: "/movements", label: "Movements" },
    { href: "/stock", label: "Stock" },
    { href: "/purchases", label: "Purchases" },
    { href: "/sales", label: "Sales" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inventory Dashboard</h1>
      <p className="text-muted-foreground">Choose a module to get started.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="border rounded p-4 hover:bg-muted transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
