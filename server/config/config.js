require('dotenv').config();

const DEFAULT_JWT_SECRET = 'smart-label-local-dev-secret-change-me';
const sharedJwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

module.exports = {
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME || 'smart_warehouse',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'mysql'
  },
  jwt: {
    secret: sharedJwtSecret,
    labelSecret: process.env.LABEL_JWT_SECRET || sharedJwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: process.env.PORT || 3000
  },
  ai_service: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000'
  }
};
