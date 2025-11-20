import sequelize from '../config/database';
import models from '../models';

const syncDatabase = async (): Promise<void> => {
  try {
    // Sync all models with database
    await sequelize.sync({ force: false }); // Set force: true only in development to drop tables
    console.log('✅ Database synchronized successfully');
    
    // Test counts
    const userCount = await models.User.count();
    const runnerCount = await models.Runner.count();
    const errandCount = await models.Errand.count();
    
    console.log(`📊 Current counts:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Runners: ${runnerCount}`);
    console.log(`   Errands: ${errandCount}`);
    
    // List all tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('🗄️  Database tables:');
    tables.forEach((table: any) => {
      console.log(`   - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    process.exit(1);
  }
};

// Run if this script is executed directly
if (require.main === module) {
  syncDatabase();
}

export default syncDatabase;