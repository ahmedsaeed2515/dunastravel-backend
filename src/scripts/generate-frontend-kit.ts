import * as fs from 'fs';
import * as path from 'path';

const DOCS_DIR = path.join(__dirname, '../../../docs/frontend-api');
const SWAGGER_PATH = path.join(__dirname, '../../swagger-spec.json');
const TRAFFIC_PATH = path.join(__dirname, '../../api-traffic.json');

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

let swagger: any = {};
let traffic: any = {};

try {
  swagger = JSON.parse(fs.readFileSync(SWAGGER_PATH, 'utf8'));
  traffic = JSON.parse(fs.readFileSync(TRAFFIC_PATH, 'utf8'));
} catch (e) {
  console.warn("No traffic file found. Using empty traffic.");
}

// Find traffic that matches a route (e.g. GET /api/tours/{id})
function getTrafficForRoute(method: string, route: string) {
  const cleanRoute = route.replace(/\{[^}]+\}/g, '.*');
  const regex = new RegExp(`^${method.toUpperCase()} (http://[^/]+)?/api${cleanRoute}$`);
  
  for (const [key, logs] of Object.entries(traffic)) {
    if (regex.test(key)) {
      const arr = logs as any[];
      const successfulLog = arr.find(log => log.responseStatus >= 200 && log.responseStatus < 300);
      return successfulLog || arr[0];
    }
  }
  return null;
}

function resolveRef(ref: string) {
  if (!ref) return null;
  const parts = ref.split('/');
  let current: any = swagger;
  for (let i = 1; i < parts.length; i++) {
    current = current[parts[i]];
    if (!current) return null;
  }
  return current;
}

function generateMarkdownForEndpoint(route: string, method: string, op: any, isAdmin: boolean) {
  let md = `## ${op.summary || 'Endpoint'}\n\n`;
  md += `---\n\n### Method\n\n\`${method.toUpperCase()}\`\n\n`;
  md += `---\n\n### URL\n\n\`/api${route}\`\n\n`;
  md += `---\n\n### Description\n\n${op.description || op.summary || 'No description provided.'}\n\n`;
  
  const isAuthRequired = op.security && op.security.length > 0;
  md += `---\n\n### Authentication\n\n`;
  md += `**Required:** ${isAuthRequired ? 'Yes' : 'No'}\n\n`;
  if (isAuthRequired) {
    md += `**Required Role:** ${isAdmin ? 'Admin' : 'User/Guest depending on context'}\n\n`;
  }

  md += `---\n\n### Headers\n\n`;
  md += `- Content-Type: application/json\n`;
  md += `- Accept: application/json\n`;
  if (isAuthRequired) {
    md += `- x-csrf-token: Required for POST/PUT/PATCH/DELETE\n`;
  }

  // Parameters
  const pathParams = [];
  const queryParams = [];
  if (op.parameters) {
    for (let p of op.parameters) {
      if (p.$ref) p = resolveRef(p.$ref);
      if (p.in === 'path') pathParams.push(p);
      if (p.in === 'query') queryParams.push(p);
    }
  }

  md += `\n---\n\n### Path Parameters\n\n`;
  if (pathParams.length > 0) {
    md += `| Name | Type | Required | Description |\n|---|---|---|---|\n`;
    pathParams.forEach(p => {
      md += `| \`${p.name}\` | \`${p.schema?.type || 'string'}\` | ${p.required ? 'Yes' : 'No'} | ${p.description || ''} |\n`;
    });
  } else {
    md += `None.\n\n`;
  }

  md += `\n---\n\n### Query Parameters\n\n`;
  if (queryParams.length > 0) {
    md += `| Name | Type | Required | Description |\n|---|---|---|---|\n`;
    queryParams.forEach(p => {
      md += `| \`${p.name}\` | \`${p.schema?.type || 'string'}\` | ${p.required ? 'Yes' : 'No'} | ${p.description || ''} |\n`;
    });
  } else {
    md += `None.\n\n`;
  }

  // Real data
  const tLog = getTrafficForRoute(method, route);

  md += `\n---\n\n### Request Body\n\n`;
  if (tLog && tLog.requestBody && Object.keys(tLog.requestBody).length > 0) {
    md += `| Name | Type | Value Used |\n|---|---|---|\n`;
    for (const [k, v] of Object.entries(tLog.requestBody)) {
      md += `| \`${k}\` | \`${typeof v}\` | \`${JSON.stringify(v)}\` |\n`;
    }
  } else if (op.requestBody) {
    md += `See Swagger for full schema.\n\n`;
  } else {
    md += `None.\n\n`;
  }

  md += `\n---\n\n### Real Example Request\n\n`;
  if (tLog) {
    md += `\`\`\`json\n${JSON.stringify(tLog.requestBody || {}, null, 2)}\n\`\`\`\n\n`;
  } else {
    md += `*No captured traffic for this endpoint.*\n\n`;
  }

  md += `\n---\n\n### Success Response\n\n`;
  if (tLog && tLog.responseStatus >= 200 && tLog.responseStatus < 300) {
    md += `**Status Code: ${tLog.responseStatus}**\n\n`;
    md += `\`\`\`json\n${JSON.stringify(tLog.responseBody, null, 2)}\n\`\`\`\n\n`;
  } else if (tLog) {
    md += `*Traffic was captured but resulted in an error (${tLog.responseStatus}).*\n\n`;
    md += `\`\`\`json\n${JSON.stringify(tLog.responseBody, null, 2)}\n\`\`\`\n\n`;
  } else {
    md += `*No captured traffic for this endpoint.*\n\n`;
  }

  md += `\n---\n\n### Error Responses\n\n`;
  md += `See \`ERRORS.md\` for standard error formats.\n\n`;

  md += `\n---\n\n### Flutter Notes\n\n`;
  md += `- **When to call it:** When navigating to the relevant screen or submitting a form.\n`;
  md += `- **Caching:** Cache GET requests locally if data doesn't change frequently.\n`;
  md += `- **Offline:** Not supported natively; requires local SQLite sync.\n\n`;

  return md;
}

function generateDocs() {
  const adminDoc: string[] = ['# ADMIN_API\n\n'];
  const websiteDoc: string[] = ['# WEBSITE_API\n\n'];
  const postmanItems: any[] = [];

  for (const [route, methods] of Object.entries(swagger.paths)) {
    const isAdmin = route.startsWith('/admin');

    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      const md = generateMarkdownForEndpoint(route, method, op, isAdmin);
      if (isAdmin) adminDoc.push(md);
      else websiteDoc.push(md);

      // Postman
      postmanItems.push({
        name: op.summary || `${method.toUpperCase()} ${route}`,
        request: {
          method: method.toUpperCase(),
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: {
            raw: `{{baseUrl}}/api${route}`,
            host: ['{{baseUrl}}'],
            path: ['api', ...route.split('/').filter(Boolean)]
          }
        }
      });
    }
  }

  fs.writeFileSync(path.join(DOCS_DIR, 'WEBSITE_API.md'), websiteDoc.join('\n\n'));
  fs.writeFileSync(path.join(DOCS_DIR, 'ADMIN_API.md'), adminDoc.join('\n\n'));

  const postmanCol = {
    info: {
      name: 'Dunas Travel Frontend Integration',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [{ key: 'baseUrl', value: 'http://localhost:5000' }],
    item: postmanItems
  };
  fs.writeFileSync(path.join(DOCS_DIR, 'POSTMAN_COLLECTION.json'), JSON.stringify(postmanCol, null, 2));

  // Static Docs
  fs.writeFileSync(path.join(DOCS_DIR, 'AUTH.md'), `# Authentication Flow\n\n- Login via \`/api/auth/login\`\n- CSRF from \`/api/auth/csrf\`\n- HttpOnly Cookies for Tokens\n`);
  fs.writeFileSync(path.join(DOCS_DIR, 'ERRORS.md'), `# Error Handling\n\n| Code | Meaning |\n|---|---|\n| 400 | Bad Request |\n| 401 | Unauthorized |\n| 403 | Forbidden |\n| 404 | Not Found |\n`);
  fs.writeFileSync(path.join(DOCS_DIR, 'API_FLOW.md'), `# API Flows\n\n\`\`\`mermaid\ngraph TD\n  Guest --> Login\n  Login --> Bookings\n\`\`\`\n`);
  fs.writeFileSync(path.join(DOCS_DIR, 'API_EXAMPLES.md'), `# API Examples\n\n## Axios\n\`\`\`javascript\naxios.get('/api/tours');\n\`\`\`\n`);
  fs.writeFileSync(path.join(DOCS_DIR, 'FRONTEND_INTEGRATION_GUIDE.md'), `# Integration Guide\n\nFollow the standard repository pattern in Flutter and Next.js. Map JSON to strong DTOs.\n`);

  console.log('Frontend Integration Kit generated!');
}

generateDocs();
