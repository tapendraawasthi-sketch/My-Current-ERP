throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');

// Sidebar.tsx
let sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(/#1e3060/g, '#357ABD'); // hover bg
sidebar = sidebar.replace(/#0f1b35/g, '#357ABD'); // dark accents
sidebar = sidebar.replace(/#475c8a/g, '#E6F2FF'); // group title
sidebar = sidebar.replace(/#60a5fa/g, '#F08A2C'); // active icon
sidebar = sidebar.replace(/#2d4070/g, '#E6F2FF'); // version text
sidebar = sidebar.replace(/#3b82f6/g, '#F08A2C'); // active item indicator
fs.writeFileSync('src/components/Sidebar.tsx', sidebar);

console.log('Fixed Sidebar');
