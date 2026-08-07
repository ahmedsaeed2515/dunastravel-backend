const vercelHandler = require('../dist/src/vercel.js');

module.exports = async (req, res) => {
  const handler = vercelHandler.default || vercelHandler;
  return handler(req, res);
};
