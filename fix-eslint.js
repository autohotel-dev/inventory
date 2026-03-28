const fs = require('fs');

const file = 'components/products/simple-products-table.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix unescaped entities
content = content.replace(/\{search\ ?\?\ `"([^"]+)"`\ :\ ""\}/g, '{search ? `"${search}"` : ""}');
content = content.replace(/Resultados para "([^"]+)"/g, 'Resultados para &quot;$1&quot;');

fs.writeFileSync(file, content);
console.log('Fixed linting errors in', file);
