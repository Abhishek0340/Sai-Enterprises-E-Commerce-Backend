import mongoose from 'mongoose';

const SignupSchema = new mongoose.Schema({
    name: { type:String, required : true},
    email: { type: String, required : true, unique : true},
    password: String,
}, { timestamps: true });

const SignupModel = mongoose.model("signup", SignupSchema);

export default SignupModel;  