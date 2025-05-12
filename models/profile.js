const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    name :  String,
    email : String,
    mobile : { type : Number, unique : true, },
});

module.exports = mongoose.model("Profile", profileSchema)