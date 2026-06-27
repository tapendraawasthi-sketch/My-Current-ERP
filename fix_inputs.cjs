throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');
let css = fs.readFileSync('src/styles.css', 'utf8');

// Fix focus state forcing all inputs to dark blue with white text
// Remove the aggressive focus rules that ruin bg-white inputs
css = css.replace(/input:focus, select:focus, textarea:focus \{[^\}]+\}/, '/* removed aggressive focus */');

// Add safe focus styles
css += '\n\n/* -- Safe Input Styles -- */\n';
css += 'input, select, textarea { color: #1e293b; }\n';
css += 'input.bg-white, select.bg-white, textarea.bg-white { color: #1e293b !important; }\n';
css += '.bg-white { color: #1e293b; }\n';

fs.writeFileSync('src/styles.css', css);
console.log('Fixed inputs in styles.css');
