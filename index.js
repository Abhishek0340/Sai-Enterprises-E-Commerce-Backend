import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import SignupModel from './models/signup.js';
import Product from './models/product.js';
import stripePackage from 'stripe';
import Order from './models/order.js';
import Contact from './models/contact.js';
import Transaction from './models/transaction.js';
import AdminModel from './models/admin.js'
import nodemailer from "nodemailer";



const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);
const otpStore = new Map();
const app = express();
//const allowedOrigins = ['https://your-netlify-site.netlify.app'];
app.use(express.json());

app.use(cors());

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
// }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

  
  const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "abhishekshinde034@gmail.com",
    pass: "wabxochcvtuwfqou", 
  },
});

  // Update transaction status
app.put('/stored-transactions/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Transaction.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// Delete transaction
app.delete('/stored-transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

  
app.get("/all-transactions", async (req, res) => {
  try {
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 20, // Adjust as needed
    });

    const transactions = paymentIntents.data.map((intent) => ({
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      created: intent.created,
      metadata: intent.metadata,
      receipt_email: intent.receipt_email,
    }));

    res.json(transactions);
  } catch (error) {
    console.error("Stripe fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});



// Admin Login
app.post("/adminlogin", async (req, res) => {
  const { email, password } = req.body;
  const user = await SignupModel.findOne({ email });

  if (user) {
    if (user.password === password) {
      // Remove password from response
      const { password, ...userWithoutPassword } = user._doc;
      res.json({ success: true, user: userWithoutPassword });
    } else {
      res.json({ success: false, message: "Incorrect password" });
    }
  } else {
    res.json({ success: false, message: "User does not exist" });
  }
});
// User Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await SignupModel.findOne({ email });

  if (user) {
    if (user.password === password) {
      // Remove password from response
      const { password, ...userWithoutPassword } = user._doc;
      res.json({ success: true, user: userWithoutPassword });
    } else {
      res.json({ success: false, message: "Incorrect password" });
    }
  } else {
    res.json({ success: false, message: "User does not exist" });
  }
 });

app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore.get(email);

  if (!record) {
    return res.json({ success: false, message: "OTP expired or not found" });
  }

  if (record.otp !== otp) {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.json({ success: false, message: "OTP expired" });
  }

  try {
    // Check if user already exists (avoid duplicate registration)
    const existingUser = await SignupModel.findOne({ email });
    if (existingUser) {
      otpStore.delete(email);
      return res.json({ success: false, message: "User already registered" });
    }

    // Save new user
    const newUser = await SignupModel.create(record.data);
    otpStore.delete(email);
    return res.json({ success: true, message: "User registered", user: newUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: "User registration failed" });
  }
});

app.post("/register", async (req, res) => {
  const { name, email, password, mobile } = req.body;

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP temporarily
  otpStore.set(email, { otp, data: { name, email, password, mobile }, expires: Date.now() + 5 * 60 * 1000 }); // 5 mins

  // Send email
  try {
    await transporter.sendMail({
      from: "abhishekshinde034@gmail.com",
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

    res.json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send OTP." });
  }
 });
app.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore.get(email);

  if (!record || record.purpose !== "reset") {
    return res.json({ success: false, message: "Invalid request or OTP expired" });
  }

  if (record.otp !== otp) {
    return res.json({ success: false, message: "Incorrect OTP" });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.json({ success: false, message: "OTP expired" });
  }

  try {
    await SignupModel.updateOne({ email }, { password: newPassword });
    otpStore.delete(email);
    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});
app.post("/send-reset-otp", async (req, res) => {
  const { email } = req.body;
  const user = await SignupModel.findOne({ email });

  if (!user) return res.json({ success: false, message: "User not found" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(email, { otp, purpose: "reset", expires: Date.now() + 5 * 60 * 1000 });

  try {
    await transporter.sendMail({
      from: "your-email@gmail.com",
      to: email,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is: ${otp}`,
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});


// Product routes
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/add-product", async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/delete-product/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/update-product/:id", async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/create-payment-intent", async (req, res) => {
  const { totalAmount, customer_email, metadata } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "inr",
      receipt_email: customer_email,
      automatic_payment_methods: { enabled: true },
      metadata: {
        name: metadata.name,
        phone: metadata.phone,
        email: customer_email,
      },
    });

    // Save transaction in MongoDB
    const transaction = new Transaction({
      stripeId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      created: new Date(paymentIntent.created * 1000),
      name: metadata.name,
      phone: metadata.phone,
      email: customer_email,
    });

    await transaction.save();

    res.send({ clientSecret: paymentIntent.client_secret });
    
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

app.get("/stored-transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    console.error("MongoDB fetch error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});


app.post("/pending-orders", async (req, res) => {
  try {
    const { cart, totalAmount, shippingAddress } = req.body;

    if (!cart || cart.length === 0 || !shippingAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newOrder = new Order({
      cart,
      totalAmount,
      shippingAddress,
      status: "pending",
      createdAt: new Date(),
    });

    await newOrder.save();

    res.status(200).json({ message: "Order saved successfully" });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Server error while saving order" });
  }
});



app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find();  // Assuming you're using Mongoose
    res.status(200).json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Server error while fetching orders" });
  }
});


app.get("/orders/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const orders = await Order.find({ "shippingAddress.email": email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Server error fetching orders" });
  }
});
// Update order
app.put("/orders/:id", async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Delete order
app.delete("/orders/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});


// Contact form submission
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newContact = new Contact({ name, email, message });
    await newContact.save();

    res.status(201).json({ message: "Contact form submitted successfully" });
  } catch (err) {
    console.error("Error saving contact form:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }); // Latest first
    res.json(contacts);
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ error: "Server error while fetching contacts" });
  }
});

// Dashboard Summary Route
app.get("/dashboard-summary", async (req, res) => {
  try {
    const successfulTransactions = await Transaction.find({ status: "success" });
    const totalRevenue = successfulTransactions.reduce((sum, txn) => sum + txn.amount, 0);

    const totalOrders = await Order.countDocuments();
    const totalCustomers = await SignupModel.countDocuments();
    const totalProducts = await Product.countDocuments();

    // Get top 5 selling products (you need 'sold' field in product schema for this)
    const topProducts = await Product.find().sort({ sold: -1 }).limit(5).select("name sold");

    res.json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      topProducts,
    });
  } catch (err) {
    console.error("Error fetching dashboard summary:", err);
    res.status(500).json({ error: "Server error" });
  }
});






// Server Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});