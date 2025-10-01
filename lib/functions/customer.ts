import { createClient } from "@/lib/supabase/client";
import { Customer, CustomerSales } from "@/lib/types/inventory";

export async function getCustomer(id: string): Promise<Customer | null> {
    const supabase = createClient();
    console.log("Ver el ID: ", id);

    const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (customersError) {
        console.error('Error fetching customer:', customersError);
        console.log(customersError)
        return null;
    }

    return customersData as Customer;
}

export async function getCustomers() : Promise<Customer[]> {
    const supabase = createClient();

    const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*");

    if (customersError) {
        console.error('Error fetching customers:', customersError);
        console.log(customersError)
        return [];
    }

    return customersData as Customer[];
}

export async function getCustomerSales(customerId: string): Promise<CustomerSales[]> {
    const supabase = await createClient();

    const { data: customerSalesData, error: customerSalesError } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("customer_id", customerId);

    if (customerSalesError) {
        console.error('Error fetching customer sales:', customerSalesError);
        console.log(customerSalesError)
        return [];
    }

    return customerSalesData as CustomerSales[];
}