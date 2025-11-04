const express = require('express');
const redis = require('redis');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// ============================================
// REDIS CONNECTION
// ============================================
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: 6379
  }
});

redisClient.on('error', (err) => console.error('Redis Error', err));
redisClient.on('connect', () => console.log('✅ Order Service: Connected to Redis'));

// Connect to Redis
redisClient.connect();

// ============================================
// MONGODB CONNECTION
// ============================================
const mongoUrl = `mongodb://${process.env.MONGO_USER || 'admin'}:${process.env.MONGO_PASSWORD || 'admin_password'}@${process.env.MONGO_HOST || 'mongodb'}:27017`;
const mongoClient = new MongoClient(mongoUrl);
let ordersCollection;

async function connectMongoDB() {
  try {
    await mongoClient.connect();
    console.log('✅ Order Service: Connected to MongoDB');
    
    const database = mongoClient.db('cloudeats_orders');
    ordersCollection = database.collection('orders');
    
    // Create indexes
    await ordersCollection.createIndex({ userId: 1 });
    await ordersCollection.createIndex({ createdAt: -1 });
    await ordersCollection.createIndex({ status: 1 });
    
    console.log('✅ MongoDB indexes created');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Connect to MongoDB
connectMongoDB();

// ============================================
// HELPER FUNCTIONS
// ============================================
function getCartKey(userId) {
  return `cart:user:${userId}`;
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    service: 'order-service', 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// SHOPPING CART ROUTES (Redis)
// ============================================

// --- Get user's cart ---
// [COPY from your monolith: app.get('/api/cart/:userId', ...)]
app.get('/api/cart/:userId', async (req, res) => {
  const userId = req.params.userId;
  const cartKey = getCartKey(userId);
  
  try {
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.json({ items: [], total: 0 });
    }
    
    res.json(JSON.parse(cartData));
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// --- Add item to cart ---
// [COPY from your monolith: app.post('/api/cart/:userId/items', ...)]
app.post('/api/cart/:userId/items', async (req, res) => {
  const userId = req.params.userId;
  const { itemId, itemName, price, quantity } = req.body;
  const cartKey = getCartKey(userId);
  
  try {
    // Get current cart
    let cart = { items: [], total: 0 };
    const cartData = await redisClient.get(cartKey);
    
    if (cartData) {
      cart = JSON.parse(cartData);
    }
    
    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        itemId,
        itemName,
        price,
        quantity
      });
    }
    
    // Calculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Save to Redis with 24 hour expiration
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));
    
    res.json(cart);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// --- Update item quantity ---
// [COPY from your monolith if you have this route]
app.put('/api/cart/:userId/items/:itemId', async (req, res) => {
  const userId = req.params.userId;
  const itemId = parseInt(req.params.itemId);
  const { quantity } = req.body;
  const cartKey = getCartKey(userId);
  
  try {
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    const cart = JSON.parse(cartData);
    const itemIndex = cart.items.findIndex(item => item.itemId === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }
    
    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Save to Redis
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));
    
    res.json(cart);
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// --- Clear cart ---
app.delete('/api/cart/:userId', async (req, res) => {
  const userId = req.params.userId;
  const cartKey = getCartKey(userId);
  
  try {
    await redisClient.del(cartKey);
    res.json({ message: 'Cart cleared', items: [], total: 0 });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ============================================
// ORDER ROUTES (MongoDB)
// ============================================

// --- Place order ---
// [COPY from your monolith: app.post('/api/orders', ...)]
app.post('/api/orders', async (req, res) => {
  const { userId, deliveryAddress, notes, paymentMethod } = req.body;
  
  if (!userId || !deliveryAddress) {
    return res.status(400).json({ error: 'User ID and delivery address are required' });
  }
  
  try {
    // Get cart from Redis
    const cartKey = getCartKey(userId);
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    const cart = JSON.parse(cartData);
    
    if (cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Create order document
    const order = {
      userId: parseInt(userId),
      items: cart.items,
      totalAmount: cart.total,
      deliveryAddress,
      notes: notes || '',
      paymentMethod: paymentMethod || 'cash',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert into MongoDB
    const result = await ordersCollection.insertOne(order);
    
    // Clear cart after successful order
    await redisClient.del(cartKey);
    
    res.status(201).json({
      message: 'Order placed successfully',
      orderId: result.insertedId,
      order: { ...order, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// --- Get user's orders ---
// [COPY from your monolith: app.get('/api/orders/user/:userId', ...)]
app.get('/api/orders/user/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const orders = await ordersCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(orders);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// --- Get specific order ---
app.get('/api/orders/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  
  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// --- Update order status ---
app.put('/api/orders/:orderId/status', async (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ message: 'Order status updated', status });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Order Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});