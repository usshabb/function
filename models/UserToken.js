const mongoose = require('mongoose');
const crypto = require('crypto');

const userTokenSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true
    },
    token_type: {
        type: String,
        required: true
    },
    token_value: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Compound index for user_id + token_type
userTokenSchema.index({ user_id: 1, token_type: 1 }, { unique: true });

// Encryption key from environment
const ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update(process.env.SESSION_SECRET || 'default-secret-key')
    .digest();

// Encryption methods
userTokenSchema.methods.setEncryptedToken = function(plainToken) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    this.token_value = iv.toString('hex') + ':' + encrypted;
};

userTokenSchema.methods.getDecryptedToken = function() {
    try {
        const parts = this.token_value.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Token decryption error:', error);
        return null;
    }
};

module.exports = mongoose.model('UserToken', userTokenSchema);
