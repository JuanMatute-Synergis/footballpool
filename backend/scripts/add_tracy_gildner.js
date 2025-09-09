const bcrypt = require('bcryptjs');
const { initializeDatabase, runQuery, getQuery, closeDatabase } = require('../src/models/database');

async function addTracy() {
  try {
    await initializeDatabase();

    // Check if Tracy already exists
    const existingTracy = await getQuery('SELECT id FROM users WHERE email = ?', ['tlgildner8@yahoo.com']);

    if (existingTracy) {
      console.log('ℹ️  Tracy Gildner already exists in database');
      console.log('Email: tlgildner8@yahoo.com');
      console.log('Password: admin123');
      console.log('Role: Admin');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 12);

      await runQuery(
        'INSERT INTO users (email, password_hash, first_name, last_name, is_admin, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        ['tlgildner8@yahoo.com', hashedPassword, 'Tracy', 'Gildner', 1, 1]
      );

      console.log('✅ Tracy Gildner added as admin user successfully!');
      console.log('Email: tlgildner8@yahoo.com');
      console.log('Password: admin123');
      console.log('Role: Admin');
    }

    closeDatabase();
  } catch (error) {
    console.error('Error adding Tracy:', error);
    closeDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  addTracy();
}

module.exports = { addTracy };
