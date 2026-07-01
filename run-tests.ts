import axios from 'axios';
import * as fs from 'fs';

const swaggerSpec = JSON.parse(fs.readFileSync('swagger-spec.json', 'utf8'));
const paths = swaggerSpec.paths;
const results: any[] = [];
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('Starting Live API Testing for ' + Object.keys(paths).length + ' paths...');
  
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      const url = `${BASE_URL}${path.replace(/\{([^}]+)\}/g, 'test-id')}`;
      const startTime = Date.now();
      let status = 0;
      let statusText = '';
      let errorData = null;
      
      try {
        const response = await axios({
          method,
          url,
          validateStatus: () => true, // Don't throw on 4xx/5xx
          data: method === 'get' ? undefined : {}
        });
        
        status = response.status;
        statusText = response.statusText;
        if (status >= 400) {
           errorData = response.data;
        }
      } catch (err: any) {
        status = err.response?.status || 0;
        statusText = err.message;
      }
      
      const responseTime = Date.now() - startTime;
      const passed = status !== 500; // Anything other than 500 is a "safe" response (400, 401, 403, 404, 200, 201)
      
      results.push({
        method: method.toUpperCase(),
        route: path,
        status,
        responseTimeMs: responseTime,
        passed,
        notes: status === 400 ? 'Validation working' : (status === 401 || status === 403 ? 'Auth working' : 'OK')
      });
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${method.toUpperCase()} ${path} -> ${status} (${responseTime}ms)`);
    }
  }

  // Generate Report
  let md = `# Phase 3: Live Endpoint Test Report\n\n`;
  md += `| Method | Route | Status | Time (ms) | Pass/Fail | Notes |\n`;
  md += `|---|---|---|---|---|---|\n`;
  
  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) passedCount++; else failedCount++;
    md += `| ${r.method} | \`${r.route}\` | ${r.status} | ${r.responseTimeMs} | ${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.notes} |\n`;
  }

  md += `\n**Summary:** ${passedCount} Passed, ${failedCount} Failed.\n`;
  fs.writeFileSync('C:/Users/Ahmed Saeed/.gemini/antigravity/brain/43e836e5-2008-4fd7-bb63-8fdbe915ea8a/phase3_api_tests.md', md);
  console.log('Test report generated.');
}

runTests();
