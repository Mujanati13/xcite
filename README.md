### XCite Docs - v1

## Table of Contents
1. [Technology Stack](#1-technology-stack)
2. [Backend Configuration](#2-backend-configuration)
3. [Frontend Configuration](#3-frontend-configuration)
4. [API Documentation](#4-api-documentation)
5. [Firebase + MySQL Integration](#5-firebase--mysql-integration)
6. [Installation & Setup](#6-installation--setup)
7. [Development Scripts](#7-development-scripts)

---

## 1. Technology Stack

### Frontend Technologies
- **React**: v19.1.0 (Latest version)
- **Vite**: Development server and build tool
- **Axios**: v1.9.0 - HTTP client for API calls
- **Firebase**: v11.9.1 - Firestore for data exports

### Backend Technologies
- **Node.js**: Runtime environment
- **Express**: Web framework
- **MySQL**: Primary database
- **Sequelize**: ORM for database operations

---

## 2. Backend Configuration

#### 1. Database Configuration (`Backend/config/database.js`)
```javascript
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER, 
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);
```

#### 2. Environment Variables
Create a `.env` file in the Backend directory:
```env
DB_NAME=dbname
DB_USER=dbuser
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=3306
PORT=5000
```

#### 3. Server Configuration (`Backend/server.js`)
- **Port**: 5000 (default)
- **CORS**: Enabled for cross-origin requests (optionell) 


---

## 3. Frontend Configuration

#### 1. Firebase Configuration (`Frontend/src/firebase/config.js`)
```javascript
const firebaseConfig = {
  apiKey: "-0",
  authDomain: "xcite-fc",
  projectId: "xci",
  storageBucket: ".firebasestorage.app",
  messagingSenderId: "",
  appId: "1:327413887"
};
```

---

## 4. API Documentation

### Frontend-Backend Communication
The frontend communicates with the backend through HTTP requests using Axios:

```javascript
const API_BASE_URL = "http://ip-address:5000/api"; // using the backend ip-address 
```

### API Endpoints

#### 1. Get Properties
```
GET /api/properties?makler_id=1&page=1&limit=50
```
- **Logic**: Fetch properties from MySQL with pagination and makler filtering
- **Makler Filter**: Use `makler_id` parameter to filter properties by specific makler
- **Pagination**: Use `page` and `limit` parameters for data pagination
- **Returns**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "makler_id": 456,
      "plz": "12345",
      "status": 1,
      "ort": "Berlin",
      "strasse": "Main Street",
      "hausnummer": "45",
      "bemerkung_objekt": "Nice property",
      "leistungsempfaenger_name": "John Doe",
      "erstellt_am": "2025-06-18T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalRecords": 500,
    "hasNextPage": true
  }
}
```

#### 2. Get Contracts
```
GET /api/contracts/123
```
- **Logic**: Fetch related contracts from MySQL for specific property
- **Returns**:
```json
{
  "success": true,
  "data": [
    {
      "vertrag_id": 789,
      "liegenschaft_id": 123,
      "vertragsnummer": "V-2025-001",
      "status": "active",
      "start_datum": "2025-01-01",
      "ende_datum": "2025-12-31"
    }
  ]
}
```

---

## 6. Installation & Setup

### Backend Setup
1. Navigate to Backend directory:
   ```powershell
   cd Backend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Create `.env` file with database credentials

4. Start development server:
   ```powershell
   npm run dev
   ```
   Or production server:
   ```powershell
   npm start
   ```

### Frontend Setup
1. Navigate to Frontend directory:
   ```powershell
   cd Frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start development server:
   ```powershell
   npm run dev
   ```

4. Build for production:
   ```powershell
   npm run build
   ```

### Running the Full Application
1. Start the backend server (port 5000)
2. makler_id 1
3. Start the frontend development server (port 3000)
4. Access the application at `http://ip-address:3000`

---

## 7. Development Scripts

### Backend Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (not configured)

### Frontend Scripts
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

---

## 5. Firebase + MySQL Integration

### Simple Architecture
```
Frontend → MySQL (Primary Data) → Firebase (Export Storage)
```

### How It Works
1. **MySQL**: Stores all property data (main database)
2. **Firebase**: Stores exported property data for tracking

### Firebase Logic

#### Export Process
```javascript
// Select properties → Save to Firebase collection "property_exports"
const exportData = {
  exportDate: serverTimestamp(),
  properties: selectedProperties
};
await addDoc(collection(db, "property_exports"), exportData);
```


