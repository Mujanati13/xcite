const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Secret keys - hardcoded for simplicity
const JWT_SECRET = 'test20242025';
const SECRET_KEY = 'test20242025';

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

// Login endpoint - validates JWT token directly
router.post('/login', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'JWT token is required'
      });
    }

    // Verify the JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Token is valid
      res.json({
        success: true,
        message: 'Authentication successful',
        token: token,
        expiresIn: '30d',
        user: decoded
      });

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired JWT token'
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
});

// Generate token endpoint - creates a new JWT token
router.post('/generate-token', (req, res) => {
  try {
    const { secretKey } = req.body;

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Secret key is required to generate token'
      });
    }

    // Validate secret key
    if (secretKey !== SECRET_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Invalid secret key'
      });
    }

    // Generate JWT token with 30 days expiration
    const token = jwt.sign(
      { 
        authenticated: true,
        timestamp: Date.now()
      }, 
      JWT_SECRET, 
      { 
        expiresIn: '30d' 
      }
    );

    res.json({
      success: true,
      message: 'Token generated successfully',
      token: token,
      expiresIn: '30d'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token generation'
    });
  }
});

// Verify token endpoint
router.post('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// Logout endpoint (optional - mainly for client-side token cleanup)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = { router, authenticateToken };
