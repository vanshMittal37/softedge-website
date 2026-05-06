require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
// Replace this with your actual MongoDB URI later!
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/softedge';

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schemas
const Contact = mongoose.model('Contact', new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  service: String,
  message: String,
  created_at: { type: Date, default: Date.now }
}));

const Feedback = mongoose.model('Feedback', new mongoose.Schema({
  name: String,
  rating: Number,
  comment: String,
  created_at: { type: Date, default: Date.now }
}));

const Visitor = mongoose.model('Visitor', new mongoose.Schema({
  ip: String,
  user_agent: String,
  visited_at: { type: Date, default: Date.now }
}));

const Setting = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
}));

// Basic Auth Middleware for Admin Routes
let adminUser = 'admin';
let adminPass = 'adminpassword';

// Load credentials from DB
Setting.findOne({ key: 'auth' }).then(setting => {
  if (setting) {
    adminUser = setting.value.username;
    adminPass = setting.value.password;
  } else {
    new Setting({ key: 'auth', value: { username: adminUser, password: adminPass } }).save().catch(e => console.log(e));
  }
}).catch(err => console.error("Database connection issue (Settings not loaded):", err.message));

const authMiddleware = (req, res, next) => {
  if (req.path === '/admin.html' || req.path.startsWith('/api/admin')) {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login === adminUser && password === adminPass) {
      return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required. Please enter admin credentials.');
  } else {
    next();
  }
};

app.use(authMiddleware);
app.use(express.static(path.join(__dirname)));

// Track visitor
app.post('/api/visit', async (req, res) => {
  try {
    const { ip, userAgent } = req.body;
    const visitor = new Visitor({ ip, user_agent: userAgent });
    await visitor.save();
    res.json({ success: true, id: visitor._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required.' });
    
    const contact = new Contact({ name, email, phone, service, message });
    await contact.save();
    res.json({ success: true, id: contact._id, message: 'Thank you! We will get back to you soon.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback form
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) return res.status(400).json({ error: 'All fields are required.' });
    
    const feedback = new Feedback({ name, rating, comment });
    await feedback.save();
    res.json({ success: true, id: feedback._id, message: 'Thanks for your feedback!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoints
app.post('/api/admin/change-auth', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    
    adminUser = username;
    adminPass = password;
    await Setting.findOneAndUpdate(
      { key: 'auth' }, 
      { value: { username, password } }, 
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ created_at: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/feedback', async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ created_at: -1 });
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ visited_at: -1 }).limit(100);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`SoftEdge backend running at http://localhost:${PORT}`));
