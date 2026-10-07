import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import HelpCenter from "./HelpCenter";
import ChangePassword from "./ChangePassword";
import BiometricSettings from "./BiometricSettings";
import {
  checkIn,
  checkOut,
  getEmployeeAttendance,
  getEmployeeSummary,
  getWeeklyAttendance,
} from "./api/attendanceApi";
import { getCurrentSettings } from "./api/settingsApi";
import { getSession, updateSession } from "./api/session";
import { verifyIdentity } from "./api/webauthn";
import {
  getEmployee,
  uploadEmployeeProfilePhoto,
} from "./api/employeeApi";

// =====================================================
// SCHOOL GPS LOCATION
// =====================================================

const DEFAULT_SCHOOL_LATITUDE = -6.1746053;
const DEFAULT_SCHOOL_LONGITUDE = 39.2263778;
const DEFAULT_SCHOOL_RADIUS_METERS = 100;

// =====================================================
// LOGGED-IN EMPLOYEE
// =====================================================

const getLoggedInEmployee = () =>
  getSession("employee");

// =====================================================
// EMPLOYEE ID
// =====================================================

const getEmployeeKey = (employee) =>
  String(employee?.employeeId ?? "").trim();

// =====================================================
// PROFILE PHOTO URL
// Converts backend path:
// /uploads/employee/photo.jpg
//
// Into:
// http://localhost:8080/uploads/employee/photo.jpg
//
// Also works when the frontend is opened from another
// device on the same network.
// =====================================================

const getProfilePhotoUrl = (photoPath) => {
  if (!photoPath) {
    return null;
  }

  const photo = String(photoPath).trim();

  if (!photo) {
    return null;
  }

  // Already a complete URL
  if (
    photo.startsWith("http://") ||
    photo.startsWith("https://") ||
    photo.startsWith("data:image/")
  ) {
    return photo;
  }

  // VITE_API_URL example:
  // http://localhost:8080/api
  //
  // We remove /api to get:
  // http://localhost:8080
  const apiBase =
    import.meta.env.VITE_API_URL ||
    (window.location.protocol === "https:"
    ? `${window.location.origin}/api`   // HTTPS tunnel: Vite proxies /api to Spring Boot
    : `http://${window.location.hostname}:8080/api`);

  const serverBase =
    apiBase.replace(/\/api\/?$/, "");

  return `${serverBase}${
    photo.startsWith("/")
      ? photo
      : `/${photo}`
  }`;
};

// =====================================================
// LOCAL DATE
// Avoid UTC date problems.
// =====================================================

const getLocalDate = () => {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// =====================================================
// FORMAT BACKEND DATETIME
// Example:
// 2026-09-18T08:15:30
// becomes:
// 08:15:30 AM
// =====================================================

const formatBackendTime = (dateTime) => {
  if (!dateTime) return "--:--:--";

  try {
    const date = new Date(dateTime);

    if (Number.isNaN(date.getTime())) {
      return "--:--:--";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
};

// =====================================================
// API ERROR MESSAGE
// =====================================================

const getApiErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

// =====================================================
// DISTANCE CALCULATION
// Haversine Formula
// =====================================================

const calculateDistance = (
  latitude1,
  longitude1,
  latitude2,
  longitude2
) => {
  const earthRadius = 6371000;

  const lat1 =
    (latitude1 * Math.PI) / 180;

  const lat2 =
    (latitude2 * Math.PI) / 180;

  const deltaLatitude =
    ((latitude2 - latitude1) * Math.PI) /
    180;

  const deltaLongitude =
    ((longitude2 - longitude1) * Math.PI) /
    180;

  const a =
    Math.sin(deltaLatitude / 2) *
      Math.sin(deltaLatitude / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
};

// =====================================================
// 1. MARK ATTENDANCE COMPONENT
// =====================================================

function MarkAttendance({ employee }) {
  const activeEmployee =
    employee || getLoggedInEmployee();

  // ===================================================
  // SYSTEM SETTINGS
  // ===================================================

  const [systemSettings, setSystemSettings] =
    useState(null);

  const schoolLatitude = Number(
    systemSettings?.schoolLatitude ??
      DEFAULT_SCHOOL_LATITUDE
  );

  const schoolLongitude = Number(
    systemSettings?.schoolLongitude ??
      DEFAULT_SCHOOL_LONGITUDE
  );

  const schoolRadiusMeters = Number(
    systemSettings?.allowedRadius ??
      DEFAULT_SCHOOL_RADIUS_METERS
  );

  // ===================================================
  // ATTENDANCE FROM DATABASE
  // ===================================================

  const [attendance, setAttendance] =
    useState([]);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceError, setAttendanceError] =
    useState("");

  // ===================================================
  // LOAD ATTENDANCE FROM SPRING BOOT
  // ===================================================

  const loadAttendance = async () => {
    const employeeId =
      getEmployeeKey(activeEmployee);

    if (!employeeId) {
      return;
    }

    try {
      setAttendanceLoading(true);
      setAttendanceError("");

      const data =
        await getEmployeeAttendance(
          employeeId
        );

      setAttendance(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Failed to load attendance:",
        error
      );

      setAttendanceError(
        getApiErrorMessage(error)
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [activeEmployee?.employeeId]);

  // ===================================================
  // LOAD SYSTEM SETTINGS
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    const refreshSettings = async () => {
      try {
        const settings =
          await getCurrentSettings();

        if (!cancelled && settings) {
          setSystemSettings(settings);
        }
      } catch (error) {
        console.error(
          "Unable to load system settings:",
          error
        );
      }
    };

    refreshSettings();

    window.addEventListener(
      "focus",
      refreshSettings
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "focus",
        refreshSettings
      );
    };
  }, []);

  // ===================================================
  // SCANNING
  // ===================================================

  const [scanning, setScanning] =
    useState(false);

  // ===================================================
  // GPS STATES
  // ===================================================

  const [latitude, setLatitude] =
    useState(null);

  const [longitude, setLongitude] =
    useState(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  const [locationDetected, setLocationDetected] =
    useState(false);

  const [insideSchool, setInsideSchool] =
    useState(false);

  const [distanceFromSchool, setDistanceFromSchool] =
    useState(null);

  // ===================================================
  // TODAY
  // ===================================================

  const today = getLocalDate();

  // ===================================================
  // TODAY'S ATTENDANCE
  // ===================================================

  const todayAttendance =
    attendance.find(
      (record) =>
        record.attendanceDate === today
    );

  // ===================================================
  // DETECT LOCATION
  // ===================================================

  const handleDetectLocation = () => {
    setLocationError("");

    setLocationDetected(false);

    setInsideSchool(false);

    setDistanceFromSchool(null);

    if (!navigator.geolocation) {
      setLocationError(
        "Location services are not supported by this browser."
      );

      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detectedLatitude =
          position.coords.latitude;

        const detectedLongitude =
          position.coords.longitude;

        setLatitude(
          detectedLatitude
        );

        setLongitude(
          detectedLongitude
        );

        const distance =
          calculateDistance(
            detectedLatitude,
            detectedLongitude,
            schoolLatitude,
            schoolLongitude
          );

        setDistanceFromSchool(
          distance
        );

        const employeeIsInside =
          distance <=
          schoolRadiusMeters;

        setInsideSchool(
          employeeIsInside
        );

        setLocationDetected(
          true
        );

        setLocationLoading(false);

        setLocationError("");
      },

      (error) => {
        setLocationLoading(false);

        setLocationDetected(false);

        setInsideSchool(false);

        setDistanceFromSchool(null);

        if (error.code === 1) {
          setLocationError(
            "Location permission was denied. Please allow location access in your browser settings to mark attendance."
          );
        } else if (error.code === 2) {
          setLocationError(
            "Your location could not be detected. Please turn on GPS/location services and try again."
          );
        } else if (error.code === 3) {
          setLocationError(
            "Location detection timed out. Please try again."
          );
        } else {
          setLocationError(
            "Unable to detect your location. Please try again."
          );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ===================================================
  // HANDLE ATTENDANCE + BIOMETRIC
  // ===================================================

  const handleScan = async () => {
    const employeeId =
      getEmployeeKey(activeEmployee);

    if (!employeeId) {
      alert(
        "Employee information is not available."
      );

      return;
    }

    // =================================================
    // LOCATION REQUIRED
    // =================================================

    if (
      !locationDetected ||
      latitude === null ||
      longitude === null
    ) {
      alert(
        "Location access is required before marking attendance. Please click 'Detect My Location' and allow location permission."
      );

      return;
    }

    // =================================================
    // FRONTEND LOCATION PRE-CHECK
    // =================================================

    if (!insideSchool) {
      alert(
        `You are outside the school premises.\n\nAttendance cannot be recorded.\n\nYour distance from school is ${
          distanceFromSchool !== null
            ? Math.round(
                distanceFromSchool
              )
            : "--"
        } meters.\n\nYou must be within ${schoolRadiusMeters} meters of the school.`
      );

      return;
    }

    setScanning(true);

    // =================================================
    // BIOMETRIC / PASSWORD FALLBACK
    // =================================================

    let identity;

    try {
      identity =
        await verifyIdentity(
          activeEmployee
        );
    } catch (error) {
      console.error(
        "Identity verification error:",
        error
      );

      setScanning(false);

      alert(
        `Verification could not be completed.\n\n${getApiErrorMessage(
          error
        )}\n\nAttendance has NOT been recorded.`
      );

      return;
    }

    if (!identity.verified) {
      setScanning(false);

      alert(
        identity.message ||
          "Verification was not completed. Attendance has NOT been recorded."
      );

      return;
    }

    const verificationMethod =
      identity.method;

    const verifiedLabel =
      verificationMethod === "PASSWORD"
        ? "Identity Verified (password)!"
        : "Fingerprint Verified!";

    // =================================================
    // SEND ATTENDANCE TO BACKEND
    // =================================================

    try {
      let result;

      // ===============================================
      // CHECK-IN
      // ===============================================

      if (!todayAttendance) {
        result = await checkIn(
          employeeId,
          latitude,
          longitude,
          verificationMethod
        );

        await loadAttendance();

        alert(
          `${verifiedLabel}\n\nSigned in successfully.\n\n✓ Location verified\n✓ Inside school premises\n✓ Attendance saved to database`
        );
      }

      // ===============================================
      // CHECK-OUT
      // ===============================================

      else if (
        !todayAttendance.checkOutTime
      ) {
        result = await checkOut(
          employeeId,
          latitude,
          longitude,
          verificationMethod
        );

        await loadAttendance();

        alert(
          `${verifiedLabel}\n\nSigned out successfully.\n\n✓ Location verified\n✓ Inside school premises\n✓ Working hours calculated by server\n✓ Attendance updated in database`
        );
      }

      // ===============================================
      // ALREADY COMPLETED
      // ===============================================

      else {
        alert(
          "You have already signed in and signed out today."
        );
      }
    } catch (error) {
      console.error(
        "Attendance request failed:",
        error
      );

      alert(
        `Attendance was NOT recorded.\n\n${getApiErrorMessage(
          error
        )}`
      );
    } finally {
      setScanning(false);
    }
  };

  // ===================================================
  // EMPLOYEE ATTENDANCE HISTORY
  // ===================================================

  const employeeHistory = [
    ...attendance,
  ].sort((a, b) =>
    String(
      b.attendanceDate || ""
    ).localeCompare(
      String(
        a.attendanceDate || ""
      )
    )
  );

  // ===================================================
  // TODAY WORKING HOURS
  // ===================================================

  const totalTodayHours =
    Number(
      todayAttendance?.workingHours || 0
    );

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="attendance-page">

      {/* HEADER */}

      <div className="attendance-header">
        <div>
          <h2>
            Mark attendance
          </h2>

          <p>
            Record your daily attendance
            using fingerprint verification
            and GPS location.
          </p>
        </div>
      </div>

      <div className="attendance-section-title">
        <h3>
          Today's attendance
        </h3>
      </div>

      {/* DATABASE ERROR */}

      {attendanceError && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            borderRadius: "6px",
            backgroundColor: "#fff0f0",
            color: "#b42318",
            border:
              "1px solid #f5c2c0",
          }}
        >
          <strong>
            Attendance error:
          </strong>{" "}
          {attendanceError}
        </div>
      )}

      {/* LOADING */}

      {attendanceLoading && (
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            color: "#666",
          }}
        >
          Loading attendance...
        </div>
      )}

      {/* TOP GRID */}

      <div
        className="attendance-top-grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >

        {/* FINGERPRINT BOX */}

        <div
          className="scanner-box"
          style={{
            border:
              "1px solid #ccc",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
            display: "flex",
            flexDirection:
              "column",
            alignItems:
              "center",
            justifyContent:
              "center",
            backgroundColor:
              "#fff",
          }}
        >

          <div
            className="fingerprint-icon"
            onClick={handleScan}
            style={{
              fontSize: "60px",
              cursor:
                scanning ||
                todayAttendance?.checkOutTime
                  ? "not-allowed"
                  : "pointer",
              marginBottom:
                "15px",
            }}
          >
            {scanning
              ? "⏳"
              : "👆"}
          </div>

          <button
            className="scan-button"
            onClick={handleScan}
            disabled={
              scanning ||
              Boolean(
                todayAttendance?.checkOutTime
              )
            }
            style={{
              padding:
                "10px 20px",
              borderRadius:
                "5px",
              border:
                "1px solid #333",
              backgroundColor:
                "#f9f9f9",
              cursor:
                scanning ||
                todayAttendance?.checkOutTime
                  ? "not-allowed"
                  : "pointer",
              fontWeight:
                "bold",
            }}
          >
            {scanning
              ? "Scanning..."
              : todayAttendance?.checkOutTime
              ? "Completed"
              : todayAttendance
              ? "Scan fingerprint to sign out"
              : "Scan fingerprint"}
          </button>

        </div>

        {/* TIME CARDS */}

        <div
          className="time-cards-container"
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "15px",
            justifyContent:
              "center",
          }}
        >

          <div
            className="time-card-item"
            style={{
              border:
                "1px solid #ccc",
              borderRadius:
                "8px",
              padding:
                "15px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              backgroundColor:
                "#fff",
            }}
          >
            <span>
              Sign in at
            </span>

            <strong>
              {formatBackendTime(
                todayAttendance?.checkInTime
              )}
            </strong>
          </div>

          <div
            className="time-card-item"
            style={{
              border:
                "1px solid #ccc",
              borderRadius:
                "8px",
              padding:
                "15px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              backgroundColor:
                "#fff",
            }}
          >
            <span>
              Sign out at
            </span>

            <strong>
              {formatBackendTime(
                todayAttendance?.checkOutTime
              )}
            </strong>
          </div>

          <div
            className="time-card-item"
            style={{
              border:
                "1px solid #ccc",
              borderRadius:
                "8px",
              padding:
                "15px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              backgroundColor:
                "#f4f4f4",
            }}
          >
            <span>
              Total Hours
            </span>

            <strong>
              {totalTodayHours > 0
                ? `${totalTodayHours.toFixed(
                    1
                  )} hrs`
                : "--"}
            </strong>
          </div>

        </div>
      </div>

      {/* GPS LOCATION */}

      <div
        className="attendance-location-card"
        style={{
          border:
            "1px solid #ccc",
          borderRadius:
            "8px",
          padding:
            "20px",
          backgroundColor:
            "#fff",
          marginBottom:
            "30px",
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "10px",
            marginBottom:
              "15px",
          }}
        >
          <span
            style={{
              fontSize: "24px",
            }}
          >
            📍
          </span>

          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              Activity Location (GPS)
            </h3>

            <p
              style={{
                margin:
                  "5px 0 0",
                color: "#666",
                fontSize:
                  "14px",
              }}
            >
              Your location is required
              to mark attendance.
            </p>
          </div>
        </div>

        {/* LATITUDE + LONGITUDE */}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            marginBottom:
              "15px",
          }}
        >

          <div
            style={{
              border:
                "1px solid #ddd",
              borderRadius:
                "6px",
              padding:
                "12px",
              backgroundColor:
                "#fafafa",
            }}
          >
            <small
              style={{
                display:
                  "block",
                color: "#777",
                marginBottom:
                  "5px",
              }}
            >
              Latitude
            </small>

            <strong>
              {latitude !==
              null
                ? latitude.toFixed(
                    8
                  )
                : "Not Detected"}
            </strong>
          </div>

          <div
            style={{
              border:
                "1px solid #ddd",
              borderRadius:
                "6px",
              padding:
                "12px",
              backgroundColor:
                "#fafafa",
            }}
          >
            <small
              style={{
                display:
                  "block",
                color: "#777",
                marginBottom:
                  "5px",
              }}
            >
              Longitude
            </small>

            <strong>
              {longitude !==
              null
                ? longitude.toFixed(
                    8
                  )
                : "Not Detected"}
            </strong>
          </div>

        </div>

        {/* DETECT LOCATION */}

        <button
          onClick={
            handleDetectLocation
          }
          disabled={
            locationLoading
          }
          style={{
            padding:
              "10px 18px",
            borderRadius:
              "6px",
            border: "none",
            backgroundColor:
              "#2563eb",
            color: "#fff",
            fontWeight:
              "bold",
            cursor:
              locationLoading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {locationLoading
            ? "Detecting location..."
            : "📍 Detect My Location"}
        </button>

        {/* LOCATION STATUS */}

        {locationDetected && (
          <div
            style={{
              marginTop:
                "15px",
              padding:
                "15px",
              borderRadius:
                "6px",
              backgroundColor:
                insideSchool
                  ? "#e8f7ee"
                  : "#fff0f0",
              color:
                insideSchool
                  ? "#18743a"
                  : "#b42318",
              border:
                insideSchool
                  ? "1px solid #b7e4c7"
                  : "1px solid #f5c2c0",
              fontSize:
                "14px",
            }}
          >

            {insideSchool ? (
              <>
                <strong>
                  ✓ Location verified
                </strong>

                <p
                  style={{
                    margin:
                      "8px 0 0",
                  }}
                >
                  You are within
                  the school
                  premises. You
                  can now mark
                  your attendance.
                </p>

                {distanceFromSchool !==
                  null && (
                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      fontWeight:
                        "bold",
                    }}
                  >
                    Distance from
                    school:{" "}
                    {Math.round(
                      distanceFromSchool
                    )}{" "}
                    meters
                  </p>
                )}

                <p
                  style={{
                    margin:
                      "5px 0 0",
                  }}
                >
                  Allowed radius:{" "}
                  {
                    schoolRadiusMeters
                  }{" "}
                  meters
                </p>
              </>
            ) : (
              <>
                <strong>
                  ✕ You are outside
                  the school
                  premises
                </strong>

                <p
                  style={{
                    margin:
                      "8px 0 0",
                  }}
                >
                  Attendance cannot
                  be recorded from
                  your current
                  location.
                </p>

                {distanceFromSchool !==
                  null && (
                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      fontWeight:
                        "bold",
                    }}
                  >
                    Distance from
                    school:{" "}
                    {Math.round(
                      distanceFromSchool
                    )}{" "}
                    meters
                  </p>
                )}

                <p
                  style={{
                    margin:
                      "5px 0 0",
                  }}
                >
                  You must be within{" "}
                  {
                    schoolRadiusMeters
                  }{" "}
                  meters of the
                  school.
                </p>
              </>
            )}

          </div>
        )}

        {/* LOCATION ERROR */}

        {locationError && (
          <div
            style={{
              marginTop:
                "15px",
              padding:
                "12px",
              borderRadius:
                "6px",
              backgroundColor:
                "#fff0f0",
              color:
                "#b42318",
              border:
                "1px solid #f5c2c0",
              fontSize:
                "14px",
            }}
          >
            <strong>
              Location required:
            </strong>

            <br />

            {locationError}
          </div>
        )}

      </div>

      {/* VERIFICATION INFORMATION */}

      <div
        style={{
          marginBottom:
            "25px",
          padding:
            "14px 16px",
          borderRadius:
            "8px",
          border:
            "1px solid #ddd",
          backgroundColor:
            "#fafafa",
        }}
      >
        <strong>
          Attendance verification requirements
        </strong>

        <p
          style={{
            margin:
              "8px 0 0",
            color:
              "#666",
            fontSize:
              "14px",
          }}
        >
          Location must be inside
          the configured school
          radius, and biometric
          verification must
          succeed before an
          attendance record is
          saved.
        </p>
      </div>

      {/* ATTENDANCE HISTORY */}

      <div className="attendance-history">

        <div className="history-heading">

          <h2>
            My Attendance history
          </h2>

          <p>
            Your attendance history
            from the database.
          </p>

        </div>

        {employeeHistory.length ===
        0 ? (

          <div
            className="no-attendance"
            style={{
              textAlign:
                "center",
              padding:
                "20px",
            }}
          >
            <p>
              No attendance records
              available.
            </p>
          </div>

        ) : (

          <div className="attendance-table-wrapper">

            <table
              className="attendance-table"
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
              }}
            >

              <thead>

                <tr
                  style={{
                    borderBottom:
                      "2px solid #ccc",
                    textAlign:
                      "left",
                  }}
                >

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Date
                  </th>

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Sign in
                  </th>

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Sign out
                  </th>

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Hours
                  </th>

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Status
                  </th>

                  <th
                    style={{
                      padding:
                        "10px",
                    }}
                  >
                    Location
                  </th>

                </tr>

              </thead>

              <tbody>

                {employeeHistory.map(
                  (record) => {

                    const inside =
                      record.checkInLatitude !==
                        null &&
                      record.checkInLongitude !==
                        null;

                    return (
                      <tr
                        key={
                          record.attendanceId
                        }
                        style={{
                          borderBottom:
                            "1px solid #eee",
                        }}
                      >

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {
                            record.attendanceDate
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {formatBackendTime(
                            record.checkInTime
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {formatBackendTime(
                            record.checkOutTime
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {record.workingHours !=
                          null
                            ? Number(
                                record.workingHours
                              ).toFixed(
                                1
                              )
                            : "--"}{" "}
                          {record.workingHours !=
                          null
                            ? "hrs"
                            : ""}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                            fontWeight:
                              "bold",
                            color:
                              record.status ===
                              "Late"
                                ? "#b42318"
                                : "#18743a",
                          }}
                        >
                          {
                            record.status ||
                            "--"
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {inside ? (
                            <span
                              style={{
                                color:
                                  "#18743a",
                                fontWeight:
                                  "bold",
                              }}
                            >
                              ✓ GPS recorded
                            </span>
                          ) : (
                            "Not available"
                          )}
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}

// =====================================================
// 2. ATTENDANCE REPORT COMPONENT
// =====================================================

function AttendanceReport({ employee }) {
  const activeEmployee =
    employee || getLoggedInEmployee();

  const employeeId =
    getEmployeeKey(activeEmployee);

  // ===================================================
  // SUMMARY STATE
  // ===================================================

  const [summary, setSummary] =
    useState(null);

  const [weeklyData, setWeeklyData] =
    useState([]);

  const [employeeRecords, setEmployeeRecords] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ===================================================
  // LOCAL DATE
  // ===================================================

  const getLocalDateObject = () => {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  };

  // ===================================================
  // DATE KEY
  // ===================================================

  const toLocalDateKey = (date) => {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // ===================================================
  // CURRENT MONDAY-FRIDAY
  // ===================================================

  const getCurrentWeekDates = () => {
    const today =
      getLocalDateObject();

    const day =
      today.getDay();

    const mondayOffset =
      day === 0
        ? -6
        : 1 - day;

    const days = [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ];

    return days.map(
      (dayName, index) => {
        const date =
          new Date(today);

        date.setDate(
          today.getDate() +
            mondayOffset +
            index
        );

        return {
          dayName,
          dateKey:
            toLocalDateKey(
              date
            ),
        };
      }
    );
  };

  // ===================================================
  // LOAD REPORT FROM BACKEND
  // ===================================================

  useEffect(() => {
    const loadReport = async () => {
      if (!employeeId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // =============================================
        // EMPLOYEE ATTENDANCE
        // =============================================

        const records =
          await getEmployeeAttendance(
            employeeId
          );

        setEmployeeRecords(
          Array.isArray(records)
            ? records
            : []
        );

        // =============================================
        // SUMMARY
        // =============================================

        const summaryData =
          await getEmployeeSummary(
            employeeId
          );

        setSummary(
          summaryData
        );

        // =============================================
        // WEEK
        // =============================================

        const week =
          getCurrentWeekDates();

        const weekly =
          await getWeeklyAttendance(
            employeeId,
            week[0].dateKey,
            week[4].dateKey
          );

        setWeeklyData(
          Array.isArray(weekly)
            ? weekly
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load attendance report:",
          error
        );

        setError(
          getApiErrorMessage(error)
        );
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [employeeId]);

  // ===================================================
  // WEEKLY DISPLAY DATA
  // ===================================================

  const currentWeekDates =
    getCurrentWeekDates();

  const weeklyHoursData =
    currentWeekDates.map(
      ({
        dayName,
        dateKey,
      }) => {
        const record =
          weeklyData.find(
            (item) =>
              item.date ===
              dateKey
          );

        const hours =
          record?.workingHours !=
          null
            ? Number(
                record.workingHours
              )
            : 0;

        return {
          dayName,
          dateKey,
          hours: Math.min(
            8,
            Math.max(
              0,
              hours
            )
          ),
          status:
            record?.status ||
            "Absent",
        };
      }
    );

  // ===================================================
  // STATS
  // ===================================================

  const presentDays =
    Number(
      summary?.presentDays ||
        0
    );

  const lateDays =
    Number(
      summary?.lateDays ||
        0
    );

  const totalHoursWorked =
    Number(
      summary?.totalWorkingHours ||
        0
    );

  // Current Monday-Friday absent count.
  const absentDays =
    weeklyHoursData.filter(
      (item) =>
        item.status ===
        "Absent"
    ).length;

  const totalDays =
    presentDays +
    lateDays;

  // ===================================================
  // RENDER
  // =====================================================

  return (
    <div
      className="report-page"
      style={{
        padding:
          "20px",
      }}
    >

      {/* LOADING */}

      {loading && (
        <div
          style={{
            marginBottom:
              "20px",
            color:
              "#666",
          }}
        >
          Loading attendance
          report from database...
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div
          style={{
            marginBottom:
              "20px",
            padding:
              "12px 15px",
            borderRadius:
              "6px",
            backgroundColor:
              "#fff0f0",
            color:
              "#b42318",
            border:
              "1px solid #f5c2c0",
          }}
        >
          <strong>
            Report error:
          </strong>{" "}
          {error}
        </div>
      )}

      {/* HEADER INFO */}

      <div
        className="info-header-grid"
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap:
            "15px",
          marginBottom:
            "20px",
        }}
      >

        <div style={boxStyle}>
          <small
            style={{
              color:
                "#777",
            }}
          >
            Name
          </small>

          <p
            style={
              boxTextStyle
            }
          >
            {activeEmployee
              ? `${activeEmployee.firstName || ""} ${
                  activeEmployee.lastName || ""
                }`.trim()
              : "N/A"}
          </p>
        </div>

        <div style={boxStyle}>
          <small
            style={{
              color:
                "#777",
            }}
          >
            Dept name
          </small>

          <p
            style={
              boxTextStyle
            }
          >
            {activeEmployee?.department ||
              "N/A"}
          </p>
        </div>

        <div style={boxStyle}>
          <small
            style={{
              color:
                "#777",
            }}
          >
            Id
          </small>

          <p
            style={
              boxTextStyle
            }
          >
            {employeeId ||
              "N/A"}
          </p>
        </div>

        <div style={boxStyle}>
          <small
            style={{
              color:
                "#777",
            }}
          >
            Email
          </small>

          <p
            style={
              boxTextStyle
            }
          >
            {activeEmployee?.email ||
              "N/A"}
          </p>
        </div>

      </div>

      {/* STATS */}

      <div
        className="stats-grid"
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(140px, 1fr))",
          gap:
            "15px",
          marginBottom:
            "30px",
        }}
      >

        <div style={statBoxStyle}>
          <small>
            Absent day
          </small>

          <h2>
            {absentDays}
          </h2>
        </div>

        <div style={statBoxStyle}>
          <small>
            Present day
          </small>

          <h2>
            {presentDays}
          </h2>
        </div>

        <div style={statBoxStyle}>
          <small>
            Late
          </small>

          <h2>
            {lateDays}
          </h2>
        </div>

        <div style={statBoxStyle}>
          <small>
            Total day
          </small>

          <h2>
            {totalDays}
          </h2>
        </div>

        <div
          style={{
            ...statBoxStyle,
            backgroundColor:
              "#eef6ff",
          }}
        >
          <small>
            Total hours
          </small>

          <h2
            style={{
              color:
                "#0066cc",
            }}
          >
            {totalHoursWorked.toFixed(
              1
            )}{" "}
            hrs
          </h2>
        </div>

      </div>

      {/* WEEKLY REPORT */}

      <div
        className="weekly-report-card"
        style={{
          border:
            "1px solid #ccc",
          borderRadius:
            "8px",
          padding:
            "20px",
          backgroundColor:
            "#fff",
          marginBottom:
            "30px",
        }}
      >

        <h3
          style={{
            marginBottom:
              "6px",
          }}
        >
          Summary weekly report
        </h3>

        <p
          style={{
            margin:
              "0 0 20px",
            color:
              "#777",
            fontSize:
              "13px",
          }}
        >
          Hours worked from Monday
          to Friday — maximum 8
          hours per day.
        </p>

        <div
          style={{
            display:
              "flex",
            width:
              "100%",
            minHeight:
              "280px",
          }}
        >

          {/* Y AXIS */}

          <div
            style={{
              width:
                "42px",
              height:
                "230px",
              display:
                "flex",
              flexDirection:
                "column",
              justifyContent:
                "space-between",
              alignItems:
                "flex-end",
              paddingRight:
                "8px",
              boxSizing:
                "border-box",
              fontSize:
                "12px",
              color:
                "#666",
            }}
          >
            {[8, 6, 4, 2, 0].map(
              (hour) => (
                <span
                  key={hour}
                >
                  {hour}h
                </span>
              )
            )}
          </div>

          {/* GRAPH */}

          <div
            style={{
              position:
                "relative",
              flex:
                1,
              height:
                "230px",
              borderLeft:
                "2px solid #777",
              borderBottom:
                "2px solid #777",
              backgroundColor:
                "#fafafa",
            }}
          >

            {[0, 2, 4, 6, 8].map(
              (hour) => (
                <div
                  key={hour}
                  style={{
                    position:
                      "absolute",
                    left: 0,
                    right: 0,
                    bottom: `${
                      (hour / 8) *
                      100
                    }%`,
                    borderTop:
                      hour ===
                      0
                        ? "none"
                        : "1px dashed #ddd",
                    pointerEvents:
                      "none",
                  }}
                />
              )
            )}

            <div
              style={{
                position:
                  "absolute",
                inset:
                  "0 0 0 0",
                display:
                  "flex",
                alignItems:
                  "flex-end",
                justifyContent:
                  "space-around",
                padding:
                  "0 12px",
                boxSizing:
                  "border-box",
              }}
            >

              {weeklyHoursData.map(
                (item) => {
                  const barHeight = `${
                    (item.hours / 8) *
                    100
                  }%`;

                  return (
                    <div
                      key={
                        item.dateKey
                      }
                      style={{
                        height:
                          "100%",
                        flex:
                          "1 1 0",
                        maxWidth:
                          "70px",
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "center",
                        justifyContent:
                          "flex-end",
                        position:
                          "relative",
                      }}
                    >

                      {item.hours >
                        0 && (
                        <span
                          style={{
                            position:
                              "absolute",
                            bottom: `calc(${barHeight} + 6px)`,
                            fontSize:
                              "12px",
                            fontWeight:
                              "bold",
                            color:
                              "#333",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {item.hours
                            .toFixed(
                              1
                            )
                            .replace(
                              ".0",
                              ""
                            )}
                          h
                        </span>
                      )}

                      <div
                        title={`${item.dayName}: ${item.hours.toFixed(
                          1
                        )} hours`}
                        style={{
                          width:
                            "45px",
                          maxWidth:
                            "80%",
                          height:
                            barHeight,
                          minHeight:
                            item.hours >
                            0
                              ? "2px"
                              : "0",
                          backgroundColor:
                            "#4f46e5",
                          borderRadius:
                            "5px 5px 0 0",
                          transition:
                            "height 0.4s ease",
                        }}
                      />

                      <span
                        style={{
                          position:
                            "absolute",
                          bottom:
                            "-28px",
                          fontSize:
                            "13px",
                          fontWeight:
                            "bold",
                          color:
                            "#333",
                        }}
                      >
                        {
                          item.dayName
                        }
                      </span>

                    </div>
                  );
                }
              )}

            </div>
          </div>
        </div>

        <div
          style={{
            marginTop:
              "48px",
            textAlign:
              "center",
            color:
              "#666",
            fontSize:
              "12px",
          }}
        >
          Hours worked
        </div>

      </div>

      {/* DAILY ATTENDANCE */}

      <div
        className="daily-record-card"
        style={{
          border:
            "1px solid #ccc",
          borderRadius:
            "8px",
          padding:
            "20px",
          backgroundColor:
            "#fff",
        }}
      >

        <h3>
          My daily attendance record
        </h3>

        <p
          style={{
            color:
              "#666",
            fontSize:
              "14px",
            marginTop:
              "5px",
          }}
        >
          Detailed view of your
          daily attendance check-ins
          and check-outs.
        </p>

        <table
          style={{
            width:
              "100%",
            marginTop:
              "15px",
            borderCollapse:
              "collapse",
          }}
        >

          <thead>

            <tr
              style={{
                borderBottom:
                  "2px solid #eee",
                textAlign:
                  "left",
              }}
            >

              <th
                style={{
                  padding:
                    "8px",
                }}
              >
                Date
              </th>

              <th
                style={{
                  padding:
                    "8px",
                }}
              >
                Sign In
              </th>

              <th
                style={{
                  padding:
                    "8px",
                }}
              >
                Sign Out
              </th>

              <th
                style={{
                  padding:
                    "8px",
                }}
              >
                Status
              </th>

              <th
                style={{
                  padding:
                    "8px",
                }}
              >
                Hours
              </th>

            </tr>

          </thead>

          <tbody>

            {employeeRecords.length ===
            0 ? (

              <tr>
                <td
                  colSpan="5"
                  style={{
                    padding:
                      "15px",
                    textAlign:
                      "center",
                    color:
                      "#888",
                  }}
                >
                  No attendance
                  records found.
                </td>
              </tr>

            ) : (

              employeeRecords.map(
                (r) => (
                  <tr
                    key={
                      r.attendanceId
                    }
                    style={{
                      borderBottom:
                        "1px solid #f0f0f0",
                    }}
                  >

                    <td
                      style={{
                        padding:
                          "8px",
                      }}
                    >
                      {
                        r.attendanceDate
                      }
                    </td>

                    <td
                      style={{
                        padding:
                          "8px",
                      }}
                    >
                      {formatBackendTime(
                        r.checkInTime
                      )}
                    </td>

                    <td
                      style={{
                        padding:
                          "8px",
                      }}
                    >
                      {formatBackendTime(
                        r.checkOutTime
                      )}
                    </td>

                    <td
                      style={{
                        padding:
                          "8px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {
                        r.status ||
                        "--"
                      }
                    </td>

                    <td
                      style={{
                        padding:
                          "8px",
                      }}
                    >
                      {r.workingHours !=
                      null
                        ? Number(
                            r.workingHours
                          ).toFixed(
                            1
                          )
                        : "--"}{" "}
                      {r.workingHours !=
                      null
                        ? "hrs"
                        : ""}
                    </td>

                  </tr>
                )
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

// =====================================================
// STYLING HELPERS
// =====================================================

const boxStyle = {
  border:
    "1px solid #ccc",
  borderRadius:
    "6px",
  padding:
    "10px 15px",
  backgroundColor:
    "#fff",
};

const boxTextStyle = {
  margin:
    "4px 0 0 0",
  fontWeight:
    "bold",
  fontSize:
    "14px",
};

const statBoxStyle = {
  border:
    "1px solid #ccc",
  borderRadius:
    "6px",
  padding:
    "15px",
  textAlign:
    "center",
  backgroundColor:
    "#fff",
};

// =====================================================
// 3. MAIN DASHBOARD
// =====================================================

function Dashboard({
  employee,
  onLogout,
}) {
  const activeEmployee =
    employee || getLoggedInEmployee();

  const [activeMenu, setActiveMenu] =
    useState("Dashboard");

  // ===================================================
  // PROFILE IMAGE
  // ===================================================

  const [profileImage, setProfileImage] =
    useState(
      activeEmployee?.profilePhoto
        ? getProfilePhotoUrl(
            activeEmployee.profilePhoto
          )
        : null
    );

  // ===================================================
  // PROFILE IMAGE FROM SESSION / DATABASE
  // ===================================================

  useEffect(() => {
    if (activeEmployee?.profilePhoto) {
      setProfileImage(
        getProfilePhotoUrl(
          activeEmployee.profilePhoto
        )
      );
    } else {
      setProfileImage(null);
    }
  }, [activeEmployee?.profilePhoto]);

  // ===================================================
  // UPLOAD EMPLOYEE PROFILE PHOTO
  // ===================================================

  const handleImageUpload = async (e) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    // -------------------------------------------------
    // Validate file type
    // -------------------------------------------------

    if (!file.type.startsWith("image/")) {
      alert(
        "Please select a valid image file."
      );

      e.target.value = "";

      return;
    }

    // -------------------------------------------------
    // Maximum file size = 5 MB
    // -------------------------------------------------

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "Image is too large. Please choose an image below 5 MB."
      );

      e.target.value = "";

      return;
    }

    const employeeId =
      getEmployeeKey(
        activeEmployee
      );

    if (!employeeId) {
      alert(
        "Employee information is not available."
      );

      e.target.value = "";

      return;
    }

    // -------------------------------------------------
    // Remember old image
    // -------------------------------------------------

    const previousImage =
      activeEmployee?.profilePhoto
        ? getProfilePhotoUrl(
            activeEmployee.profilePhoto
          )
        : null;

    // -------------------------------------------------
    // Temporary preview URL
    // -------------------------------------------------

    let temporaryUrl = null;

    try {

      temporaryUrl =
        URL.createObjectURL(file);

      setProfileImage(
        temporaryUrl
      );

      // ------------------------------------------------
      // Upload to Spring Boot
      // ------------------------------------------------

      const updatedEmployee =
        await uploadEmployeeProfilePhoto(
          employeeId,
          file
        );

      // ------------------------------------------------
      // Get returned photo path
      //
      // Example:
      // /uploads/employee/EMP004-abc.jpg
      // ------------------------------------------------

      if (
        updatedEmployee?.profilePhoto
      ) {
        const savedPhotoUrl =
          getProfilePhotoUrl(
            updatedEmployee.profilePhoto
          );

        setProfileImage(
          savedPhotoUrl
        );
      }

      // ------------------------------------------------
      // Refresh employee from database
      // ------------------------------------------------

      const freshEmployee =
        await getEmployee(
          employeeId
        );

      if (freshEmployee) {

        /*
         * IMPORTANT:
         *
         * We store only the employee data
         * required by the session.
         *
         * profilePhoto is now a small path,
         * not Base64 image data.
         */

        const sessionEmployee = {
          employeeId:
            freshEmployee.employeeId,

          firstName:
            freshEmployee.firstName,

          lastName:
            freshEmployee.lastName,

          email:
            freshEmployee.email,

          phone:
            freshEmployee.phone,

          department:
            freshEmployee.department,

          position:
            freshEmployee.position,

          username:
            freshEmployee.username,

          status:
            freshEmployee.status,

          hireDate:
            freshEmployee.hireDate,

          fingerprintId:
            freshEmployee.fingerprintId,

          profilePhoto:
            typeof freshEmployee.profilePhoto ===
              "string" &&
            freshEmployee.profilePhoto.trim() !== ""
              ? freshEmployee.profilePhoto
              : null,
        };

        // ------------------------------------------------
        // Update browser session
        // ------------------------------------------------

        updateSession(
          "employee",
          sessionEmployee
        );

        // ------------------------------------------------
        // Update image shown in dashboard
        // ------------------------------------------------

        if (
          sessionEmployee.profilePhoto
        ) {
          setProfileImage(
            getProfilePhotoUrl(
              sessionEmployee.profilePhoto
            )
          );
        }
      }

      alert(
        "Profile photo uploaded successfully."
      );

    } catch (error) {

      console.error(
        "Employee profile photo upload failed:",
        error
      );

      // ------------------------------------------------
      // Restore previous image if upload fails
      // ------------------------------------------------

      setProfileImage(
        previousImage
      );

      const message =
        getApiErrorMessage(
          error
        );

      alert(
        `Failed to upload profile photo.\n\n${message}`
      );

    } finally {

      // ------------------------------------------------
      // Remove temporary object URL
      // ------------------------------------------------

      if (temporaryUrl) {
        URL.revokeObjectURL(
          temporaryUrl
        );
      }

      // ------------------------------------------------
      // Allow selecting the same file again
      // ------------------------------------------------

      e.target.value = "";
    }
  };

  // ===================================================
  // MENU
  // ===================================================

  const menuItems = [
    {
      name: "Dashboard",
      icon: "🏠",
    },

    {
      name: "Mark attendance",
      icon: "🕘",
    },

    {
      name: "Attendance report",
      icon: "📊",
    },

    {
      name: "Setting",
      icon: "⚙️",
    },

    {
      name: "Help center",
      icon: "❓",
    },
  ];

  // ===================================================
  // CONTENT
  // ===================================================

  const renderContent = () => {
    switch (activeMenu) {

      case "Mark attendance":
        return (
          <MarkAttendance
            employee={
              activeEmployee
            }
          />
        );

      case "Attendance report":
        return (
          <AttendanceReport
            employee={
              activeEmployee
            }
          />
        );

      case "Help center":
        return <HelpCenter />;

      case "Setting":
        return (
          <>
            <ChangePassword
              employee={
                activeEmployee
              }
            />

            <BiometricSettings
              employee={
                activeEmployee
              }
            />
          </>
        );

      case "Dashboard":

      default:
        return (
          <>
            {/* WELCOME CARD */}

            <section className="welcome-card">

              <div>

                <span>
                  Welcome back 👋
                </span>

                <h2>
                  {activeEmployee
                    ? `${activeEmployee.firstName || ""} ${
                        activeEmployee.lastName || ""
                      }`.trim()
                    : "Employee"}
                </h2>

                <p>
                  Welcome to your employee
                  attendance dashboard.
                  Manage your attendance
                  and view your information
                  here.
                </p>

              </div>

              <div className="welcome-icon">
                📅
              </div>

            </section>

            {/* PROFILE */}

            <section className="profile-area">

              <div className="section-heading">

                <h2>
                  My Profile
                </h2>

                <p>
                  Your registered personal
                  information
                </p>

              </div>

              <div className="profile-card">

                <div className="photo-area">

                  <div className="profile-photo">

                    {profileImage ? (

                      <img
                        src={
                          profileImage
                        }
                        alt="Employee Profile"
                        onError={() => {
                          console.error(
                            "Unable to load employee profile image:",
                            profileImage
                          );
                        }}
                      />

                    ) : (

                      <span>
                        👤
                      </span>

                    )}

                  </div>

                  <label
                    htmlFor="profile-upload"
                    className="upload-photo"
                  >
                    📷 Upload Photo
                  </label>

                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={
                      handleImageUpload
                    }
                    hidden
                  />

                  <p>
                    JPG, PNG or JPEG
                  </p>

                </div>

                <div className="employee-information">

                  {/* NAME */}

                  <div className="information-box">

                    <div className="information-icon">
                      👤
                    </div>

                    <div>

                      <small>
                        Name
                      </small>

                      <strong>
                        {activeEmployee
                          ? `${activeEmployee.firstName || ""} ${
                              activeEmployee.lastName || ""
                            }`.trim()
                          : "Not available"}
                      </strong>

                    </div>

                  </div>

                  {/* EMAIL */}

                  <div className="information-box">

                    <div className="information-icon">
                      ✉️
                    </div>

                    <div>

                      <small>
                        Email
                      </small>

                      <strong>
                        {activeEmployee?.email ||
                          "Not available"}
                      </strong>

                    </div>

                  </div>

                  {/* PHONE */}

                  <div className="information-box">

                    <div className="information-icon">
                      📞
                    </div>

                    <div>

                      <small>
                        Contact
                      </small>

                      <strong>
                        {activeEmployee?.phone ||
                          "Not available"}
                      </strong>

                    </div>

                  </div>

                  {/* DEPARTMENT */}

                  <div className="information-box">

                    <div className="information-icon">
                      🏢
                    </div>

                    <div>

                      <small>
                        Department
                      </small>

                      <strong>
                        {activeEmployee?.department ||
                          "Not available"}
                      </strong>

                    </div>

                  </div>

                  {/* POSITION */}

                  <div className="information-box">

                    <div className="information-icon">
                      💼
                    </div>

                    <div>

                      <small>
                        Position
                      </small>

                      <strong>
                        {activeEmployee?.position ||
                          "Not available"}
                      </strong>

                    </div>

                  </div>

                  {/* EMPLOYEE ID */}

                  <div className="information-box">

                    <div className="information-icon">
                      🆔
                    </div>

                    <div>

                      <small>
                        Employee ID
                      </small>

                      <strong>
                        {getEmployeeKey(
                          activeEmployee
                        ) ||
                          "Not available"}
                      </strong>

                    </div>

                  </div>

                </div>

              </div>

            </section>
          </>
        );
    }
  };

  // ===================================================
  // MAIN RETURN
  // ===================================================

  return (
    <div className="employee-dashboard">

      {/* SIDEBAR */}

      <aside className="dashboard-sidebar">

        <div className="dashboard-school">

          <img
            src="/LOGO.JPG"
            alt="Alihsan Girls Secondary School"
          />

          <div>

            <h2>
              AL-IHSAN GIRLS
            </h2>

            <p>
              SECONDARY SCHOOL
            </p>

          </div>

        </div>

        <div className="sidebar-title">

          <span>
            ☰
          </span>

          <strong>
            Dashboard
          </strong>

        </div>

        <nav className="dashboard-menu">

          {menuItems.map(
            (item) => (
              <button
                key={
                  item.name
                }
                className={
                  activeMenu ===
                  item.name
                    ? "dashboard-menu-item active"
                    : "dashboard-menu-item"
                }
                onClick={() =>
                  setActiveMenu(
                    item.name
                  )
                }
              >

                <span className="menu-icon">
                  {
                    item.icon
                  }
                </span>

                {
                  item.name
                }

              </button>
            )
          )}

          <button
            className="dashboard-menu-item logout-item"
            onClick={
              onLogout
            }
          >

            <span className="menu-icon">
              🚪
            </span>

            Log out

          </button>

        </nav>

      </aside>

      {/* MAIN DASHBOARD */}

      <main className="dashboard-main">

        <header className="dashboard-topbar">

          <div>

            <h1>
              Employee dashboard
            </h1>

            <p>
              Manage your attendance
              and personal information
            </p>

          </div>

          <div className="topbar-profile">

            <span className="notification-icon">
              🔔
            </span>

            <div className="small-profile">

              {profileImage ? (

                <img
                  src={
                    profileImage
                  }
                  alt="Employee"
                  onError={() => {
                    console.error(
                      "Unable to load employee profile image:",
                      profileImage
                    );
                  }}
                />

              ) : (

                <div className="small-profile-placeholder">
                  👤
                </div>

              )}

              <div>

                <strong>
                  {
                    activeEmployee?.firstName ||
                    "Employee"
                  }
                </strong>

                <small>
                  Employee
                </small>

              </div>

            </div>

          </div>

        </header>

        {renderContent()}

      </main>

    </div>
  );
}

export default Dashboard;