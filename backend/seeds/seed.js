const bcrypt = require('bcryptjs');
const { runQuery } = require('../src/models/database');

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await runQuery(`
      INSERT OR REPLACE INTO users 
      (id, email, password_hash, first_name, last_name, is_admin) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [1, 'admin@nflpicks.com', adminPassword, 'Admin', 'User', 1]);

    console.log('✅ Created admin user: admin@nflpicks.com / admin123');

    // Create sample regular users
    const users = [
      { id: 2, email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' },
      { id: 3, email: 'jane.smith@example.com', firstName: 'Jane', lastName: 'Smith' },
      { id: 4, email: 'mike.wilson@example.com', firstName: 'Mike', lastName: 'Wilson' },
      { id: 5, email: 'sarah.johnson@example.com', firstName: 'Sarah', lastName: 'Johnson' }
    ];

    for (const user of users) {
      const password = await bcrypt.hash('password123', 12);
      await runQuery(`
        INSERT OR REPLACE INTO users 
        (id, email, password_hash, first_name, last_name, is_admin) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [user.id, user.email, password, user.firstName, user.lastName, 0]);
    }

    console.log('✅ Created sample users (password: password123)');
    users.forEach(user => console.log(`   - ${user.email}`));

  // Finished creating users. Skipping mock NFL data creation per configuration.
  console.log('✅ Database seeding completed (users created).');
  console.log('\n📋 Summary:');
  console.log('- Admin user: admin@nflpicks.com / admin123');
  console.log('- Sample users: password123');
  console.log('\n🚀 You can now start the application!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const { initializeDatabase, closeDatabase } = require('../src/models/database');
  
  async function runSeed() {
    try {
      await initializeDatabase();
      await seedDatabase();
      closeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Failed to seed database:', error);
      closeDatabase();
      process.exit(1);
    }
  }
  
  runSeed();
}

module.exports = { seedDatabase };
