const bcrypt = require('bcrypt');

// The password you want to use for the login screen
const plainPassword = 'Test1234$'; 
const saltRounds = 10;

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('\n====================================');
    console.log('YOUR NEW HASHED PASSWORD:');
    console.log(hash);
    console.log('====================================\n');
});