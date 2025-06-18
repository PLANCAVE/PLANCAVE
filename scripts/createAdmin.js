require('dotenv').config();
const bcrypt = require('bcryptjs');

// Import your DB connector and User model
const { connectDB } = require('../config/db');
const User = require('../Models/User');

async function createAdmin() {
  try {
    await connectDB();

    const email = 'bunifuafrica@gmail.com';
    const password = 'Plancave@@2025';

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log('⚠️ Admin already exists:', existingAdmin.email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new User({
      name: 'Super Admin',
      email,
      password: hashedPassword,
      role: 'admin',
    });

    await newAdmin.save();
    console.log('✅ Admin user created successfully:', newAdmin.email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin user:', err);
    process.exit(1);
  }
}

createAdmin();
