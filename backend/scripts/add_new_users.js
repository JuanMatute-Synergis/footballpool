const bcrypt = require('bcryptjs');
const { runQuery } = require('../src/models/database');

async function addNewUsers() {
    try {
        console.log('Starting to add new users...');

        // New users to add
        const newUsers = [
            { email: 'K8tiec18@aol.com', firstName: 'Katie', lastName: 'Mercadante' },
            { email: 'Hbrown8@yahoo.com', firstName: 'Heather', lastName: 'Hamilton' },
            { email: 'Renjones714@gmail.com', firstName: 'Renee', lastName: 'Jones' },
            { email: 'kskinker24@gmail.com', firstName: 'Kristin', lastName: 'Stinker' },
            { email: 'Free67bird@gmail.com', firstName: 'Liz', lastName: 'Richburg' },
            { email: 'Atavarez88@gmail.com', firstName: 'Amanda', lastName: 'Tavarez' },
            { email: 'chandalscheetz@gmail.com', firstName: 'Chanda', lastName: 'Carl' }
        ];

        // Get the next available user ID
        const result = await runQuery('SELECT MAX(id) as maxId FROM users');
        let nextId = (result[0]?.maxId || 0) + 1;

        // Default password for new users
        const defaultPassword = 'Welcome123!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        // Add each user
        for (const user of newUsers) {
            // Check if user already exists
            const existingUser = await runQuery('SELECT id FROM users WHERE email = ?', [user.email]);

            if (existingUser.length > 0) {
                console.log(`⚠️  User ${user.email} already exists, skipping...`);
                continue;
            }

            await runQuery(`
                INSERT INTO users 
                (id, email, password_hash, first_name, last_name, is_admin, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [nextId, user.email, hashedPassword, user.firstName, user.lastName, 0, 1]);

            console.log(`✅ Added user: ${user.firstName} ${user.lastName} (${user.email})`);
            nextId++;
        }

        console.log('\n📋 Summary:');
        console.log(`- Added ${newUsers.length} new users`);
        console.log(`- Default password for all new users: ${defaultPassword}`);
        console.log('- All users are set as non-admin');
        console.log('\n🚀 User addition completed successfully!');

    } catch (error) {
        console.error('❌ Error adding users:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const { initializeDatabase, closeDatabase } = require('../src/models/database');

    async function runAddUsers() {
        try {
            await initializeDatabase();
            await addNewUsers();
            closeDatabase();
            process.exit(0);
        } catch (error) {
            console.error('Failed to add users:', error);
            closeDatabase();
            process.exit(1);
        }
    }

    runAddUsers();
}

module.exports = { addNewUsers };
