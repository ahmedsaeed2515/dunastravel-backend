module.exports = async (req, res) => {
  try {
    const vercelHandler = require('../dist/src/vercel.js');
    const handler = vercelHandler.default || vercelHandler;
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
