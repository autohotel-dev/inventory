import re

with open('/home/ricardominor/Documentos/Desarrollos/inventory/frontend/hooks/use-valet-actions.ts', 'r') as f:
    content = f.read()

# Remove import
content = content.replace("import { createClient } from '@/lib/supabase/client';", "")

# Replace all const supabase = createClient();
content = content.replace("        const supabase = createClient();\n", "")

# 1. handleRegisterVehicleAndPayment
content = re.sub(
    r"const { data: currentStay, error: checkError } = await supabase.*?\.select\('valet_employee_id'\).*?;.*?;",
    "const { data: currentStay } = await apiClient.get(`/system/crud/room_stays/${activeStay.id}`) as any;",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { error: stayError } = await supabase.*?\.from\('room_stays'\).*?\.update\({(.*?)}\).*?;.*?if \(stayError\).*?throw stayError;",
    r"await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {\1});",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { data: session } = await supabase.*?\.from\('shift_sessions'\).*?\.select\('id'\).*?\.maybeSingle\(\);",
    "const { data: authData } = await apiClient.get('/system/auth/me') as any;\n            const session = authData?.session;",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { data: pendingMain, error: pendingMainError } = await supabase.*?\.from\('payments'\).*?\.select\('id, amount'\).*?\.is\('parent_payment_id', null\).*?\.maybeSingle\(\);.*?if \(pendingMainError\) throw pendingMainError;",
    r"const { data: pendingMains } = await apiClient.get('/system/crud/payments', { params: { sales_order_id: activeStay.sales_order_id, status: 'PENDIENTE', parent_payment_id: 'null' } }) as any;\n            const pendingMain = pendingMains && pendingMains.length > 0 ? pendingMains[0] : null;",
    content, flags=re.DOTALL
)

# 2. handleConfirmCheckout
content = re.sub(
    r"const { error } = await supabase.*?\.from\('room_stays'\).*?\.update\({(.*?)}\).*?;.*?if \(error\).*?throw error;",
    r"await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {\1});",
    content, flags=re.DOTALL
)

# 4. handleAcceptEntry
content = re.sub(
    r"const { error } = await supabase.*?\.from\('room_stays'\).*?\.update\({ valet_employee_id: valetId }\).*?;.*?if \(error\) throw error;",
    r"await apiClient.patch(`/system/crud/room_stays/${stayId}`, { valet_employee_id: valetId });",
    content, flags=re.DOTALL
)

# 5. handleAcceptConsumption
content = re.sub(
    r"const { error } = await supabase.*?\.from\('sales_order_items'\).*?\.update\({(.*?)}\).*?;.*?if \(error\) throw error;",
    r"await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {\1});",
    content, flags=re.DOTALL
)

# 6. handleAcceptAllConsumptions
content = re.sub(
    r"const { error } = await supabase.*?\.from\('sales_order_items'\).*?\.update\({(.*?)}\).*?\.in\('id', itemIds\);.*?if \(error\) throw error;",
    r"await Promise.all(itemIds.map(id => apiClient.patch(`/system/crud/sales_order_items/${id}`, {\1})));",
    content, flags=re.DOTALL
)

# 7. handleConfirmDelivery
content = re.sub(
    r"const { data: itemData, error: fetchError } = await supabase.*?\.from\('sales_order_items'\).*?\.select\('sales_order_id, total'\).*?;.*?if \(fetchError\) throw fetchError;",
    r"const { data: itemData } = await apiClient.get(`/system/crud/sales_order_items/${consumptionId}`) as any;",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { error: updateError } = await supabase.*?\.from\('sales_order_items'\).*?\.update\(updateData\).*?;.*?if \(updateError\) throw updateError;",
    r"await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, updateData);",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { data: itemStay } = await supabase.*?\.from\('sales_order_items'\).*?\.select\('sales_orders!inner\(room_stays!inner\(id\)\)'\).*?\.maybeSingle\(\);",
    r"const { data: itemFull } = await apiClient.get(`/system/crud/sales_order_items/${consumptionId}`) as any;\n            const { data: orders } = await apiClient.get('/system/crud/room_stays', { params: { sales_order_id: itemFull.sales_order_id } }) as any;\n            const itemStay = orders && orders.length > 0 ? { sales_orders: { room_stays: [{ id: orders[0].id }] } } : null;",
    content, flags=re.DOTALL
)

# 9. handleCancelConsumption
content = re.sub(
    r"const { error } = await supabase.*?\.from\('sales_order_items'\).*?\.update\({(.*?)}\).*?;.*?if \(error\) throw error;",
    r"await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {\1});",
    content, flags=re.DOTALL
)

# 10, 11, 12 handleReportDamage, etc
content = re.sub(
    r"const { error: itemError, data: item } = await supabase.*?\.from\('sales_order_items'\).*?\.insert\({(.*?)}\).*?\.select\(\).*?;.*?if \(itemError\) throw itemError;",
    r"const { data: item } = await apiClient.post('/system/crud/sales_order_items', {\1}) as any;",
    content, flags=re.DOTALL
)

content = re.sub(
    r"const { data: item, error: itemError } = await supabase.*?\.from\('sales_order_items'\).*?\.insert\({(.*?)}\).*?\.select\(\).*?;.*?if \(itemError\) throw itemError;",
    r"const { data: item } = await apiClient.post('/system/crud/sales_order_items', {\1}) as any;",
    content, flags=re.DOTALL
)

with open('/home/ricardominor/Documentos/Desarrollos/inventory/frontend/hooks/use-valet-actions.ts', 'w') as f:
    f.write(content)
