const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'src', 'models', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, email, firstName, lastName, isAdmin FROM users", (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Users in database:');
        console.table(rows);
    }
    db.close();
});
