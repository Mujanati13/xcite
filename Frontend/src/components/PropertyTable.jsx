import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import "./PropertyTable.css";

const API_BASE_URL = "http://localhost:5000/api";

function PropertyTable() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [authError, setAuthError] = useState("");
  const [showAuthForm, setShowAuthForm] = useState(true);

  const [properties, setProperties] = useState([]);
  const [maklerIdFilter, setMaklerIdFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [savedToFirebase, setSavedToFirebase] = useState(new Set()); // Track which rows are saved to Firebase
  const [firebaseDocIds, setFirebaseDocIds] = useState(new Map()); // Map property IDs to Firebase document IDs
  const [propertyContracts, setPropertyContracts] = useState({});
  const [loadingPropertyContracts, setLoadingPropertyContracts] =
    useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [contractSortConfig, setContractSortConfig] = useState({});

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success", // 'success', 'error', 'warning', 'info'
  }); // Authentication functions
  const handleAuth = async () => {
    if (!secretKey.trim()) {
      setAuthError("Please enter a JWT token");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        token: secretKey,
      });

      if (response.data.success) {
        // Store token in sessionStorage with 5-minute expiration
        const authData = {
          token: response.data.token,
          timestamp: Date.now(),
          expiry: Date.now() + 5 * 60 * 1000, // 5 minutes
        };

        sessionStorage.setItem("x-cite-auth", JSON.stringify(authData));

        setIsAuthenticated(true);
        setShowAuthForm(false);
        setAuthError("");

        // Fetch properties after successful authentication
        fetchProperties(1);
      }
    } catch (error) {
      if (error.response?.data?.message) {
        setAuthError(error.response.data.message);
      } else {
        setAuthError("Authentication failed. Please check your JWT token.");
      }
    }
  };

  const checkAuthStatus = () => {
    const authData = sessionStorage.getItem("x-cite-auth");

    if (!authData) {
      return false;
    }

    try {
      const { token, expiry } = JSON.parse(authData);

      // Check if token is expired (5 minutes)
      if (Date.now() > expiry) {
        sessionStorage.removeItem("x-cite-auth");
        return false;
      }

      return true;
    } catch (error) {
      sessionStorage.removeItem("x-cite-auth");
      return false;
    }
  };

  const getAuthToken = () => {
    const authData = sessionStorage.getItem("x-cite-auth");
    if (!authData) return null;

    try {
      const { token, expiry } = JSON.parse(authData);

      // Check if token is expired
      if (Date.now() > expiry) {
        sessionStorage.removeItem("x-cite-auth");
        return null;
      }

      return token;
    } catch (error) {
      sessionStorage.removeItem("x-cite-auth");
      return null;
    }
  };
  const logout = () => {
    sessionStorage.removeItem("x-cite-auth");
    setIsAuthenticated(false);
    setShowAuthForm(true);
    setSecretKey("");
    setAuthError("");
  };

  useEffect(() => {
    // Check authentication status on component mount
    const isAuth = checkAuthStatus();
    setIsAuthenticated(isAuth);
    setShowAuthForm(!isAuth);

    // Only fetch properties if authenticated
    if (isAuth) {
      const timeoutId = setTimeout(() => {
        fetchProperties(1); // Reset to page 1 when filter changes
      }, 300); // 300ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [maklerIdFilter]);

  // Show notification function
  const showNotification = (message, type = "success") => {
    setNotification({
      show: true,
      message,
      type,
    });

    // Only auto hide for warning and error notifications (not loading or success)
    if (type === "warning" || type === "error") {
      setTimeout(() => {
        setNotification((prev) => ({ ...prev, show: false }));
      }, 4000);
    }
  };

  // Sorting functions
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleContractSort = (propertyId, key) => {
    let direction = "asc";
    if (
      contractSortConfig[propertyId]?.key === key &&
      contractSortConfig[propertyId]?.direction === "asc"
    ) {
      direction = "desc";
    }
    setContractSortConfig({
      ...contractSortConfig,
      [propertyId]: { key, direction },
    });
  };

  const sortedProperties = React.useMemo(() => {
    if (!sortConfig.key) return properties;

    return [...properties].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [properties, sortConfig]);

  const getSortedContracts = (propertyId, contracts) => {
    const config = contractSortConfig[propertyId];
    if (!config || !config.key) return contracts;

    return [...contracts].sort((a, b) => {
      const aValue = a[config.key];
      const bValue = b[config.key];

      if (aValue < bValue) {
        return config.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return config.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };
  const fetchProperties = async (page = 1) => {
    try {
      setLoading(true);
      const token = getAuthToken();

      if (!token) {
        logout();
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.recordsPerPage.toString(),
      });

      if (maklerIdFilter) {
        params.append("makler_id", maklerIdFilter);
      }

      const url = `${API_BASE_URL}/properties?${params.toString()}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setProperties(response.data.data);
        setPagination(response.data.pagination);
        // Clear selection when properties change and filter out non-selectable items
        setSelectedRows(new Set());
        // Fetch contracts for all properties
        fetchAllPropertyContracts(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
        return;
      }
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
      const token = getAuthToken();

      if (!token) {
        logout();
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/contracts/${propertyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setContracts(response.data.data);
        setSelectedPropertyId(propertyId);
        setShowPopup(true);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
        return;
      }
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  };
  const handleShowContracts = (propertyId) => {
    fetchContracts(propertyId);
  };
  const fetchAllPropertyContracts = async (propertiesList) => {
    try {
      setLoadingPropertyContracts(true);
      const contractsData = {};
      const token = getAuthToken();

      if (!token) {
        logout();
        return;
      }

      // Fetch contracts for each property
      await Promise.all(
        propertiesList.map(async (property) => {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/contracts/${property.id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (response.data.success) {
              contractsData[property.id] = response.data.data;
            }
          } catch (error) {
            console.error(
              `Error fetching contracts for property ${property.id}:`,
              error
            );
            if (
              error.response?.status === 401 ||
              error.response?.status === 403
            ) {
              logout();
              return;
            }
            contractsData[property.id] = [];
          }
        })
      );

      setPropertyContracts(contractsData);
    } catch (error) {
      console.error("Error fetching property contracts:", error);
    } finally {
      setLoadingPropertyContracts(false);
    }
  };
  const closePopup = () => {
    setShowPopup(false);
    setSelectedPropertyId(null);
    setContracts([]);
  };
  // Checkbox handling functions
  const handleSelectRow = (propertyId) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property && property.status === 1) {
      const newSelectedRows = new Set(selectedRows);
      if (newSelectedRows.has(propertyId)) {
        newSelectedRows.delete(propertyId);
      } else {
        newSelectedRows.add(propertyId);
      }
      setSelectedRows(newSelectedRows);
    }
  };
  const handleSelectAll = () => {
    const selectableProperties = properties.filter(
      (property) => property.status === 1
    );
    if (
      selectedRows.size === selectableProperties.length &&
      selectableProperties.length > 0
    ) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(
        new Set(selectableProperties.map((property) => property.id))
      );
    }
  };

  // Check if all current page records are already saved in Firebase
  const areAllCurrentRecordsSaved = () => {
    const selectableProperties = properties.filter(
      (property) => property.status === 1
    );

    if (selectableProperties.length === 0) {
      return true; // No selectable properties, so hide the checkbox
    }

    return selectableProperties.every((property) =>
      savedToFirebase.has(property.id)
    );
  };
  const exportSelectedRows = async () => {
    const selectedProperties = properties.filter(
      (property) => selectedRows.has(property.id) && property.status === 1
    );

    if (selectedProperties.length === 0) {
      showNotification("Please select at least one row to export.", "warning");
      return;
    }

    // Filter out properties that are already saved to Firebase
    const newProperties = selectedProperties.filter(
      (property) => !savedToFirebase.has(property.id)
    );

    const alreadySavedCount = selectedProperties.length - newProperties.length;

    if (newProperties.length === 0) {
      showNotification(
        `All selected properties (${alreadySavedCount}) are already saved in Firebase.`,
        "info"
      );
      return;
    }
    try {
      // Show loading notification
      showNotification("Bitte warte", "loading");

      // Fetch contracts for all new properties
      const contractsData = {};
      await Promise.all(
        newProperties.map(async (property) => {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/contracts/${property.id}`
            );
            if (response.data.success) {
              contractsData[property.id] = response.data.data;
            } else {
              contractsData[property.id] = [];
            }
          } catch (error) {
            console.error(
              `Error fetching contracts for property ${property.id}:`,
              error
            );
            contractsData[property.id] = [];
          }
        })
      );

      // Prepare export data with full property information and linked contracts
      const exportData = {
        exportDate: serverTimestamp(),
        exportedBy: "user", // You can replace this with actual user info
        propertiesCount: newProperties.length,
        totalContractsCount: Object.values(contractsData).reduce(
          (total, contracts) => total + contracts.length,
          0
        ),
        properties: newProperties.map((property) => ({
          // Full property data
          id: property.id,
          status: property.status,
          strasse: property.strasse || "",
          hausnummer: property.hausnummer || "",
          plz: property.plz || "",
          ort: property.ort || "",
          leistungsempfaenger_name: property.leistungsempfaenger_name || "",
          leistungsempfaenger_strasse:
            property.leistungsempfaenger_strasse || "",
          leistungsempfaenger_hnr: property.leistungsempfaenger_hnr || "",
          leistungsempfaenger_plz: property.leistungsempfaenger_plz || "",
          leistungsempfaenger_ort: property.leistungsempfaenger_ort || "",
          makler_id: property.makler_id || null,
          b2b: property.b2b || "",
          xcw: property.xcw || "",
          created_on: property.created_on || null,
          updated_on: property.updated_on || null,
          // Add any other property fields that exist
          ...Object.keys(property).reduce((acc, key) => {
            if (!acc.hasOwnProperty(key)) {
              acc[key] = property[key];
            }
            return acc;
          }, {}),

          // Linked contracts
          contracts: contractsData[property.id] || [],
          contractsCount: (contractsData[property.id] || []).length,
        })),
      };

      // Save to Firestore
      const docRef = await addDoc(
        collection(db, "property_exports"),
        exportData
      );
      console.log("Export data saved to Firebase with ID: ", docRef.id);

      // Update tracking state for newly saved properties
      const newSavedIds = new Set([
        ...savedToFirebase,
        ...newProperties.map((p) => p.id),
      ]);
      setSavedToFirebase(newSavedIds);

      // Update Firebase document IDs mapping
      const newDocIdMap = new Map(firebaseDocIds);
      newProperties.forEach((property) => {
        newDocIdMap.set(property.id, docRef.id);
      });
      setFirebaseDocIds(newDocIdMap);

      // Clear selection after successful export
      setSelectedRows(new Set());

      const totalContracts = Object.values(contractsData).reduce(
        (total, contracts) => total + contracts.length,
        0
      );
      const message = alreadySavedCount > 0 ? `` : ``;

      showNotification(message, "success");
    } catch (error) {
      console.error("Error saving export data to Firebase:", error);
      showNotification("Error saving export data. Please try again.", "error");
    }
  };

  // Edit functionality
  const handleEditRow = () => {
    if (selectedRows.size === 1) {
      const propertyId = Array.from(selectedRows)[0];
      const property = properties.find((p) => p.id === propertyId);
      if (property) {
        setEditingProperty(propertyId);
        setEditFormData({
          strasse: property.strasse || "",
          hausnummer: property.hausnummer || "",
          plz: property.plz || "",
          ort: property.ort || "",
          leistungsempfaenger_name: property.leistungsempfaenger_name || "",
          leistungsempfaenger_strasse:
            property.leistungsempfaenger_strasse || "",
          leistungsempfaenger_hnr: property.leistungsempfaenger_hnr || "",
          leistungsempfaenger_plz: property.leistungsempfaenger_plz || "",
          leistungsempfaenger_ort: property.leistungsempfaenger_ort || "",
        });
      }
    }
  };

  const handleEditChange = (field, value) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const handleSaveEdit = async () => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/properties/${editingProperty}`,
        editFormData
      );
      if (response.data.success) {
        // Update the properties list with the new data
        setProperties((prev) =>
          prev.map((property) =>
            property.id === editingProperty
              ? { ...property, ...editFormData }
              : property
          )
        );

        // Check if this property was previously saved to Firebase and update it there too
        if (savedToFirebase.has(editingProperty)) {
          try {
            await updatePropertyInFirebase(editingProperty, editFormData);
            console.log("Property also updated in Firebase");
          } catch (firebaseError) {
            console.warn(
              "Could not update property in Firebase:",
              firebaseError.message
            );
          }
        }
        setEditingProperty(null);
        setEditFormData({});
        showNotification("Property updated successfully!", "success");
      }
    } catch (error) {
      console.error("Error updating property:", error);
      showNotification("Error updating property.", "error");
    }
  };

  // Function to update property in Firebase
  const updatePropertyInFirebase = async (propertyId, updatedData) => {
    try {
      // Find all export documents containing this property
      const exportsRef = collection(db, "property_exports");
      const snapshot = await getDocs(exportsRef);

      const updatePromises = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.properties && Array.isArray(data.properties)) {
          const propertyIndex = data.properties.findIndex(
            (p) => p.id === propertyId
          );
          if (propertyIndex !== -1) {
            // Update the property data in this export document
            const updatedProperties = [...data.properties];
            updatedProperties[propertyIndex] = {
              ...updatedProperties[propertyIndex],
              strasse: updatedData.strasse || "",
              hausnummer: updatedData.hausnummer || "",
              plz: updatedData.plz || "",
              ort: updatedData.ort || "",
              leistungsempfaenger_name:
                updatedData.leistungsempfaenger_name || "",
              leistungsempfaenger_strasse:
                updatedData.leistungsempfaenger_strasse || "",
              leistungsempfaenger_hnr:
                updatedData.leistungsempfaenger_hnr || "",
              leistungsempfaenger_plz:
                updatedData.leistungsempfaenger_plz || "",
              leistungsempfaenger_ort:
                updatedData.leistungsempfaenger_ort || "",
            };

            const docRef = doc(db, "property_exports", docSnapshot.id);
            updatePromises.push(
              updateDoc(docRef, {
                properties: updatedProperties,
                lastUpdated: serverTimestamp(),
              })
            );
          }
        }
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error updating property in Firebase:", error);
      throw error;
    }
  };

  const handleCancelEdit = () => {
    setEditingProperty(null);
    setEditFormData({});
  };

  // Check which properties are already saved in Firebase
  const checkFirebaseSavedProperties = async (propertyIds) => {
    try {
      const savedIds = new Set();
      const docIdMap = new Map();

      // Query Firebase for existing exports containing these property IDs
      const exportsRef = collection(db, "property_exports");
      const snapshot = await getDocs(exportsRef);

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.properties && Array.isArray(data.properties)) {
          data.properties.forEach((property) => {
            if (propertyIds.includes(property.id)) {
              savedIds.add(property.id);
              docIdMap.set(property.id, doc.id);
            }
          });
        }
      });

      setSavedToFirebase(savedIds);
      setFirebaseDocIds(docIdMap);
    } catch (error) {
      console.error("Error checking Firebase saved properties:", error);
    }
  };

  // Update useEffect to check Firebase when properties are loaded
  useEffect(() => {
    if (properties.length > 0) {
      const propertyIds = properties.map((p) => p.id);
      checkFirebaseSavedProperties(propertyIds);
    }
  }, [properties]);

  return (
    <div className="property-table-container">
      {/* Authentication Form */}
      {showAuthForm && (
        <div className="auth-overlay">
          <div className="auth-form">
            <div className="auth-icon">🔐</div>{" "}
            <h2 className="auth-title">Access Required</h2>
            <p className="auth-description">
              Please enter your JWT token to access the property table
            </p>
            <div className="auth-input-group">
              <input
                type="password"
                className="auth-input"
                placeholder="Enter JWT token"
                value={secretKey}
                onChange={(e) => {
                  setSecretKey(e.target.value);
                  setAuthError("");
                }}
                onKeyPress={(e) => e.key === "Enter" && handleAuth()}
              />
              <button className="auth-button" onClick={handleAuth}>
                Access Table
              </button>
            </div>
            {authError && <div className="auth-error">{authError}</div>}
            <div className="auth-info">
              <small>Session expires after 5 minutes of inactivity</small>
            </div>
          </div>
        </div>
      )}{" "}
      {/* Main Table Content - Only show when authenticated */}
      {isAuthenticated && (
        <>
          {/* Logout Button */}{" "}
          {/* Modern Notification */}{" "}
          {notification.show && (
            <div className="modern-notification-overlay">
              <div className={`modern-notification ${notification.type}`}>
                <div className="notification-icon">
                  {" "}
                  {notification.type === "success" && (
                    <div className="success-checkmark">
                      <div className="checkmark-circle">
                        <svg
                          width="100"
                          height="100"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M9 12l2 2 4-4"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                  {notification.type === "error" && "✕"}
                  {notification.type === "warning" && "⚠"}
                  {notification.type === "info" && "ℹ"}
                  {notification.type === "loading" && (
                    <div className="loading-spinner">
                      <div className="spinner"></div>
                    </div>
                  )}
                </div>{" "}
                <h3 className="notification-title">
                  {notification.type === "success" &&
                    "Successfully exported to Firebase"}
                  {notification.type === "error" && "Error"}
                  {notification.type === "warning" && "Warning"}
                  {notification.type === "info" && "Information"}
                  {notification.type === "loading" && "Bitte warte"}
                </h3>
                <p className="notification-message">{notification.message}</p>
                {/* Only show OK button for non-loading notifications */}
                {notification.type !== "loading" && (
                  <button
                    className="notification-ok-btn"
                    onClick={() =>
                      setNotification((prev) => ({ ...prev, show: false }))
                    }
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Filter Section */}
          <div className="filter-section fixed-top">
            {" "}
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
            </div>{" "}
            {maklerIdFilter && (
              <button className="clear-filter-btn" onClick={clearFilter}>
                Show All
              </button>
            )}
            {/* Export Button - Always visible in top bar */}
            {selectedRows.size > 0 &&
              properties.some((p) => p.status === 1) && (
                <button className="export-btn" onClick={exportSelectedRows}>
                  {(() => {
                    const selectedProperties = properties.filter(
                      (property) =>
                        selectedRows.has(property.id) && property.status === 1
                    );
                    const newProperties = selectedProperties.filter(
                      (property) => !savedToFirebase.has(property.id)
                    );
                    const alreadySavedCount =
                      selectedProperties.length - newProperties.length;
                    if (newProperties.length === 0) {
                      return `All ${selectedProperties.length} selected are already saved`;
                    } else if (alreadySavedCount === 0) {
                      return `Export ${newProperties.length} new rows`;
                    } else {
                      return `Export ${newProperties.length} new (${alreadySavedCount} already saved)`;
                    }
                  })()}
                </button>
              )}
            {/* Clear Selection Button */}
            {selectedRows.size > 0 && (
              <button
                className="clear-selection-btn"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear Selection
              </button>
            )}
          </div>{" "}
          {/* Property Count Display */}
          <div className="property-count">
            ({pagination.totalRecords} total, Page {pagination.currentPage} of{" "}
            {pagination.totalPages})
          </div>{" "}
          {/* Table */}
          <div className="property-table">
            {" "}
            {loading ? (
              <div className="loading-message">Loading data...</div>
            ) : (
              <>
                {" "}
                {/* Table Header */}{" "}
                <div className="table-header">
                  {" "}
                  <div className="header-cell checkbox-cell">
                    {!areAllCurrentRecordsSaved() ? (
                      <>
                        <input
                          type="checkbox"
                          checked={
                            properties.filter((p) => p.status === 1).length >
                              0 &&
                            selectedRows.size ===
                              properties.filter((p) => p.status === 1).length
                          }
                          onChange={handleSelectAll}
                          className="select-all-checkbox"
                          title="Select all properties on this page that are not yet saved to Firebase"
                        />
                        <span>All</span>
                      </>
                    ) : (
                      <span
                        className="all-saved-indicator"
                        title="All properties on this page are already saved to Firebase"
                      >
                        ✓ All saved
                      </span>
                    )}
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "status"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "strasse"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("strasse")}
                  >
                    Strasse
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "hausnummer"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("hausnummer")}
                  >
                    Hnr
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "plz"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("plz")}
                  >
                    PLZ
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "ort"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("ort")}
                  >
                    Ort
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>{" "}
                  <div
                    className={`header-cell ${
                      sortConfig.key === "eigentuemer"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("eigentuemer")}
                  >
                    Eigentümer
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "leistungsempfaenger_strasse"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("leistungsempfaenger_strasse")}
                  >
                    Eigentümer-Strasse
                    <div className="sort-icon">
                      <div className="sort-arrow up"></div>
                      <div className="sort-arrow down"></div>
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "leistungsempfaenger_hausnummer"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("leistungsempfaenger_hausnummer")}
                  >
                    Eigentümer-Hnr.
                    <div className="sort-icon">
                      {/* <div className="sort-arrow up"></div>
                  <div className="sort-arrow down"></div> */}
                    </div>
                  </div>
                  <div
                    className={`header-cell ${
                      sortConfig.key === "leistungsempfaenger_plz"
                        ? `sort-${sortConfig.direction}`
                        : ""
                    }`}
                    onClick={() => handleSort("leistungsempfaenger_plz")}
                  >
                    Eigentümer-PLZ
                    <div className="sort-icon">
                      {/* <div className="sort-arrow up"></div>
                  <div className="sort-arrow down"></div> */}
                    </div>
                  </div>
                  <div
                    className={`header-cell`}
                    onClick={() => handleSort("leistungsempfaenger_ort")}
                  >
                    Eigentümer-Ort
                  </div>
                </div>
                {/* Table Body */}
                <div className="table-body">
                  {" "}
                  {properties.length === 0 ? (
                    <div className="no-data">No data found</div>
                  ) : (
                    sortedProperties.map((property, index) => (
                      <div
                        key={property.id || index}
                        className="property-group"
                      >
                        {/* Property Row */}
                        <div className="table-row property-row">
                          {" "}
                          <div className="table-cell checkbox-cell">
                            {" "}
                            {savedToFirebase.has(property.id) ? (
                              <span
                                className="firebase-indicator"
                                title="Saved in Firebase"
                                style={{ color: "#4285f4" }}
                              >
                                ✓
                              </span>
                            ) : property.status === 1 ? (
                              <input
                                type="checkbox"
                                checked={selectedRows.has(property.id)}
                                onChange={() => handleSelectRow(property.id)}
                                className="row-checkbox"
                              />
                            ) : (
                              <span className="status-indicator">-</span>
                            )}
                          </div>{" "}
                          <div
                            style={{ fontSize: "6px" }}
                            className="table-cell status-cell"
                          >
                            <span
                              className={`status-badge ${
                                property.status === 1 ? "active" : "inactive"
                              }`}
                            >
                              {property.status === 1
                                ? "Aktiv (1)"
                                : `Status (${property.status || 0})`}
                            </span>{" "}
                            {savedToFirebase.has(property.id) && (
                              <span
                                className="firebase-indicator"
                                title="Saved in Firebase"
                              ></span>
                            )}{" "}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.strasse}
                                onChange={(e) =>
                                  handleEditChange("strasse", e.target.value)
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.strasse || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.hausnummer}
                                onChange={(e) =>
                                  handleEditChange("hausnummer", e.target.value)
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.hausnummer || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.plz}
                                onChange={(e) =>
                                  handleEditChange("plz", e.target.value)
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.plz || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.ort}
                                onChange={(e) =>
                                  handleEditChange("ort", e.target.value)
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.ort || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.leistungsempfaenger_name}
                                onChange={(e) =>
                                  handleEditChange(
                                    "leistungsempfaenger_name",
                                    e.target.value
                                  )
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.leistungsempfaenger_name || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.leistungsempfaenger_strasse}
                                onChange={(e) =>
                                  handleEditChange(
                                    "leistungsempfaenger_strasse",
                                    e.target.value
                                  )
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.leistungsempfaenger_strasse || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.leistungsempfaenger_hnr}
                                onChange={(e) =>
                                  handleEditChange(
                                    "leistungsempfaenger_hnr",
                                    e.target.value
                                  )
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.leistungsempfaenger_hnr || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.leistungsempfaenger_plz}
                                onChange={(e) =>
                                  handleEditChange(
                                    "leistungsempfaenger_plz",
                                    e.target.value
                                  )
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.leistungsempfaenger_plz || "-"
                            )}
                          </div>
                          <div className="table-cell">
                            {editingProperty === property.id ? (
                              <input
                                type="text"
                                value={editFormData.leistungsempfaenger_ort}
                                onChange={(e) =>
                                  handleEditChange(
                                    "leistungsempfaenger_ort",
                                    e.target.value
                                  )
                                }
                                className="edit-input"
                              />
                            ) : (
                              property.leistungsempfaenger_ort || "-"
                            )}{" "}
                          </div>
                        </div>
                        {/* Edit Actions */}{" "}
                        {editingProperty === property.id && (
                          <div className="edit-actions">
                            <button
                              className="save-edit-btn"
                              onClick={handleSaveEdit}
                            >
                              Save
                            </button>
                            <button
                              className="cancel-edit-btn"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {/* Contracts Section */}
                        {propertyContracts[property.id] &&
                          propertyContracts[property.id].length > 0 && (
                            <div className="contracts-section">
                              <div className="contracts-header-row">
                                <div className="contracts-title">Zähler</div>
                              </div>{" "}
                              <div className="contracts-subheader">
                                <div className="contract-subheader-cell">
                                  Energieart
                                </div>
                                <div className="contract-subheader-cell">
                                  Zählernummer
                                </div>
                                <div className="contract-subheader-cell">
                                  Malo
                                </div>
                                <div className="contract-subheader-cell">
                                  Status
                                </div>
                              </div>{" "}
                              {propertyContracts[property.id].map(
                                (contract, contractIndex) => (
                                  <div
                                    key={contract.id || contractIndex}
                                    className="contract-row"
                                  >
                                    <div className="contract-cell energieart-cell">
                                      <span
                                        className={`energy-badge ${
                                          contract.energieart?.toLowerCase() ||
                                          "strom"
                                        }`}
                                      >
                                        {contract.energieart || ""}
                                      </span>
                                    </div>
                                    <div className="contract-cell">
                                      {contract.zaehlernummer || ""}
                                    </div>
                                    <div className="contract-cell">
                                      {contract.zaehlpunktbezeichnung || ""}
                                    </div>
                                    <div className="contract-cell">
                                      <span
                                        className={`status-badge ${
                                          contract.zaehlerstatus === "1"
                                            ? "active"
                                            : "inactive"
                                        }`}
                                      >
                                        {contract.zaehlerstatus === "1"
                                          ? "Aktiv (1)"
                                          : `Status (${
                                              contract.zaehlerstatus || 0
                                            })`}
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
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
              {" "}
              <button
                className="pagination-btn"
                onClick={handlePreviousPage}
                disabled={!pagination.hasPreviousPage}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage}
              >
                Next
              </button>
            </div>
          )}
          {/* Contracts Popup */}
          {showPopup && (
            <div className="popup-overlay" onClick={closePopup}>
              <div
                className="popup-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="popup-header">
                  {/* <h3>Verträge für Liegenschaft ID: {selectedPropertyId}</h3> */}
                  <button className="close-btn" onClick={closePopup}>
                    ×
                  </button>
                </div>{" "}
                <div className="popup-body">
                  {loadingContracts ? (
                    <div className="loading">Loading contracts...</div>
                  ) : contracts.length === 0 ? (
                    <div className="no-contracts">No contracts found</div>
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
                        <div
                          key={contract.id || index}
                          className="contract-row"
                        >
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
                      <div className="contract-cell">                        {contract.erstellt_am ? 
                          new Date(contract.erstellt_am).toLocaleDateString('de-DE') :                          '-'
                        }
                      </div> */}
                        </div>
                      ))}
                    </div>
                  )}{" "}
                </div>{" "}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PropertyTable;
