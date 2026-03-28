const fs = require('fs');

const file = 'components/products/simple-products-table.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Búsqueda: "\{search\}"/g, 'Búsqueda: &quot;{search}&quot;');

fs.writeFileSync(file, content);
console.log('Fixed linting errors 2 in', file);
