const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    phoneNumber: {
        type: String,
        unique: true
    },
    applicationCode:{
        type: String,
        default: "CA-Application"
    },
    isActive:{
        type: Boolean
    },
    role: {
        type: String,
        enum: ['admin', 'operational'],
        required: true,
        default: 'operational'
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('Admin', adminSchema);