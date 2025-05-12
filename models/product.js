import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, required: true },
  quantity: { type: Number, required: true },
  category: { type: String, required: true },
  additionalImages: [String],
});

const Product = mongoose.model("Product", ProductSchema);
export default Product;  