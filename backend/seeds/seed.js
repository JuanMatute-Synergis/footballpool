const bcrypt = require('bcryptjs');
const { runQuery } = require('../src/models/database');

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Create admin user only if it doesn't exist
    const existingAdmin = await runQuery(`SELECT id FROM users WHERE email = ?`, ['admin@nflpicks.com']).catch(() => null);

    if (!existingAdmin) {
      const adminPassword = await bcrypt.hash('admin123', 12);

      await runQuery(`
        INSERT INTO users 
        (id, email, password_hash, first_name, last_name, is_admin) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [1, 'admin@nflpicks.com', adminPassword, 'Admin', 'User', 1]);

      console.log('✅ Created admin user: admin@nflpicks.com / admin123');
    } else {
      console.log('ℹ️  Admin user already exists, skipping creation');
    }

    // Create sample regular users only if they don't exist
    const users = [
      { id: 2, email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' },
      { id: 3, email: 'jane.smith@example.com', firstName: 'Jane', lastName: 'Smith' },
      { id: 4, email: 'mike.wilson@example.com', firstName: 'Mike', lastName: 'Wilson' },
      { id: 5, email: 'sarah.johnson@example.com', firstName: 'Sarah', lastName: 'Johnson' }
    ];

    let newUsersCreated = 0;
    for (const user of users) {
      const existingUser = await runQuery(`SELECT id FROM users WHERE email = ?`, [user.email]).catch(() => null);

      if (!existingUser) {
        const password = await bcrypt.hash('password123', 12);
        await runQuery(`
          INSERT INTO users 
          (id, email, password_hash, first_name, last_name, is_admin) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [user.id, user.email, password, user.firstName, user.lastName, 0]);
        newUsersCreated++;
      }
    }

    if (newUsersCreated > 0) {
      console.log(`✅ Created ${newUsersCreated} sample users (password: password123)`);
      users.forEach(user => console.log(`   - ${user.email}`));
    } else {
      console.log('ℹ️  Sample users already exist, skipping creation');
    }

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
