import { performance } from "perf_hooks";

// Mock data generation
const numProducts = 5000;
const numStockItems = 15000;

const productsData = Array.from({ length: numProducts }).map((_, i) => ({
  id: `prod_${i}`,
  price: Math.random() * 100,
  cost: Math.random() * 50,
  min_stock: Math.floor(Math.random() * 10),
}));

const stockData = Array.from({ length: numStockItems }).map((_, i) => ({
  product_id: `prod_${Math.floor(Math.random() * numProducts)}`,
  qty: Math.floor(Math.random() * 100),
}));

// Baseline approach (Current code)
function runBaseline() {
  const start = performance.now();

  const enrichedProducts = (productsData || []).map(product => {
    const productStock = stockData?.filter(s => s.product_id === product.id) || [];
    const totalStock = productStock.reduce((sum, s) => sum + (s.qty || 0), 0);

    const inventoryValue = totalStock * product.price;
    const profitMargin = product.cost > 0 ? ((product.price - product.cost) / product.cost) * 100 : 0;

    let stockStatus = 'normal';
    if (totalStock === 0) stockStatus = 'critical';
    else if (totalStock <= product.min_stock) stockStatus = 'low';
    else if (totalStock > product.min_stock * 3) stockStatus = 'high';

    return {
      ...product,
      totalStock,
      stockByWarehouse: productStock,
      inventoryValue,
      profitMargin,
      stockStatus
    };
  });

  const end = performance.now();
  return { time: end - start, resultSize: enrichedProducts.length };
}

// Optimized approach
function runOptimized() {
  const start = performance.now();

  // Group stock data by product_id
  const stockByProductId = new Map<string, typeof stockData>();
  if (stockData) {
    for (const stock of stockData) {
      if (!stockByProductId.has(stock.product_id)) {
        stockByProductId.set(stock.product_id, []);
      }
      stockByProductId.get(stock.product_id)!.push(stock);
    }
  }

  const enrichedProducts = (productsData || []).map(product => {
    const productStock = stockByProductId.get(product.id) || [];
    const totalStock = productStock.reduce((sum, s) => sum + (s.qty || 0), 0);

    const inventoryValue = totalStock * product.price;
    const profitMargin = product.cost > 0 ? ((product.price - product.cost) / product.cost) * 100 : 0;

    let stockStatus = 'normal';
    if (totalStock === 0) stockStatus = 'critical';
    else if (totalStock <= product.min_stock) stockStatus = 'low';
    else if (totalStock > product.min_stock * 3) stockStatus = 'high';

    return {
      ...product,
      totalStock,
      stockByWarehouse: productStock,
      inventoryValue,
      profitMargin,
      stockStatus
    };
  });

  const end = performance.now();
  return { time: end - start, resultSize: enrichedProducts.length };
}

// Warm up
runBaseline();
runOptimized();

let baselineTotal = 0;
let optimizedTotal = 0;
const iterations = 5;

for (let i = 0; i < iterations; i++) {
  baselineTotal += runBaseline().time;
  optimizedTotal += runOptimized().time;
}

const baselineAvg = baselineTotal / iterations;
const optimizedAvg = optimizedTotal / iterations;

console.log(`Baseline average time: ${baselineAvg.toFixed(2)} ms`);
console.log(`Optimized average time: ${optimizedAvg.toFixed(2)} ms`);
console.log(`Improvement: ${(baselineAvg / optimizedAvg).toFixed(2)}x faster`);
