const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection and sync
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected successfully');
    console.log('Connected to database: xcite');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// API 1: Get all properties with optional makler filter and pagination
app.get('/api/properties', async (req, res) => {
  try {
    const { makler_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
      let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM xs_liegenschaften p
    `;
    
    let query = `
      SELECT 
        p.id,
        p.makler_id,
        p.plz,
        p.status,
        p.ort,
        p.strasse,
        p.hausnummer,
        p.bemerkung_objekt,
        p.erstellt_am,
        p.aktualisiert_am,
        p.leistungsempfaenger_name,
        p.leistungsempfaenger_strasse,
        p.leistungsempfaenger_hnr,
        p.leistungsempfaenger_plz,
        p.leistungsempfaenger_ort,
        COALESCE(COUNT(z.id), 0) as meter_count
      FROM xs_liegenschaften p
      LEFT JOIN xs_liegenschaften_zaehler z ON p.id = z.xs_liegenschaften_id
    `;
    
    const replacements = {};
      if (makler_id) {
      countQuery += ` WHERE p.makler_id = :makler_id`;
      query += ` WHERE p.makler_id = :makler_id`;
      replacements.makler_id = makler_id;
    }
    
    query += ` GROUP BY p.id ORDER BY p.id LIMIT :limit OFFSET :offset`;
    replacements.limit = parseInt(limit);
    replacements.offset = parseInt(offset);
    
    // Get total count
    const countResult = await sequelize.query(countQuery, {
      replacements: makler_id ? { makler_id } : {},
      type: sequelize.QueryTypes.SELECT
    });
    
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Get paginated results
    const results = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      message: makler_id ? `Properties for agent ID ${makler_id} retrieved successfully` : 'All properties retrieved successfully',
      data: results,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalRecords: totalRecords,
        recordsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      count: results.length
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
});

// API 1b: Get properties by specific agent ID (backward compatibility)
app.get('/api/properties/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    const query = `
      SELECT 
        p.id,
        p.makler_id,
        p.plz,
        p.status,
        p.ort,
        p.strasse,
        p.hausnummer,
        p.bemerkung_objekt,
        p.erstellt_am,
        p.aktualisiert_am,
        p.leistungsempfaenger_name,
        p.leistungsempfaenger_strasse,
        p.leistungsempfaenger_hnr,
        p.leistungsempfaenger_plz,
        p.leistungsempfaenger_ort,
        z.energieart,
        z.zaehlernummer,
        z.zaehlerstatus,
        z.zaehlpunktbezeichnung,
        z.ht_nt
      FROM xs_liegenschaften p
      LEFT JOIN xs_liegenschaften_zaehler z ON p.id = z.xs_liegenschaften_id
      WHERE p.makler_id = :agentId
      ORDER BY p.id, z.id
    `;
    
    const results = await sequelize.query(query, {
      replacements: { agentId: agentId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      message: `Properties for agent ID ${agentId} retrieved successfully`,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
});

// API 2:
app.get('/api/contracts/:propertyId', async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    
    const query = `SELECT * FROM xs_liegenschaften_zaehler WHERE xs_liegenschaften_zaehler.xs_liegenschaften_id = :propertyId`;
    const results = await sequelize.query(query, {
      replacements: { propertyId: propertyId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      message: `Contracts for property ID ${propertyId} retrieved successfully`,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contracts',
      error: error.message
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'X-Cite Property Management API is running!',
    endpoints: {
      'GET /api/properties/:agentId': 'Get all properties for a specific agent (makler_id)',
      'GET /api/contracts/:propertyId': 'Get all contracts for a specific property (xs_liegenschaften_id)'
    },
    examples: {
      'Step 1': 'GET /api/properties/1 - Show properties under agent ID 1',
      'Step 2': 'GET /api/contracts/13 - Show contracts attached to property ID 13'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!' 
  });
});

const PORT = process.env.PORT || 5000;

// Connect to database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
