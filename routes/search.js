const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Log the MONGO_URI to check its value
console.log('MONGO_URI:', process.env.MONGO_URI);

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000
});

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB for search functionality');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

connectToMongoDB();

router.get('/search', async (req, res) => {
    console.log('Search endpoint hit with query:', req.query);

    const query = req.query.q || '';
    const sortField = req.query.sortField || 'name';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;

    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
            console.log('Reconnected to MongoDB');
        }

        const database = client.db('theplancave');
        const collection = database.collection('products');

        const pipeline = [
            {
                $search: {
                    index: "plancave",
                    text: {
                        query: query,
                        path: [
                            "bathrooms",
                            "bedrooms",
                            "floors",
                            "area",
                            "name",
                            "category"
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    category: 1,
                    bathrooms: 1,
                    bedrooms: 1,
                    floors: 1,
                    area: 1,
                    price: 1,
                    images: 1
                }
            },
            {
                $sort: {
                    [sortField]: sortDirection
                }
            }
        ];

        if (req.query.filters) {
            try {
                const filters = JSON.parse(req.query.filters);
                const matchStage = { $match: {} };

                if (filters.bedrooms) matchStage.$match.bedrooms = { $gte: parseInt(filters.bedrooms) };
                if (filters.bathrooms) matchStage.$match.bathrooms = { $gte: parseInt(filters.bathrooms) };
                if (filters.floors) matchStage.$match.floors = { $gte: parseInt(filters.floors) };
                if (filters.area) matchStage.$match.area = { $gte: parseInt(filters.area) };

                if (filters.categories && filters.categories.length > 0) {
                    matchStage.$match.category = { $in: filters.categories };
                }

                if (Object.keys(matchStage.$match).length > 0) {
                    pipeline.push(matchStage);
                }
            } catch (err) {
                console.error('Error parsing filters:', err);
            }
        }

        pipeline.push({ $limit: 100 });

        pipeline.push({
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "product_id",
                as: "joined_data"
            }
        });

        console.log('Executing search pipeline:', JSON.stringify(pipeline, null, 2));
        const result = await collection.aggregate(pipeline).toArray();
        console.log(`Found ${result.length} search results`);
        res.json(result);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

module.exports = router;