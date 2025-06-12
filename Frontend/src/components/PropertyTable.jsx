import { useState, useEffect } from "react";
import axios from "axios";
import "./PropertyTable.css";

const API_BASE_URL = "http://localhost:5000/api";

function PropertyTable() {
  const [properties, setProperties] = useState([]);
  const [maklerIdFilter, setMaklerIdFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProperties(1); // Reset to page 1 when filter changes
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [maklerIdFilter]);

  const fetchProperties = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.recordsPerPage.toString(),
      });

      if (maklerIdFilter) {
        params.append("makler_id", maklerIdFilter);
      }

      const url = `${API_BASE_URL}/properties?${params.toString()}`;
      const response = await axios.get(url);

      if (response.data.success) {
        setProperties(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      setProperties([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        recordsPerPage: 50,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setMaklerIdFilter(e.target.value);
  };
  const clearFilter = () => {
    setMaklerIdFilter("");
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchProperties(newPage);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.hasPreviousPage) {
      handlePageChange(pagination.currentPage - 1);
    }
  };
  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.currentPage + 1);
    }
  };

  const fetchContracts = async (propertyId) => {
    try {
      setLoadingContracts(true);
      const response = await axios.get(
        `${API_BASE_URL}/contracts/${propertyId}`
      );
      if (response.data.success) {
        setContracts(response.data.data);
        setSelectedPropertyId(propertyId);
        setShowPopup(true);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  const handleShowContracts = (propertyId) => {
    fetchContracts(propertyId);
  };

  const closePopup = () => {
    setShowPopup(false);
    setSelectedPropertyId(null);
    setContracts([]);
  };
  return (
    <div className="property-table-container">
      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="makler-filter">Filter Makler-ID:</label>
          <input
            type="number"
            id="makler-filter"
            value={maklerIdFilter}
            onChange={handleFilterChange}
            // placeholder="Alle anzeigen"
            min="1"
          />
        </div>
        {maklerIdFilter && (
          <button className="clear-filter-btn" onClick={clearFilter}>
            Alle anzeigen
          </button>
        )}
      </div>{" "}
      {/* Property Count Display */}
      <div className="property-count">
      ({pagination.totalRecords} total, Page{" "}
        {pagination.currentPage} of {pagination.totalPages})
      </div>
      {/* Table */}
      <div className="property-table">
        {loading ? (
          <div className="loading-message">Lade Daten...</div>
        ) : (
          <>
            {" "}
            {/* Table Header */}
            <div className="table-header">
              {/* <div className="header-cell">Makler</div> */}
              <div className="header-cell">Strasse</div>
              <div className="header-cell">Hausnummer</div>
              <div className="header-cell">PLZ</div>
              <div className="header-cell">Ort</div>
              <div className="header-cell">B2B-Verträge</div>
              <div className="header-cell">XCW-Verträge</div>
              <div className="header-cell">liefernde</div>
              <div className="header-cell">Aktionen</div>
            </div>
            {/* Table Body */}
            <div className="table-body">
              {properties.length === 0 ? (
                <div className="no-data">Keine Daten gefunden</div>
              ) : (
                properties.map((property, index) => (
                  <div key={property.id || index} className="table-row">
                    {/* <div className="table-cell makler-cell">
                      <span className="makler-name">Cagla, Kamisi</span>
                    </div> */}
                    <div className="table-cell">{property.strasse || "-"}</div>
                    <div className="table-cell">
                      {property.hausnummer || "-"}
                    </div>
                    <div className="table-cell">{property.plz || "-"}</div>
                    <div className="table-cell">{property.ort || "-"}</div>
                    <div className="table-cell b2b-cell">
                      <span className="contract-number">
                        {property.meter_count || 0}
                      </span>
                    </div>
                    <div className="table-cell xcw-cell">-</div>
                    <div className="table-cell date-cell">
                      {property.erstellt_am
                        ? new Date(property.erstellt_am).toLocaleDateString(
                            "de-DE"
                          )
                        : new Date().toLocaleDateString("de-DE")}
                    </div>
                    <div className="table-cell action-cell">
                      <button
                        className="view-contracts-btn"
                        onClick={() => handleShowContracts(property.id)}
                        disabled={loadingContracts}
                      >
                        {loadingContracts && selectedPropertyId === property.id
                          ? "Laden..."
                          : "Verträge"}
                      </button>
                    </div>
                  </div>
                ))
              )}{" "}
            </div>
          </>
        )}
      </div>{" "}
      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={handlePreviousPage}
            disabled={!pagination.hasPreviousPage}
          >
            Vorherige
          </button>

          <span className="pagination-info">
            Seite {pagination.currentPage} von {pagination.totalPages}
          </span>

          <button
            className="pagination-btn"
            onClick={handleNextPage}
            disabled={!pagination.hasNextPage}
          >
            Nächste
          </button>
        </div>
      )}
      {/* Contracts Popup */}
      {showPopup && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              {/* <h3>Verträge für Liegenschaft ID: {selectedPropertyId}</h3> */}
              <button className="close-btn" onClick={closePopup}>
                ×
              </button>
            </div>
            <div className="popup-body">
              {loadingContracts ? (
                <div className="loading">Lade Verträge...</div>
              ) : contracts.length === 0 ? (
                <div className="no-contracts">Keine Verträge gefunden</div>
              ) : (
                <div className="contracts-table">
                  <div className="contracts-header">
                    {/* <div className="contract-header-cell">ID</div> */}
                    <div className="contract-header-cell">Energieart</div>
                    {/* <div className="contract-header-cell">Zählernummer</div>
                    <div className="contract-header-cell">Status</div>
                    <div className="contract-header-cell">HT/NT</div>
                    <div className="contract-header-cell">Erstellt am</div> */}
                  </div>
                  {contracts.map((contract, index) => (
                    <div key={contract.id || index} className="contract-row">
                      {/* <div className="contract-cell">{contract.id}</div> */}
                      <div className="contract-cell">
                        <span
                          className={`energy-badge ${
                            contract.energieart?.toLowerCase() || "strom"
                          }`}
                        >
                          {contract.energieart || "Strom"}
                        </span>
                      </div>
                      {/* <div className="contract-cell">{contract.zaehlernummer || '-'}</div>
                      <div className="contract-cell">{contract.zaehlerstatus || '-'}</div>
                      <div className="contract-cell">{contract.ht_nt || '-'}</div>
                      <div className="contract-cell">
                        {contract.erstellt_am ? 
                          new Date(contract.erstellt_am).toLocaleDateString('de-DE') : 
                          '-'
                        }
                      </div> */}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyTable;
