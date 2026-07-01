const fs = require('fs');
const path = require('path');

const SWAGGER_PATH = './swagger-spec.json';
const DOCS_DIR = './docs/api';

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

const swagger = JSON.parse(fs.readFileSync(SWAGGER_PATH, 'utf8'));

// Dictionaries
const adminEndpoints = [];
const websiteEndpoints = [];
let totalEndpoints = 0;

// Resolve $ref to actual component
function resolveRef(ref) {
  if (!ref) return null;
  const parts = ref.split('/');
  let current = swagger;
  for (let i = 1; i < parts.length; i++) {
    current = current[parts[i]];
    if (!current) return null;
  }
  return current;
}

// Convert schema to example
function schemaToExample(schema) {
  if (!schema) return {};
  if (schema.$ref) schema = resolveRef(schema.$ref);
  if (!schema) return {};

  if (schema.type === 'object' && schema.properties) {
    const obj = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      obj[key] = schemaToExample(val);
    }
    return obj;
  } else if (schema.type === 'array' && schema.items) {
    return [schemaToExample(schema.items)];
  } else {
    return schema.example || schema.default || schema.type || 'string';
  }
}

function processParameters(params) {
  if (!params) return { path: [], query: [], header: [] };
  const res = { path: [], query: [], header: [] };
  params.forEach(p => {
    let param = p;
    if (p.$ref) param = resolveRef(p.$ref);
    if (param && param.in === 'path') res.path.push(param);
    if (param && param.in === 'query') res.query.push(param);
    if (param && param.in === 'header') res.header.push(param);
  });
  return res;
}

// Process paths
Object.keys(swagger.paths).forEach(route => {
  const methods = swagger.paths[route];
  Object.keys(methods).forEach(method => {
    const op = methods[method];
    totalEndpoints++;

    const isAuthRequired = op.security && op.security.length > 0;
    const isAdmin = route.startsWith('/admin');
    
    // Attempt to extract controller and action from operationId (e.g. "AdminController_listUsers")
    let controller = 'UnknownController';
    let action = 'unknownAction';
    if (op.operationId && op.operationId.includes('_')) {
      [controller, action] = op.operationId.split('_');
    }

    const endpoint = {
      method: method.toUpperCase(),
      route: '/api' + route, // Assuming api prefix
      controller,
      action,
      summary: op.summary || '',
      description: op.description || '',
      tags: op.tags || [],
      isAuthRequired,
      security: op.security || [],
      params: processParameters(op.parameters),
      requestBody: op.requestBody,
      responses: op.responses || {}
    };

    if (isAdmin) {
      adminEndpoints.push(endpoint);
    } else {
      websiteEndpoints.push(endpoint);
    }
  });
});

// Group by module/tag
function groupByTag(endpoints) {
  const groups = {};
  endpoints.forEach(ep => {
    const tag = ep.tags.length > 0 ? ep.tags[0] : 'Other';
    if (!groups[tag]) groups[tag] = [];
    groups[tag].push(ep);
  });
  return groups;
}

function renderEndpoint(ep, isAdminDoc) {
  let md = `### \`${ep.method}\` ${ep.route}\n\n`;
  if (ep.summary) md += `**Summary:** ${ep.summary}\n\n`;
  if (ep.description) md += `${ep.description}\n\n`;

  md += `- **Controller:** \`${ep.controller}\`\n`;
  md += `- **Action:** \`${ep.action}\`\n`;
  md += `- **Auth Required:** ${ep.isAuthRequired ? '✅ Yes' : '❌ No'}\n`;
  
  if (ep.params.path.length > 0) {
    md += `\n**Path Parameters:**\n`;
    ep.params.path.forEach(p => {
      md += `- \`${p.name}\` (${p.schema?.type || 'string'}): ${p.description || ''}\n`;
    });
  }

  if (ep.params.query.length > 0) {
    md += `\n**Query Parameters:**\n`;
    ep.params.query.forEach(p => {
      md += `- \`${p.name}\` (${p.schema?.type || 'string'}): ${p.description || ''}\n`;
    });
  }

  if (ep.requestBody) {
    md += `\n**Request Body:**\n`;
    let content = ep.requestBody.content;
    if (content && content['application/json']) {
      const schema = content['application/json'].schema;
      const example = schemaToExample(schema);
      md += "\`\`\`json\n" + JSON.stringify(example, null, 2) + "\n\`\`\`\n";
    } else if (content && content['multipart/form-data']) {
      md += `*multipart/form-data upload*\n`;
    }
  }

  md += `\n**Responses:**\n`;
  Object.keys(ep.responses).forEach(status => {
    const res = ep.responses[status];
    md += `- **${status}**: ${res.description || ''}\n`;
    if (res.content && res.content['application/json']) {
      const schema = res.content['application/json'].schema;
      const example = schemaToExample(schema);
      md += "  \`\`\`json\n  " + JSON.stringify(example, null, 2).replace(/\n/g, '\n  ') + "\n  \`\`\`\n";
    }
  });

  md += `\n---\n`;
  return md;
}

function generateMarkdownAPI(title, endpoints, isAdminDoc) {
  const groups = groupByTag(endpoints);
  let md = `# ${title}\n\n`;
  
  Object.keys(groups).sort().forEach(tag => {
    md += `## ${tag} Module\n\n`;
    groups[tag].forEach(ep => {
      md += renderEndpoint(ep, isAdminDoc);
    });
  });
  
  return md;
}

// Write API docs
fs.writeFileSync(path.join(DOCS_DIR, 'WEBSITE_API.md'), generateMarkdownAPI('Website & Customer API', websiteEndpoints, false));
fs.writeFileSync(path.join(DOCS_DIR, 'ADMIN_API.md'), generateMarkdownAPI('Admin & Enterprise API', adminEndpoints, true));

// Write Auth Doc
const authDoc = `# Authentication Flow & Authorization
## JWT Lifecycle
1. **Login:** Users POST \`/api/auth/login\` and receive a short-lived Access Token and a long-lived Refresh Token in secure HttpOnly cookies.
2. **CSRF:** A Double-Submit Cookie pattern protects against CSRF. Clients fetch \`/api/auth/csrf\` and attach the token as an \`X-XSRF-TOKEN\` header.
3. **Guards:** Endpoints are protected by \`JwtAuthGuard\` and \`RolesGuard\`.

## Role Matrix
- **USER:** Standard customer.
- **COMPANY:** Enterprise partner.
- **AGENT:** Sales agent linked to a company.
- **ADMIN:** System administrator.
- **SUPER_ADMIN:** God mode.
`;
fs.writeFileSync(path.join(DOCS_DIR, 'AUTHENTICATION.md'), authDoc);

// Write Error Codes
const errorDoc = `# Standard Error Codes

| Code | Type | Meaning | How to Handle |
|---|---|---|---|
| **400** | Bad Request | ValidationPipe rejected the DTO payload. | Fix the form fields and retry. |
| **401** | Unauthorized | JWT missing, expired, or invalid. | Attempt silent refresh or redirect to login. |
| **403** | Forbidden | User lacks the required RBAC role. | Hide the UI element or display access denied. |
| **404** | Not Found | The requested resource (or endpoint) does not exist. | Show a 404 page or remove the item from local state. |
| **409** | Conflict | Unique constraint violation (e.g. Prisma P2002). | Alert the user that the entity already exists. |
| **422** | Unprocessable | Semantic validation failed (e.g. invalid status transition). | Display business logic error message. |
| **429** | Too Many Requests | Throttler Guard intercepted excessive requests. | Wait 60 seconds before retrying. |
| **500** | Internal Error | Unhandled exception occurred. | Alert the team; check correlation ID in logs. |
`;
fs.writeFileSync(path.join(DOCS_DIR, 'ERROR_CODES.md'), errorDoc);

// Write Summary
const summaryDoc = `# API Documentation Summary

- **Total Discovered Endpoints:** ${totalEndpoints}
- **Website Endpoints:** ${websiteEndpoints.length}
- **Admin Endpoints:** ${adminEndpoints.length}

All endpoints have been successfully parsed from the internal Swagger schema and generated into this documentation suite.
`;
fs.writeFileSync(path.join(DOCS_DIR, 'API_SUMMARY.md'), summaryDoc);

// Generate Postman Collection
const postman = {
  info: {
    name: "Dunas Travel Production API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000/api", type: "string" }
  ],
  item: [
    {
      name: "Website API",
      item: []
    },
    {
      name: "Admin API",
      item: []
    }
  ]
};

function endpointToPostman(ep) {
  return {
    name: ep.summary || ep.route,
    request: {
      method: ep.method,
      header: [
        { key: "Content-Type", value: "application/json" }
      ],
      url: {
        raw: "{{baseUrl}}" + ep.route.replace('/api', ''),
        host: ["{{baseUrl}}"],
        path: ep.route.replace('/api', '').split('/').filter(p => p)
      }
    }
  };
}

websiteEndpoints.forEach(ep => {
  postman.item[0].item.push(endpointToPostman(ep));
});

adminEndpoints.forEach(ep => {
  postman.item[1].item.push(endpointToPostman(ep));
});

fs.writeFileSync(path.join(DOCS_DIR, 'POSTMAN_COLLECTION.json'), JSON.stringify(postman, null, 2));

console.log('Documentation successfully generated in docs/api/');
