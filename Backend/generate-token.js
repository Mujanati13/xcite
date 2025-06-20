#!/usr/bin/env node

/**
 * JWT Token Generator for X-Cite Property Table
 * Uses the backend Express.js server to generate authentic JWT tokens
 */

const jwt = require('jsonwebtoken');

// Configuration - matches backend auth.js
const JWT_SECRET = 'test20242025';
const SECRET_KEY = 'test20242025';

/**
 * Generate a JWT token using the same logic as the backend
 * @param {number} days - Expiration days (default: 30)
 * @returns {string} JWT token
 */
function generateJWT(days = 30) {
    const token = jwt.sign(
        { 
            authenticated: true,
            timestamp: Date.now(),
            generatedBy: 'token-generator-script'
        }, 
        JWT_SECRET, 
        { 
            expiresIn: `${days}d` 
        }
    );

    return token;
}

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @returns {boolean} Whether the token is valid
 */
function verifyJWT(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return false;
    }
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);
    
    console.log('\n🔐 X-Cite Backend JWT Token Generator');
    console.log('=====================================');
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('\nUsage:');
        console.log('  node generate-token.js [options]');
        console.log('\nOptions:');
        console.log('  --days <number>    Token expiration days (default: 30)');
        console.log('  --verify <token>   Verify an existing token');
        console.log('  --info             Show current configuration');
        console.log('  --help, -h         Show this help message');
        console.log('\nExamples:');
        console.log('  node generate-token.js');
        console.log('  node generate-token.js --days 7');
        console.log('  node generate-token.js --verify "your-jwt-token-here"');
        console.log('  node generate-token.js --info');
        return;
    }
    
    if (args.includes('--info')) {
        console.log('\n📋 Current Configuration:');
        console.log(`🔑 Secret Key for Login: "${SECRET_KEY}"`);
        console.log(`🔐 JWT Secret: "${JWT_SECRET.substring(0, 10)}..."`);
        console.log(`🌐 Backend URL: http://localhost:5000/api/auth/login`);
        console.log('\n📝 Instructions:');
        console.log('1. Start the backend server: npm run dev');
        console.log(`2. Use secret key "${SECRET_KEY}" in the property table login`);
        console.log('3. Or generate a token below and use it programmatically');
        return;
    }
    
    // Check for token verification
    const verifyIndex = args.indexOf('--verify');
    if (verifyIndex !== -1 && args[verifyIndex + 1]) {
        const tokenToVerify = args[verifyIndex + 1];
        console.log('\n🔍 Verifying Token...');
        
        const decoded = verifyJWT(tokenToVerify);
        if (decoded) {
            console.log('✅ Token is VALID');
            console.log('📄 Token Details:');
            console.log(JSON.stringify(decoded, null, 2));
            
            const expiryDate = new Date(decoded.exp * 1000);
            console.log(`⏰ Expires: ${expiryDate.toLocaleString()}`);
            
            const now = new Date();
            if (expiryDate > now) {
                const timeLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                console.log(`⏳ Time remaining: ${timeLeft} days`);
            } else {
                console.log('❌ Token has EXPIRED');
            }
        } else {
            console.log('❌ Token is INVALID or EXPIRED');
        }
        return;
    }
    
    let days = 30;
    
    // Parse days argument
    const daysIndex = args.indexOf('--days');
    if (daysIndex !== -1 && args[daysIndex + 1]) {
        days = parseInt(args[daysIndex + 1]);
        if (isNaN(days) || days <= 0) {
            console.error('❌ Error: Days must be a positive number');
            return;
        }
    }
    
    // Generate token
    const token = generateJWT(days);
    const expirationDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
      console.log(`\n✅ JWT Token Generated Successfully!`);
    console.log(`📅 Expires: ${expirationDate.toLocaleString()}`);
    console.log(`⏰ Valid for: ${days} days`);
    console.log(`\n🎫 Generated JWT Token for Frontend Login:`);
    console.log(`${token}`);
    console.log(`\n📝 Usage Instructions:`);
    console.log(`\n🌐 Frontend Login:`);
    console.log(`1. Start backend server: npm run dev`);
    console.log(`2. Open frontend application`);
    console.log(`3. Enter the JWT token above (copy the entire token)`);
    console.log(`4. Session expires after 5 minutes of inactivity`);
    console.log(`\n🔧 Generate New Token API:`);
    console.log(`curl -X POST http://localhost:5000/api/auth/generate-token \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"secretKey": "${SECRET_KEY}"}'`);
    console.log(`\n🛡️ API Requests with Token:`);
    console.log(`curl -X GET http://localhost:5000/api/properties \\`);
    console.log(`  -H "Authorization: Bearer ${token.substring(0, 20)}..."`);
    console.log(`\n⚠️  Security Notes:`);
    console.log(`- Keep the secret key secure`);
    console.log(`- Tokens are stored in browser sessionStorage`);
    console.log(`- Frontend sessions expire after 5 minutes`);
    console.log(`- Backend tokens are valid for ${days} days\n`);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { generateJWT, verifyJWT, SECRET_KEY, JWT_SECRET };
