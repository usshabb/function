const mongoose = require('mongoose');

const rssSourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    favicon: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Index for faster category queries
rssSourceSchema.index({ category: 1, name: 1 });

module.exports = mongoose.model('RSSSource', rssSourceSchema);
