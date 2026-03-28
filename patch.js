const fs = require('fs');

const file = 'components/products/simple-products-table.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      // Combinar datos y calcular información
      const enrichedProducts = (productsData || []).map(product => {
        // Calcular stock por almacén
        const productStock = stockData?.filter(s => s.product_id === product.id) || [];
        const totalStock = productStock.reduce((sum, s) => sum + (s.qty || 0), 0);`;

const replacementStr = `      // Pre-calcular stock por producto para evitar O(N^2)
      const stockByProductId = new Map<string, any[]>();
      if (stockData) {
        for (const stock of stockData) {
          if (!stockByProductId.has(stock.product_id)) {
            stockByProductId.set(stock.product_id, []);
          }
          stockByProductId.get(stock.product_id)!.push(stock);
        }
      }

      // Combinar datos y calcular información
      const enrichedProducts = (productsData || []).map(product => {
        // Calcular stock por almacén usando el mapa O(1)
        const productStock = stockByProductId.get(product.id) || [];
        const totalStock = productStock.reduce((sum, s) => sum + (s.qty || 0), 0);`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content);
console.log('Patched', file);
