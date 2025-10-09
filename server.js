const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Logging utility for server
const Logger = {
    isDev: process.env.NODE_ENV !== 'production',
    
    debug: function(message, data = null) {
        if (this.isDev) {
            console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    },
    
    info: function(message, data = null) {
        console.info(`[INFO] ${new Date().toISOString()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    
    warn: function(message, data = null) {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    
    error: function(message, error = null) {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error ? error.stack || error : '');
    },
    
    api: function(method, path, message = '', data = null) {
        if (this.isDev) {
            console.log(`[API] ${new Date().toISOString()}: ${method} ${path} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    }
};

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        Logger.info('Connected to MongoDB successfully');
        console.log('✓ Connected to MongoDB');
    })
    .catch(err => {
        Logger.error('MongoDB connection failed', err);
        console.error('MongoDB connection error:', err);
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
        const { user_id, email, name, picture } = req.body;
        Logger.api('POST', '/api/user', 'Creating/updating user', { user_id, email, name });
        
        if (!user_id || !email) {
            Logger.warn('User creation failed: missing required fields', { user_id, email });
            return res.status(400).json({ error: 'user_id and email are required' });
        }
        
        let user = await User.findOne({ id: user_id });
        
        if (!user) {
            Logger.debug('Creating new user', { user_id, email });
            user = new User({ id: user_id, email, name, picture });
        } else {
            Logger.debug('Updating existing user', { user_id, email });
            user.email = email;
            user.name = name;
            user.picture = picture;
            user.updated_at = new Date();
        }
        
        await user.save();
        Logger.info('User created/updated successfully', { user_id, email });
        res.json({ message: 'User created/updated successfully' });
    } catch (error) {
        Logger.error('User creation error', error);
        console.error('User creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// State routes
app.get('/api/state/:user_id', async (req, res) => {
    try {
        const userId = req.params.user_id;
        Logger.api('GET', `/api/state/${userId}`, 'Loading user state');
        
        const state = await UserState.findOne({ user_id: userId });
        
        if (!state) {
            Logger.debug('No state found for user', { userId });
            return res.json({ state: {} });
        }
        
        Logger.debug('State loaded successfully', { userId, hasData: !!state.state_data });
        res.json({ state: state.state_data });
    } catch (error) {
        Logger.error('Get state error', error);
        console.error('Get state error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/state/:user_id', async (req, res) => {
    try {
        const { state } = req.body;
        const userId = req.params.user_id;
        
        Logger.api('POST', `/api/state/${userId}`, 'Saving user state', {
            userId,
            cardCount: state?.cards?.length || 0,
            taskCount: state?.tasks?.length || 0,
            reminderCount: state?.reminders?.length || 0
        });
        
        let userState = await UserState.findOne({ user_id: userId });
        
        if (!userState) {
            Logger.debug('Creating new state record', { userId });
            userState = new UserState({
                user_id: userId,
                state_data: state || {}
            });
        } else {
            Logger.debug('Updating existing state record', { userId });
            userState.state_data = state || {};
            userState.updated_at = new Date();
        }
        
        await userState.save();
        Logger.info('State saved successfully', { userId });
        res.json({ message: 'State saved successfully' });
    } catch (error) {
        Logger.error('Save state error', error);
        console.error('Save state error:', error);
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

// Logout route - clears user session data
app.post('/api/logout/:user_id', async (req, res) => {
    try {
        const userId = req.params.user_id;
        Logger.api('POST', `/api/logout/${userId}`, 'Processing logout');

        // Delete all tokens for this user
        await UserToken.deleteMany({ user_id: userId });
        Logger.debug('All tokens deleted for user', { userId });

        // Optionally: Clear user state (uncomment if you want to delete state on logout)
        // await UserState.deleteOne({ user_id: userId });
        // Logger.debug('User state cleared', { userId });

        Logger.info('Logout completed successfully', { userId });
        res.json({ message: 'Logout successful' });
    } catch (error) {
        Logger.error('Logout error', error);
        console.error('Logout error:', error);

        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    Logger.info(`Server started successfully on port ${PORT}`);
    console.log(`✓ Server running on port ${PORT}`);
});
