throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');
const oldApp = require('child_process').execSync('git show HEAD:src/App.tsx').toString();

const lines = oldApp.split('\n');
const importLines = lines.filter(l => l.startsWith('import ') && l.includes('./'));

const reactImport = 'import React from "react";\nimport { useStore } from "./store/useStore";\nimport { ErrorBoundary } from "./components/ErrorBoundary";\n';

const renderStart = oldApp.indexOf('const renderContent = () => {');
const endMatch = oldApp.match(/default:[\s\S]*?\}\n\s*\}/);

let renderBody = '';
if (endMatch) {
  renderBody = oldApp.substring(renderStart, endMatch.index + endMatch[0].length);
}

const mainRouterCode = reactImport + importLines.join('\n') + '\n\nexport const MainRouter: React.FC = () => {\n  const { currentPage } = useStore();\n\n  ' + renderBody.replace('const renderContent = () => {', 'const renderContent = () => {') + '\n\n  return <>{renderContent()}</>;\n};\n';

fs.writeFileSync('src/MainRouter.tsx', mainRouterCode);
console.log('MainRouter.tsx created!');
