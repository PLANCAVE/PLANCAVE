
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Log the MONGO_URI to check its value
console.log('MONGO_URI:', process.env.MONGO_URI);

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000 // Increased timeout for server selection
});

let dbConnectionAttempted = false;

async function connectToMongoDB() {
    if (client && client.topology && client.topology.isConnected()) {
        console.log('MongoDB is already connected.');
        return;
    }
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        console.log('Successfully connected to MongoDB for search functionality');
        dbConnectionAttempted = true;
    } catch (err) {
        console.error('MongoDB connection error during initial connect:', err.message);
        dbConnectionAttempted = true;
    }
}

// Call connectToMongoDB when the module loads.
connectToMongoDB();

// Corrected route: Changed from '/search' to '/'
router.get('/', async (req, res) => {
    console.log('Search endpoint (/api/search) hit with query:', req.query);

    const query = req.query.q || '';
    const sortField = req.query.sortField || 'name'; // Default sort field
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1; // Default sort direction

    try {
        // Ensure MongoDB client is connected before proceeding
        if (!client || !client.topology || !client.topology.isConnected()) {
            console.warn('MongoDB not connected. Attempting to reconnect...');
            await connectToMongoDB(); // Try to reconnect
            if (!client || !client.topology || !client.topology.isConnected()) {
                console.error('Failed to reconnect to MongoDB. Aborting search.');
                return res.status(503).json({
                    error: 'Service Unavailable',
                    message: 'Failed to connect to the database. Please try again later.'
                });
            }
            console.log('Successfully reconnected to MongoDB.');
        }

        const database = client.db('theplancave'); // Make sure 'theplancave' is your correct DB name
        const collection = database.collection('products'); // Make sure 'products' is your correct collection name

        // Build the aggregation pipeline
        const pipeline = [];

        // $search stage (only if query is provided)
        if (query) {
            pipeline.push({
                $search: {
                    index: "plancave", // Ensure this Atlas Search index exists and is configured
                    text: {
                        query: query,
                        path: [
                            "name",
                            "category",
                            "bathrooms",
                            "bedrooms",
                            "floors",
                            "area"
                        ]
                        // Note: For numeric fields (bathrooms, bedrooms, floors, area) to be searchable as text,
                        // they must be indexed as strings in your Atlas Search index.
                        // Otherwise, remove them from this array and use $match or Atlas Search 'range'/'equals' for numeric filtering.
                        // fuzzy: {} // Optional: consider adding fuzzy matching
                    }
                }
            });
        } else {
            // If no search query, match all documents.
            pipeline.push({ $match: {} });
        }

        // $project stage
        pipeline.push({
            $project: {
                _id: 1,
                name: 1,
                category: 1,
                bathrooms: 1,
                bedrooms: 1,
                floors: 1,
                area: 1,
                price: 1,
                images: 1,
                // score: { $meta: "searchScore" } // Uncomment if you want to return search score
            }
        });

        // $match stage for filters (applied after $search or initial $match)
        if (req.query.filters) {
            try {
                const filters = JSON.parse(req.query.filters);
                const matchConditions = {};

                if (filters.bedrooms) matchConditions.bedrooms = { $gte: parseInt(filters.bedrooms) };
                if (filters.bathrooms) matchConditions.bathrooms = { $gte: parseInt(filters.bathrooms) };
                if (filters.floors) matchConditions.floors = { $gte: parseInt(filters.floors) };
                if (filters.area) matchConditions.area = { $gte: parseInt(filters.area) };

                if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
                    matchConditions.category = { $in: filters.categories };
                }

                if (Object.keys(matchConditions).length > 0) {
                    pipeline.push({ $match: matchConditions });
                }
            } catch (err) {
                console.error('Error parsing filters JSON:', err.message);
                // Optionally, you could return a 400 error here if filters are malformed
                // return res.status(400).json({ error: 'Malformed filters parameter.' });
            }
        }

        // $sort stage
        const sortOptions = {};
        sortOptions[sortField] = sortDirection;
        pipeline.push({ $sort: sortOptions });

        // $limit stage
        pipeline.push({ $limit: 100 }); // Consider making limit configurable

        // Uncomment and configure $lookup if you need to join with another collection
        // pipeline.push({
        //     $lookup: {
        //         from: "products",
        //         localField: "_id",
        //         foreignField: "product_id",
        //         as: "joined_data"
        //     }
        // });

        console.log('Executing search pipeline:', JSON.stringify(pipeline, null, 2));
        const results = await collection.aggregate(pipeline).toArray();
        console.log(`Found ${results.length} search results for query "${query}"`);
        res.json(results);

    } catch (err) {
        console.error('Search operation error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Graceful shutdown for MongoDB client
process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
});

module.exports = router;
