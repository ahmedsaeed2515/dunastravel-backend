const path = require('path');
const fs = require('fs');

function getHandler() {
  const candidatePaths = [
    path.join(__dirname, '../dist/src/vercel.js'),
    path.join(__dirname, '../dist/vercel.js'),
    path.join(process.cwd(), 'dist/src/vercel.js'),
    path.join(process.cwd(), 'dist/vercel.js'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const mod = require(p);
      return mod.default || mod;
    }
  }
  const mod = require('../dist/src/vercel.js');
  return mod.default || mod;
}

module.exports = async (req, res) => {
  try {
    const handler = getHandler();
    return await handler(req, res);
  } catch (error) {
    console.error('[API Index Bootstrap Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        error: 'Bootstrap Failure',
        message: error?.message || 'Unknown server initialization error',
        stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
      });
    }
  }
};
