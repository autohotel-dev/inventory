const fs = require('fs');
const file = 'components/customers/advanced-customers-table.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const stats = statsData\?\.find\(\(s: any\) => s\.customer_id === customer\.id\);/g,
  'const stats = statsData?.find((s: CustomerStatistics) => s.customer_id === customer.id);'
);

fs.writeFileSync(file, content);
