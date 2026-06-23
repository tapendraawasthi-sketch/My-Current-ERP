import { AppDataSource, runMigrations } from '../data-source';
import { seedDefaultCoA } from './chart-of-accounts.seeder';

async function seed() {
  try {
    // Run migrations first
    await runMigrations();
    
    // Seed default Indian Chart of Accounts
    await seedDefaultCoA();
    
    console.log('✅ Database seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
