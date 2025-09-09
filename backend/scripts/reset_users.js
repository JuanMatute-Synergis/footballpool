const bcrypt = require('bcryptjs');
const { runQuery } = require('../src/models/database');

async function resetUsers() {
    try {
        console.log('Starting user reset...');

        // Delete all existing users
        await runQuery('DELETE FROM users');
        console.log('✅ Deleted all existing users');

        // Delete any user-related data that might reference users
        await runQuery('DELETE FROM picks');
        console.log('✅ Deleted all picks');

        // Create the new admin user
        const adminPassword = await bcrypt.hash('admin123', 12);

        await runQuery(`
      INSERT INTO users 
      (id, email, password_hash, first_name, last_name, is_admin) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [1, 'tlgildner8@yahoo.com', adminPassword, 'Admin', 'User', 1]);

        console.log('✅ Created new admin user: tlgildner8@yahoo.com / admin123');

        console.log('\n📋 Summary:');
        console.log('- All previous users have been removed');
        console.log('- New admin user: tlgildner8@yahoo.com / admin123');
        console.log('\n🚀 User reset completed successfully!');

    } catch (error) {
        console.error('❌ Error resetting users:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const { initializeDatabase, closeDatabase } = require('../src/models/database');

    async function runReset() {
        try {
            await initializeDatabase();
            await resetUsers();
            closeDatabase();
            process.exit(0);
        } catch (error) {
            console.error('Failed to reset users:', error);
            closeDatabase();
            process.exit(1);
        }
    }

    runReset();
}

module.exports = { resetUsers };
