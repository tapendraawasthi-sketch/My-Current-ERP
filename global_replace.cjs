const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

let allFiles = [];
directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    allFiles = walkSync(dir, allFiles);
  }
});

const redColors = /#cc3d2a|#dc2626|#ef4444|#b91c1c|#f87171|#cc0000/gi;
const greenColors = /#16a34a|#22c55e|#15803d|#006600|#059669/gi;
const blueColors = /#1557b0|#3b6fb8|#1d4ed8|#2563eb/gi;
const orangeColors = /#f08a2c|#fb923c|#f97316/gi;

let changedFilesCount = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Colors in style objects or Recharts props
  // We'll replace the hex string directly if it looks like a color property
  content = content.replace(new RegExp(`(color|background|backgroundColor|fill|stroke|border|borderBottom|borderTop|borderLeft|borderRight):\\s*(['"])(.*?)\\2`, 'gi'), (match, prop, quote, val) => {
    let newVal = val;
    if (val.match(redColors)) newVal = 'var(--color-negative)';
    else if (val.match(greenColors)) newVal = 'var(--color-positive)';
    else if (val.match(blueColors)) newVal = 'var(--color-accent)';
    else if (val.match(orangeColors)) newVal = 'var(--color-warning)';
    
    // #d4d0c8 removal
    if (val.toLowerCase() === '#d4d0c8' || val.toLowerCase() === 'transparent') {
        // Just return as is for transparent, but for d4d0c8 maybe map to something or remove
        if (val.toLowerCase() === '#d4d0c8') return `${prop}: ${quote}var(--color-surface-raised)${quote}`;
    }

    if (newVal !== val) {
      return `${prop}: ${quote}${newVal}${quote}`;
    }
    return match;
  });

  // Recharts specific props fill="#hex" stroke="#hex"
  content = content.replace(/(fill|stroke)=(["'])(#[a-fA-F0-9]{3,8})\2/gi, (match, prop, quote, hex) => {
    let newVal = hex;
    if (hex.match(redColors)) newVal = 'var(--color-negative)';
    else if (hex.match(greenColors)) newVal = 'var(--color-positive)';
    else if (hex.match(blueColors)) newVal = 'var(--color-accent)';
    else if (hex.match(orangeColors)) newVal = 'var(--color-warning)';
    
    if (newVal !== hex) return `${prop}=${quote}${newVal}${quote}`;
    return match;
  });

  // 2. Fonts
  content = content.replace(/fontFamily:\s*['"](?:'Courier New', Courier, monospace|Courier New|Courier|monospace)['"]/gi, "fontFamily: 'var(--font-mono)'");
  content = content.replace(/fontFamily:\s*['"](?:Tahoma|MS Sans Serif|Microsoft Sans Serif)['"],?\s*/gi, "");
  
  // 3. Borders inset/outset
  content = content.replace(/border(Style)?:\s*['"](?:outset|inset)['"],?\s*/gi, "");
  content = content.replace(/border:\s*['"][^'"]*(?:outset|inset)[^'"]*['"],?\s*/gi, "");
  
  // 4. Focus states removing
  content = content.replace(/(?:e\.currentTarget|e\.target)\.style\.(?:background|backgroundColor)\s*=\s*['"]#000000['"];?/g, "");
  content = content.replace(/(?:e\.currentTarget|e\.target)\.style\.color\s*=\s*['"]#ffffff['"];?/g, "");

  // 5. Hardcoded raw JSX badges
  // e.g. <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">Posted</span>
  // This is a bit complex, we'll look for variations
  const badgeRegex = /<span\s+className=['"](?:[^'"]*)bg-(?:green|red|amber|blue|gray|yellow)-[15]00\s+text-(?:green|red|amber|blue|gray|yellow)-[789]00(?:[^'"]*)['"]>([^<]+)<\/span>/gi;
  content = content.replace(badgeRegex, (match, text) => {
    let statusClass = "badge-neutral";
    const t = text.trim().toLowerCase();
    if (t === "posted" || t === "approved" || t === "active" || t === "paid" || t === "success") statusClass = "badge-posted";
    else if (t === "draft" || t === "pending" || t === "warning") statusClass = "badge-draft";
    else if (t === "cancelled" || t === "rejected" || t === "inactive" || t === "unpaid" || t === "failed") statusClass = "badge-cancelled";
    else if (t === "partial") statusClass = "badge-partial";
    else if (t === "info") statusClass = "badge-info";
    
    return `<span className="badge ${statusClass}">${text}</span>`;
  });

  // Dynamic badges using switch/ternary
  // e.g. status === "Posted" ? "bg-green-100 text-green-800" : ...
  // We'll replace the class strings directly if they look like status colors
  content = content.replace(/['"`](?:bg-(?:green|red|amber|blue|gray|yellow)-[15]00\s+text-(?:green|red|amber|blue|gray|yellow)-[789]00)[^'"`]*['"`]/gi, (match) => {
      // Just returning the match for now to avoid breaking dynamic logic, unless we can parse it.
      // Actually, if they are using Badge component, we don't need this.
      return match;
  });

  // Cleanup empty styles
  content = content.replace(/style=\{\{\s*\}\}/g, "");
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    changedFilesCount++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`\nCompleted. Modified ${changedFilesCount} files.`);
