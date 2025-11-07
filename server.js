const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI is not set in environment variables!');
    console.error('Please create a .env file with: MONGODB_URI=your_connection_string');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✓ Connected to MongoDB'))
    .catch(err => {
        console.error('\n❌ MongoDB connection error:', err.message);
        console.error('\n🔧 QUICK FIX FOR MONGODB ATLAS:');
        console.error('   1. Go to: https://cloud.mongodb.com');
        console.error('   2. Select your project → Network Access');
        console.error('   3. Click "Add IP Address"');
        console.error('   4. Click "Add Current IP Address" (or use 0.0.0.0/0 for testing)');
        console.error('   5. Wait 1-2 minutes, then restart the server\n');
        console.error('Please check:');
        console.error('  1. Your MONGODB_URI in .env file is correct');
        console.error('  2. Your MongoDB server is running (if local)');
        console.error('  3. Your IP is whitelisted (if using MongoDB Atlas) ← MOST LIKELY ISSUE');
        console.error('  4. Your username/password are correct');
        process.exit(1);
    });

// Import models
const User = require('./models/User');
const UserState = require('./models/UserState');
const UserToken = require('./models/UserToken');
const RSSSource = require('./models/RSSSource');

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// User routes
app.post('/api/user', async (req, res) => {
    try {
        console.log('📥 POST /api/user - Request received:', JSON.stringify(req.body));
        const { user_id, email, name, picture } = req.body;
        
        if (!user_id || !email) {
            console.error('❌ Missing user_id or email');
            return res.status(400).json({ error: 'user_id and email are required' });
        }
        
        let user = await User.findOne({ id: user_id });
        
        if (!user) {
            console.log('📝 Creating new user:', user_id);
            user = new User({ id: user_id, email, name, picture });
        } else {
            console.log('🔄 Updating existing user:', user_id);
            user.email = email;
            user.name = name;
            user.picture = picture;
            user.updated_at = new Date();
        }
        
        await user.save();
        console.log('✅ User saved successfully:', user_id);
        res.json({ message: 'User created/updated successfully' });
    } catch (error) {
        console.error('❌ User creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// State routes
app.get('/api/state/:user_id', async (req, res) => {
    try {
        const state = await UserState.findOne({ user_id: req.params.user_id });
        
        if (!state) {
            return res.json({ state: {} });
        }
        
        res.json({ state: state.state_data });
    } catch (error) {
        console.error('Get state error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/state/:user_id', async (req, res) => {
    try {
        const user_id = req.params.user_id;
        console.log(`📥 POST /api/state/${user_id} - Request received`);
        const { state } = req.body;
        
        if (!state) {
            console.error('❌ No state data in request body');
            return res.status(400).json({ error: 'state is required' });
        }
        
        console.log(`📊 State data keys:`, Object.keys(state || {}));
        
        let userState = await UserState.findOne({ user_id: user_id });
        
        if (!userState) {
            console.log(`📝 Creating new state for user: ${user_id}`);
            userState = new UserState({
                user_id: user_id,
                state_data: state || {}
            });
        } else {
            console.log(`🔄 Updating existing state for user: ${user_id}`);
            userState.state_data = state || {};
            userState.updated_at = new Date();
        }
        
        await userState.save();
        console.log(`✅ State saved successfully for user: ${user_id}`);
        res.json({ message: 'State saved successfully' });
    } catch (error) {
        console.error('❌ Save state error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Token routes
app.get('/api/tokens/:user_id/:token_type', async (req, res) => {
    try {
        const token = await UserToken.findOne({
            user_id: req.params.user_id,
            token_type: req.params.token_type
        });
        
        if (!token) {
            return res.json({ token: null });
        }
        
        res.json({ token: token.getDecryptedToken() });
    } catch (error) {
        console.error('Get token error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tokens/:user_id/:token_type', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'token is required' });
        }
        
        let userToken = await UserToken.findOne({
            user_id: req.params.user_id,
            token_type: req.params.token_type
        });
        
        if (!userToken) {
            userToken = new UserToken({
                user_id: req.params.user_id,
                token_type: req.params.token_type
            });
        }
        
        userToken.setEncryptedToken(token);
        userToken.updated_at = new Date();
        
        await userToken.save();
        res.json({ message: 'Token saved successfully' });
    } catch (error) {
        console.error('Save token error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tokens/:user_id/:token_type', async (req, res) => {
    try {
        await UserToken.deleteOne({
            user_id: req.params.user_id,
            token_type: req.params.token_type
        });
        
        res.json({ message: 'Token deleted successfully' });
    } catch (error) {
        console.error('Delete token error:', error);
        res.status(500).json({ error: error.message });
    }
});

// RSS Source routes
app.get('/api/rss-sources', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};
        
        const sources = await RSSSource.find(filter).sort({ category: 1, name: 1 });
        
        // Group by category
        const groupedSources = sources.reduce((acc, source) => {
            if (!acc[source.category]) {
                acc[source.category] = [];
            }
            acc[source.category].push({
                _id: source._id,
                name: source.name,
                url: source.url,
                category: source.category,
                favicon: source.favicon
            });
            return acc;
        }, {});
        
        res.json({ sources: groupedSources });
    } catch (error) {
        console.error('Get RSS sources error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/rss-sources/categories', async (req, res) => {
    try {
        const categories = await RSSSource.distinct('category');
        res.json({ categories: categories.sort() });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server running on port ${PORT}`);
});
