const mongoose = require('mongoose');

const CustomCommandSchema = new mongoose.Schema({
  serverId: { type: String, required: true }, 
  userId: { type: String, required: true },   
  commandName: { type: String, required: true },
  response: { type: String, required: true }
}, {
  timestamps: true
});


CustomCommandSchema.index({ serverId: 1, commandName: 1 }, { unique: true });

module.exports = mongoose.model('CustomCommand', CustomCommandSchema);
