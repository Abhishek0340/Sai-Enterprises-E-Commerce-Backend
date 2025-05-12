import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  cart: Array,
  totalAmount: Number,
  shippingAddress: {
    name: String,
    email: String,
    phone: String,
    address: String,
    landmark: String,
    pincode: String,
    city: String,
    state: String,
    country: String,
  },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Order', orderSchema);
