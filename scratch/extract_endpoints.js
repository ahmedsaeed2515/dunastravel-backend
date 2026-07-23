const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../src/modules');

function parseControllers(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      parseControllers(filePath, fileList);
    } else if (file.endsWith('.controller.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const controllers = parseControllers(modulesDir);
let markdown = '# Dunas Travel Backend - API Endpoint Inventory\n\n';

for (const file of controllers) {
  const content = fs.readFileSync(file, 'utf-8');
  const controllerNameMatch = content.match(/export class (\w+)Controller/);
  const controllerName = controllerNameMatch ? controllerNameMatch[1] : 'Unknown';
  
  const basePathMatch = content.match(/@Controller\(['"]([^'"]+)['"]\)/);
  const basePath = basePathMatch ? basePathMatch[1] : '';

  markdown += `## ${controllerName} Controller\n\n`;
  markdown += `| Method | URL | Authentication | Roles | Description |\n`;
  markdown += `|---|---|---|---|---|\n`;

  const regex = /@(Get|Post|Patch|Put|Delete)\(['"]([^'"]*)['"]\)([\s\S]*?)async\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const fullPath = `/${basePath}${routePath ? '/' + routePath : ''}`.replace(/\/\//g, '/');
    const decorators = match[3];

    let auth = 'None';
    if (decorators.includes('@UseGuards(JwtAuthGuard)') || content.includes(`@UseGuards(JwtAuthGuard)`)) {
      auth = 'JWT';
    }
    if (decorators.includes('@Public()')) {
      auth = 'Public';
    }

    const rolesMatch = decorators.match(/@Roles\((.*?)\)/);
    const roles = rolesMatch ? rolesMatch[1].replace(/UserRole\./g, '') : 'None';

    const descMatch = decorators.match(/@ApiOperation\(\{.*summary:\s*['"]([^'"]+)['"]/);
    const desc = descMatch ? descMatch[1] : '';

    markdown += `| ${method} | \`${fullPath}\` | ${auth} | ${roles} | ${desc} |\n`;
  }
  markdown += '\n';
}

fs.writeFileSync(path.join(__dirname, '../../docs/runtime/API_ENDPOINT_INVENTORY.md'), markdown);
console.log('Generated docs/runtime/API_ENDPOINT_INVENTORY.md');
