const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('api-inventory.json', 'utf8'));

let md = `# Phase 2: Complete API Discovery

This report inventories all 88 discovered endpoints across the Dunas Travel backend.

| Module | Controller | Method | Route | Action |
|---|---|---|---|---|
`;

inventory.forEach(api => {
  md += `| ${api.module} | ${api.controller} | ${api.method} | \`${api.route}\` | ${api.action} |\n`;
});

fs.writeFileSync('C:/Users/Ahmed Saeed/.gemini/antigravity/brain/43e836e5-2008-4fd7-bb63-8fdbe915ea8a/phase2_api_inventory.md', md);
console.log('Markdown generated');
