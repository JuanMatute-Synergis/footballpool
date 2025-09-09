const bcrypt = require('bcryptjs');
const { runQuery, getAllQuery } = require('../src/models/database');

async function addAdminUser() {
    try {
        console.log('Adding Tracy Gildner as admin user...');

        // Check if user already exists
        const existingUser = await getAllQuery('SELECT id FROM users WHERE email = ?', ['tlgildner8@yahoo.com']);

        if (existingUser.length > 0) {
            console.log('⚠️  User tlgildner8@yahoo.com already exists, updating to admin...');
            await runQuery('UPDATE users SET is_admin = 1 WHERE email = ?', ['tlgildner8@yahoo.com']);
            console.log('✅ Updated Tracy Gildner to admin status');
        } else {
            // Get the next available user ID
            const result = await getAllQuery('SELECT MAX(id) as maxId FROM users');
            let nextId = (result[0]?.maxId || 0) + 1;

            // Admin password
            const adminPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(adminPassword, 12);

            // Add Tracy as admin user
            await runQuery(`
                INSERT INTO users 
                (id, email, password_hash, first_name, last_name, is_admin, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [nextId, 'tlgildner8@yahoo.com', hashedPassword, 'Tracy', 'Gildner', 1, 1]);

            console.log(`✅ Added admin user: Tracy Gildner (tlgildner8@yahoo.com)`);
            console.log(`📋 Admin password: ${adminPassword}`);
        }

        console.log('\n🚀 Admin user setup completed successfully!');

    } catch (error) {
        console.error('❌ Error adding admin user:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const { initializeDatabase, closeDatabase } = require('../src/models/database');

    async function runAddAdmin() {
        try {
            await initializeDatabase();
            await addAdminUser();
            closeDatabase();
            process.exit(0);
        } catch (error) {
            console.error('Failed to add admin user:', error);
            closeDatabase();
            process.exit(1);
        }
    }

    runAddAdmin();
}

module.exports = { addAdminUser };
