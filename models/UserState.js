const mongoose = require('mongoose');

const userStateSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    state_data: {
        type: Object,
        default: {}
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserState', userStateSchema);
