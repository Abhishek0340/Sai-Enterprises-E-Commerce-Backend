import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  stripeId: String,
  amount: Number,
  currency: String,
  status: String,
  created: Date,
  name : String,
  phone: String,
  email : String,
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
