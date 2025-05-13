const bcrypt = require('bcryptjs');

const password = 'Plancave@@2025';
bcrypt.hash(password, 10).then(hash => {
  console.log('Hashed password:', hash);
});