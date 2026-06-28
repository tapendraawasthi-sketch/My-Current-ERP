const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes('MultiCurrencyHub')) {
  // Add import
  const importTarget = "const SalesPurchaseAnalysis = lazy(() => import('./pages/SalesPurchaseAnalysis'));";
  const importReplacement = "const SalesPurchaseAnalysis = lazy(() => import('./pages/SalesPurchaseAnalysis'));\nconst MultiCurrencyHub = lazy(() => import('./pages/MultiCurrencyHub'));";
  content = content.replace(importTarget, importReplacement);

  // Add case
  const caseTarget = "case 'sales-purchase-analysis':\n        return <SalesPurchaseAnalysis />;";
  const caseReplacement = "case 'sales-purchase-analysis':\n        return <SalesPurchaseAnalysis />;\n      case 'multi-currency':\n        return <MultiCurrencyHub />;";
  content = content.replace(caseTarget, caseReplacement);

  fs.writeFileSync('src/App.tsx', content);
  console.log('Added MultiCurrencyHub to App.tsx');
} else {
  console.log('MultiCurrencyHub already exists in App.tsx');
}
