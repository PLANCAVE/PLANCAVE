const mongoose = require('mongoose');
require('dotenv').config({ path: './.env.local' }); 
const User = require('./Models/User'); 
const Product = require('./Models/Products'); 

// ID generator function
let currentId = 2020;

const generateId = () => currentId++;


const seedData = async () => {
  try {
   
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB, starting seeding process...');

  
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data.');

    
    const testUser = await User.create({
      name: 'clifford manase',  
      email: 'cliffordmanase6@gmail.com',
      username: 'badman',
      password: 'ytrewq123456',
    });
    console.log('Test User Created:', testUser);

    
    const sampleProducts = [
      {
        id: generateId(),
        name: 'Modern House',
        category:'Residentials',
        price:0.5,
        image: '/4.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: 'Luxury Villa',
        category:'apartments',
        price: 450000,
        image: '/5.jpg',
        bedrooms: 5,
        bathrooms: 4,
        floors: 2,
        area: 300,
      },
      {
        id: generateId(),
        name: '4 Story mansion',
        category:'Residentials',
        price: 120000,
        image: '/6.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: '5 Story mansion',
        category:'Residentials',
        price: 130000,
        image: '/4.jpg',
        bedrooms: 6,
        bathrooms: 3,
        floors: 5,
        area: 170,
      },
      {
        id: generateId(),
        name: '2 Story mansion',
        category:'Residentials',
        price: 120000,
        image: '/2.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 2,
        area: 400,
      },
      {
        id: generateId(),
        name: '3 Bedroom mansion',
        category:'Residentials',
        price: 13500,
        image: '/6.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '2 Bedroom mansion',
        category:'Residentials',
        price: 13500,
        image: '/5.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '5 Bedroom mansion',
        category:'Residentials',
        price: 13500,
        image: '/4.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '2 Bedroom mansion',
        category:'Residentials',
        price: 13500,
        image: '/3.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '4 Bedroom mansion',
        category:'Contemporary',
        price: 13500,
        image: '/2.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '3 Bedroom mansion',
        category:'Apartments',
        price: 13500,
        image: '/1.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: '2 Bedroom mansion',
        category:'Apartments',
        price: 13500,
        image: '/6.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 140,
      },
      {
        id: generateId(),
        name: 'luxury mansion',
        category:'Residentials',
        price: 120000,
        image: '/3.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: 'Modern House',
        category:'Residentials',
        price: 120000,
        image: '/4.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: 'Modern 4 bedroom house',
        category:'Residentials',
        price: 120000,
        image: '/4.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: '2 bedroom mansion',
        category:'apartments',
        price: 4500,
        image: '/5.jpg',
        bedrooms: 5,
        bathrooms: 4,
        floors: 2,
        area: 300,
      },
      {
        id: generateId(),
        name: 'Modern mansion',
        category:'Residentials',
        price: 120000,
        image: '/1.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: '5 Bedroom mansion',
        category:'Residentials',
        price: 120000,
        image: '/2.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      {
        id: generateId(),
        name: 'Modern Villa',
        category:'Residentials',
        price: 120000,
        image: '/5.jpg',
        bedrooms: 3,
        bathrooms: 2,
        floors: 1,
        area: 120,
      },
      
    ];

    await Product.insertMany(sampleProducts);
    console.log('Sample products added to the database.');

    // Close the connection
    mongoose.connection.close();
    console.log('Seeding complete. Database connection closed.');
  } catch (err) {
    console.error('Error during seeding:', err);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seeding function
seedData();
