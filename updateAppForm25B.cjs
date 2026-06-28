const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes('Form25B')) {
  // Add import
  const importTarget = "const MultiCurrencyHub = lazy(() => import('./pages/MultiCurrencyHub'));";
  const importReplacement = "const MultiCurrencyHub = lazy(() => import('./pages/MultiCurrencyHub'));\nconst Form25B = lazy(() => import('./pages/Form25B'));";
  
  if (content.includes(importTarget)) {
    content = content.replace(importTarget, importReplacement);
  } else {
    // Fallback if MultiCurrencyHub isn't there for some reason
    content = content.replace(
      "const SalesPurchaseAnalysis = lazy(() => import('./pages/SalesPurchaseAnalysis'));",
      "const SalesPurchaseAnalysis = lazy(() => import('./pages/SalesPurchaseAnalysis'));\nconst Form25B = lazy(() => import('./pages/Form25B'));"
    );
  }

  // Add case
  const caseTarget = "case 'multi-currency':\n        return <MultiCurrencyHub />;";
  const caseReplacement = "case 'multi-currency':\n        return <MultiCurrencyHub />;\n      case 'form-25b':\n        return <Form25B />;\n      case 'form25b':\n        return <Form25B />;";
  
  if (content.includes(caseTarget)) {
    content = content.replace(caseTarget, caseReplacement);
  } else {
    // Fallback case
    content = content.replace(
      "case 'sales-purchase-analysis':\n        return <SalesPurchaseAnalysis />;",
      "case 'sales-purchase-analysis':\n        return <SalesPurchaseAnalysis />;\n      case 'form-25b':\n        return <Form25B />;\n      case 'form25b':\n        return <Form25B />;"
    );
  }

  fs.writeFileSync('src/App.tsx', content);
  console.log('Added Form25B to App.tsx');
} else {
  console.log('Form25B already exists in App.tsx');
}
