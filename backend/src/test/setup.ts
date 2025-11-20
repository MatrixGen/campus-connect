/*
import sequelize, { testConnection } from '../config/database';

import models from '../models';

// Global test setup
beforeAll(async () => {
  // Test database connection
  await testConnection();
  
  // Sync test database
  await sequelize.sync({ force: true });
  console.log('✅ Test database synchronized');
});

// Global test teardown
afterAll(async () => {
  // Close database connection
  await sequelize.close();
  console.log('✅ Test database connection closed');
});

// Clean database between tests
afterEach(async () => {
  // Clean all tables in reverse order of dependencies
  await models.Review.destroy({ where: {}, force: true });
  await models.Transaction.destroy({ where: {}, force: true });
  await models.Errand.destroy({ where: {}, force: true });
  await models.Runner.destroy({ where: {}, force: true });
  await models.User.destroy({ where: {}, force: true });
});

*/

// src/test/setup.ts
beforeAll(() => {
  // no DB needed for unit tests
});

afterAll(() => {});

afterEach(() => {
  jest.clearAllMocks();
});
