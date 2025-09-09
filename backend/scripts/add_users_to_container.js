const bcrypt = require('bcryptjs');
const { runQuery, getAllQuery } = require('../src/models/database');

async function addUsersToContainer() {
    try {
        console.log('Adding users to container database...');

        // First, let's see what users exist
        const existingUsers = await getAllQuery('SELECT id, email, first_name, last_name, is_admin FROM users');
        console.log('Existing users:', existingUsers.length);

        // Check if Tracy already exists
        const tracyExists = existingUsers.find(u => u.email === 'tlgildner8@yahoo.com');

        if (tracyExists) {
            console.log('Tracy already exists, updating admin status...');
            await runQuery('UPDATE users SET is_admin = 1 WHERE email = ?', ['tlgildner8@yahoo.com']);
        } else {
            // Get next ID
            const maxId = Math.max(...existingUsers.map(u => u.id), 0);
            const nextId = maxId + 1;

            // Add Tracy as admin
            const adminPassword = await bcrypt.hash('admin123', 12);
            await runQuery(`
                INSERT INTO users 
                (id, email, password_hash, first_name, last_name, is_admin, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [nextId, 'tlgildner8@yahoo.com', adminPassword, 'Tracy', 'Gildner', 1, 1]);
            console.log('✅ Added Tracy Gildner as admin');
        }

        // Add other users if they don't exist
        const newUsers = [
            { email: 'K8tiec18@aol.com', firstName: 'Katie', lastName: 'Mercadante' },
            { email: 'Hbrown8@yahoo.com', firstName: 'Heather', lastName: 'Hamilton' },
            { email: 'Renjones714@gmail.com', firstName: 'Renee', lastName: 'Jones' },
            { email: 'kskinker24@gmail.com', firstName: 'Kristin', lastName: 'Stinker' },
            { email: 'Free67bird@gmail.com', firstName: 'Liz', lastName: 'Richburg' },
            { email: 'Atavarez88@gmail.com', firstName: 'Amanda', lastName: 'Tavarez' },
            { email: 'chandalscheetz@gmail.com', firstName: 'Chanda', lastName: 'Carl' }
        ];

        const defaultPassword = await bcrypt.hash('Welcome123!', 12);
        let nextId = Math.max(...existingUsers.map(u => u.id), 0) + (tracyExists ? 1 : 2);

        for (const user of newUsers) {
            const userExists = existingUsers.find(u => u.email === user.email);
            if (!userExists) {
                await runQuery(`
                    INSERT INTO users 
                    (id, email, password_hash, first_name, last_name, is_admin, is_active) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [nextId, user.email, defaultPassword, user.firstName, user.lastName, 0, 1]);
                console.log(`✅ Added ${user.firstName} ${user.lastName}`);
                nextId++;
            } else {
                console.log(`⚠️  ${user.firstName} ${user.lastName} already exists`);
            }
        }

        console.log('\n📋 Final Summary:');
        console.log('- Tracy Gildner: tlgildner8@yahoo.com / admin123 (ADMIN)');
        console.log('- Other users: Welcome123!');

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
            await addUsersToContainer();
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

module.exports = { addUsersToContainer };
