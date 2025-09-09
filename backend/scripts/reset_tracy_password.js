const bcrypt = require('bcryptjs');
const { runQuery, getAllQuery } = require('../src/models/database');

async function resetTracyPassword() {
    try {
        console.log('Resetting Tracy Gildner password...');

        // Check if user exists
        const user = await getAllQuery('SELECT id FROM users WHERE email = ?', ['tlgildner8@yahoo.com']);

        if (user.length === 0) {
            console.log('❌ User tlgildner8@yahoo.com not found!');
            return;
        }

        // Reset password to admin123
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await runQuery('UPDATE users SET password_hash = ?, is_admin = 1 WHERE email = ?',
            [hashedPassword, 'tlgildner8@yahoo.com']);

        console.log('✅ Password reset successfully for Tracy Gildner');
        console.log('📋 Email: tlgildner8@yahoo.com');
        console.log('📋 Password: admin123');
        console.log('📋 Admin status: Yes');

    } catch (error) {
        console.error('❌ Error resetting password:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const { initializeDatabase, closeDatabase } = require('../src/models/database');

    async function runReset() {
        try {
            await initializeDatabase();
            await resetTracyPassword();
            closeDatabase();
            process.exit(0);
        } catch (error) {
            console.error('Failed to reset password:', error);
            closeDatabase();
            process.exit(1);
        }
    }

    runReset();
}

module.exports = { resetTracyPassword };
