import { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ApiLog {
  method: string;
  url: string;
  requestHeaders: any;
  requestBody: any;
  responseStatus: number;
  responseBody: any;
  timestamp: string;
}

const TRAFFIC_FILE = path.join(__dirname, '../../api-traffic.json');

// Initialize or load existing traffic
let trafficLog: Record<string, ApiLog[]> = {};
if (fs.existsSync(TRAFFIC_FILE)) {
  try {
    trafficLog = JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8'));
  } catch (e) {
    trafficLog = {};
  }
}

export function saveTraffic() {
  fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(trafficLog, null, 2), 'utf8');
}

export function injectInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => {
      logTraffic(response);
      return response;
    },
    (error) => {
      if (error.response) {
        logTraffic(error.response);
      }
      return Promise.reject(error);
    }
  );
}

function logTraffic(response: any) {
  const req = response.config;
  const method = (req.method || 'GET').toUpperCase();
  const url = req.url || '';
  
  // Create a key based on method and route. 
  // Note: For dynamic URLs like /api/tours/123, we might have multiple entries. We'll group them later.
  const routeKey = `${method} ${url}`;

  if (!trafficLog[routeKey]) {
    trafficLog[routeKey] = [];
  }

  // Safely parse JSON bodies
  let requestBody = req.data;
  if (typeof requestBody === 'string') {
    try {
      requestBody = JSON.parse(requestBody);
    } catch (e) {
      // Keep as string if not JSON
    }
  }

  // We only keep the most recent request for a specific exact URL to avoid bloating
  const existingIndex = trafficLog[routeKey].findIndex(log => log.url === url && JSON.stringify(log.requestBody) === JSON.stringify(requestBody));

  const logEntry: ApiLog = {
    method,
    url,
    requestHeaders: req.headers,
    requestBody,
    responseStatus: response.status,
    responseBody: response.data,
    timestamp: new Date().toISOString()
  };

  if (existingIndex > -1) {
    trafficLog[routeKey][existingIndex] = logEntry;
  } else {
    trafficLog[routeKey].push(logEntry);
  }

  saveTraffic();
}
