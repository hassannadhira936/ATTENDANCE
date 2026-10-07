import React, { useEffect, useState } from "react";
import "./AdminDashboard.css";
import AdminHelpCenter from "./AdminHelpCenter";

import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
} from "./api/employeeApi";
import { getAllAttendanceForAdmin } from "./api/attendanceApi";
import { getAllBiometrics } from "./api/biometricApi";
import { getCurrentSettings, saveSettings } from "./api/settingsApi";

import {
  getErrorMessage,
  BACKEND_BASE_URL,
} from "./api/api";
import { clearSession, updateSession } from "./api/session";
import {
  updateAdmin,
  uploadAdminProfilePhoto,
  changeAdminPassword,
} from "./api/adminApi";

// =====================================================
// HELPERS: MySQL (API) records -> the shapes this page uses
// =====================================================

// Employee from the API. "id" is the string Employee ID (e.g. EMP004),
// so edit/delete/search logic keeps working with the same key.
const normalizeEmployee = (employee, registeredIds) => ({
  ...employee,
  id: employee.employeeId,
  hireDate: employee.hireDate || "",
  profilePhoto: employee.profilePhoto || "",
  biometricStatus: registeredIds.has(String(employee.employeeId))
    ? "Registered"
    : "Not Registered",
});

const formatClock = (dateTime) => {
  if (!dateTime) return "";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Attendance row from the API -> the fields the attendance table expects.
// The server refuses check-ins outside the school radius, so any saved
// location is INSIDE_SCHOOL.
const normalizeAttendance = (record) => ({
  id: record.attendanceId,
  attendanceId: record.attendanceId,
  employeeId: record.employeeId,
  firstName: record.firstName,
  lastName: record.lastName,
  position: record.position,
  date: record.attendanceDate,
  signIn: formatClock(record.checkInTime),
  signOut: formatClock(record.checkOutTime),
  status: record.status,
  workingHours: record.workingHours,
  verificationMethod: record.verificationMethod,
  signInLatitude: record.checkInLatitude,
  signInLongitude: record.checkInLongitude,
  signInDistanceFromSchool: record.checkInDistance,
  signInLocationStatus:
    record.checkInLatitude != null ? "INSIDE_SCHOOL" : "UNKNOWN",
  signOutLatitude: record.checkOutLatitude,
  signOutLongitude: record.checkOutLongitude,
  signOutDistanceFromSchool: record.checkOutDistance,
  signOutLocationStatus:
    record.checkOutLatitude != null ? "INSIDE_SCHOOL" : undefined,
});

// Shrinks uploaded photos (max 400px JPEG) so they stay small in MySQL.
const compressImage = (dataUrl, maxSize = 400, quality = 0.8) =>
  new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(
        1,
        maxSize / Math.max(image.width, image.height)
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = () => resolve(dataUrl);

    image.src = dataUrl;
  });
  const getProfilePhotoUrl = (photo) => {
  if (!photo) {
    return null;
  }

  // New system: database contains /uploads/admin/filename.jpg
  if (photo.startsWith("/uploads/")) {
    return `${BACKEND_BASE_URL}${photo}`;
  }

  // Temporary compatibility with old Base64 photos
  if (photo.startsWith("data:image/")) {
    return photo;
  }

  return photo;
};

const dataURLToBlob = (dataUrl) => {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];

  const binary = atob(parts[1]);

  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], {
    type: mime,
  });
};

function AdminDashboard({ admin }) {
  // =====================================================
  // GENERAL STATES
  // =====================================================

  const [activeMenu, setActiveMenu] = useState("Home");
  const [adminPhoto, setAdminPhoto] = useState(null);

const [adminSettings, setAdminSettings] = useState({
  fullName: admin?.fullName || admin?.username || "Administrator",
  email: admin?.email || "Not provided",
  phone: admin?.contact || admin?.phone || "Not provided",
    arrivalTime: "08:00",
    departureTime: "16:00",
    schoolLatitude: "",
    schoolLongitude: "",
    allowedRadius: "100",
    profilePhoto: "",
  });

  // =====================================================
  // PASSWORD VISIBILITY STATES
  // =====================================================

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // =====================================================
  // EMPLOYEE STATES
  // =====================================================

  const [employeeForm, setEmployeeForm] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    hireDate: "",
    username: "",
    password: "",
    status: "Active",
    profilePhoto: "",
  });

  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // =====================================================
  // ATTENDANCE STATES
  // =====================================================

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [settingId, setSettingId] = useState(null);
  const [attendanceFilter, setAttendanceFilter] = useState("all");

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  // =====================================================
  // MENU ITEMS
  // =====================================================

  const menuItems = [
    { name: "Home", icon: "🏠" },
    { name: "View Employees Attendance", icon: "👥" },
    { name: "Manage Employee", icon: "👤" },
    { name: "Settings", icon: "⚙️" },
    { name: "Help Center", icon: "❓" },
  ];

  // =====================================================
  // ADMIN INFORMATION
  // =====================================================

  const adminName =
    adminSettings.fullName ||
    admin?.fullName ||
    admin?.username ||
    "Administrator";

  const adminEmail =
    adminSettings.email ||
    admin?.email ||
    "Not provided";

  const adminPhone =
  adminSettings.phone ||
  admin?.contact ||
  admin?.phone ||
  "Not provided";

  const adminPosition = admin?.position || "Administrator";

  // =====================================================
  // LOAD EVERYTHING FROM SPRING BOOT / MYSQL
  // =====================================================

  const loadEmployees = async (silent = false) => {
    try {
      const [list, biometrics] = await Promise.all([
        getEmployees(),
        getAllBiometrics().catch(() => []),
      ]);

      const registeredIds = new Set(
        (Array.isArray(biometrics) ? biometrics : [])
          .filter((item) => item.status !== "Inactive")
          .map((item) => String(item.employeeId))
      );

      setEmployees(
        (Array.isArray(list) ? list : []).map((employee) =>
          normalizeEmployee(employee, registeredIds)
        )
      );
    } catch (error) {
      console.error("Error loading employees:", error);

      if (!silent) {
        alert(getErrorMessage(error, "Employees could not be loaded."));
      }
    }
  };

  const loadAttendance = async (silent = false) => {
    try {
      const records = await getAllAttendanceForAdmin();

      setAttendanceRecords(
        (Array.isArray(records) ? records : []).map(normalizeAttendance)
      );
    } catch (error) {
      console.error("Error loading attendance:", error);

      if (!silent) {
        alert(getErrorMessage(error, "Attendance could not be loaded."));
      }
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getCurrentSettings();

      if (!settings) return;

      setSettingId(settings.settingId);

      setAdminSettings((previous) => ({
        ...previous,
        arrivalTime: String(settings.workStartTime || "08:00").slice(0, 5),
        departureTime: String(settings.workEndTime || "16:00").slice(0, 5),
        schoolLatitude: settings.schoolLatitude ?? "",
        schoolLongitude: settings.schoolLongitude ?? "",
        allowedRadius: String(settings.allowedRadius ?? "100"),
      }));
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadAttendance();
    loadSettings();

   if (admin?.profilePhoto) {
  const photoUrl = getProfilePhotoUrl(admin.profilePhoto);

  setAdminPhoto(photoUrl);

  setAdminSettings((previous) => ({
    ...previous,
    profilePhoto: admin.profilePhoto,
  }));
}

    // Keep the dashboard live: refresh attendance every 30 seconds
    const timer = setInterval(() => loadAttendance(true), 30000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when the administrator opens a page that shows database data
  useEffect(() => {
    if (activeMenu === "View Employees Attendance") {
      loadAttendance(true);
    }

    if (activeMenu === "Home" || activeMenu === "Manage Employee") {
      loadEmployees(true);
      loadAttendance(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // =====================================================
  // ADMIN PHOTO UPLOAD
  // =====================================================
  const handlePhotoUpload = (event) => {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert("Profile photo must be 2MB or less.");
    return;
  }

  const adminId = admin?.adminId;

  if (!adminId) {
    alert("Administrator session is not valid. Please log in again.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      // Compress image in the browser
      const compressedPhoto = await compressImage(reader.result);

      // Convert temporary Base64 into an actual image file
      const compressedBlob = dataURLToBlob(compressedPhoto);

      const photoFile = new File(
        [compressedBlob],
        "admin-profile.jpg",
        {
          type: "image/jpeg",
        }
      );

      // Upload actual file to Spring Boot
      const savedAdmin = await uploadAdminProfilePhoto(
        adminId,
        photoFile
      );

      // Database now contains only the image path
      const photoPath = savedAdmin.profilePhoto;

      setAdminPhoto(getProfilePhotoUrl(photoPath));

      setAdminSettings((previous) => ({
        ...previous,
        profilePhoto: photoPath,
      }));

      // Keep the updated admin session
      updateSession("admin", savedAdmin);

      alert("Profile photo uploaded successfully.");

    } catch (error) {
      console.error(
        "Error uploading profile photo:",
        error
      );

      alert(
        getErrorMessage(
          error,
          "Profile photo could not be uploaded."
        )
      );
    }
  };

  reader.readAsDataURL(file);
};

  

  // =====================================================
  // SAVE ADMIN SETTINGS
  // =====================================================

  const handleSaveSettings = async () => {
    if (
      !adminSettings.fullName.trim() ||
      !adminSettings.email.trim() ||
      !adminSettings.phone.trim()
    ) {
      alert(
        "Please complete administrator profile information."
      );
      return;
    }

    if (
      !adminSettings.arrivalTime ||
      !adminSettings.departureTime
    ) {
      alert(
        "Please set official arrival and departure times."
      );
      return;
    }

    const latitude = Number(
      adminSettings.schoolLatitude
    );

    const longitude = Number(
      adminSettings.schoolLongitude
    );

    const radius = Number(
      adminSettings.allowedRadius
    );

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      alert(
        "Please enter valid school latitude and longitude values."
      );
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      alert(
        "Allowed radius must be greater than 0 meters."
      );
      return;
    }

    const wantsPasswordChange =
      passwordForm.currentPassword ||
      passwordForm.newPassword ||
      passwordForm.confirmPassword;

    if (wantsPasswordChange) {
      if (
        !passwordForm.currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        alert(
          "Please complete all password fields."
        );
        return;
      }

      if (passwordForm.newPassword.length < 6) {
        alert(
          "New password must be at least 6 characters."
        );
        return;
      }

      if (
        passwordForm.newPassword !==
        passwordForm.confirmPassword
      ) {
        alert(
          "New password and confirmation do not match."
        );
        return;
      }
    }

    try {
      const adminId = admin?.adminId;

      if (!adminId) {
        alert("Administrator session is not valid. Please log in again.");
        return;
      }

      // 1. Password change (the server checks the current password)
      if (wantsPasswordChange) {
        await changeAdminPassword(
          adminId,
          passwordForm.currentPassword,
          passwordForm.newPassword
        );
      }

      // 2. Administrator profile
      const savedAdmin = await updateAdmin(adminId, {
        fullName: adminSettings.fullName.trim(),
        email: adminSettings.email.trim(),
        contact: adminSettings.phone.trim(),
        profilePhoto: adminSettings.profilePhoto || "",
      });

      updateSession("admin", savedAdmin);

      // 3. School settings (GPS centre, radius, work hours)
      const savedSetting = await saveSettings(settingId, {
        schoolName: "Al-Ihsan Girls Secondary School",
        adminEmail: adminSettings.email.trim(),
        adminPhone: adminSettings.phone.trim(),
        schoolLatitude: latitude,
        schoolLongitude: longitude,
        allowedRadius: radius,
        workStartTime: adminSettings.arrivalTime,
        workEndTime: adminSettings.departureTime,
      });

      setSettingId(savedSetting.settingId);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);

      alert(getErrorMessage(error, "Settings could not be saved."));
    }
  };

  // =====================================================
  // EMPLOYEE FORM RESET
  // =====================================================

  const resetEmployeeForm = () => {
    setEmployeeForm({
      employeeId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      position: "",
      hireDate: "",
      username: "",
      password: "",
      status: "Active",
      profilePhoto: "",
    });

    setEditingEmployeeId(null);
    setShowEmployeePassword(false);
  };

  // =====================================================
  // EMPLOYEE INPUT CHANGE
  // =====================================================

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;

    setEmployeeForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =====================================================
  // EMPLOYEE PHOTO
  // =====================================================

  const handleEmployeePhoto = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Profile photo must be 2MB or less.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const photo = await compressImage(reader.result);

      setEmployeeForm((previous) => ({
        ...previous,
        profilePhoto: photo,
      }));
    };

    reader.readAsDataURL(file);
  };

  // =====================================================
  // EMPLOYEE SUBMIT
  // =====================================================

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();

    const requiredFields = [
      "employeeId",
      "firstName",
      "lastName",
      "email",
      "phone",
      "department",
      "position",
      "hireDate",
      "username",
    ];

    const missingField = requiredFields.some(
      (field) =>
        !String(employeeForm[field] || "").trim()
    );

    if (missingField) {
      alert(
        "Please fill in all required employee fields."
      );
      return;
    }

    if (!editingEmployeeId && !employeeForm.password) {
      alert(
        "Please create a password for the employee."
      );
      return;
    }

    if (
      employeeForm.password &&
      employeeForm.password.length < 6
    ) {
      alert(
        "Employee password must be at least 6 characters."
      );
      return;
    }

    const duplicateId = employees.some(
      (employee) =>
        String(employee.employeeId).toLowerCase() ===
          String(employeeForm.employeeId)
            .trim()
            .toLowerCase() &&
        employee.id !== editingEmployeeId
    );

    if (duplicateId) {
      alert("This Employee ID already exists.");
      return;
    }

    const duplicateUsername = employees.some(
      (employee) =>
        String(employee.username || "").toLowerCase() ===
          String(employeeForm.username)
            .trim()
            .toLowerCase() &&
        employee.id !== editingEmployeeId
    );

    if (duplicateUsername) {
      alert("This username is already in use.");
      return;
    }

    const employeeId = String(employeeForm.employeeId)
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9._-]+$/.test(employeeId)) {
      alert(
        "Employee ID may contain only letters, numbers, dot, dash and underscore (example: EMP004)."
      );
      return;
    }

    if (
      editingEmployeeId &&
      employeeId !== String(editingEmployeeId).toUpperCase()
    ) {
      alert(
        "Employee ID cannot be changed after registration. Delete and register the employee again if the ID is wrong."
      );
      return;
    }

    const payload = {
      employeeId,
      firstName: employeeForm.firstName.trim(),
      lastName: employeeForm.lastName.trim(),
      email: employeeForm.email.trim(),
      phone: employeeForm.phone.trim(),
      department: employeeForm.department.trim(),
      position: employeeForm.position.trim(),
      hireDate: employeeForm.hireDate || null,
      username: employeeForm.username.trim(),
      password: employeeForm.password,
      status: employeeForm.status || "Active",
      profilePhoto: employeeForm.profilePhoto || "",
    };

    try {
      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, payload);
      } else {
        await createEmployee(payload);
      }

      await loadEmployees(true);

      alert(
        editingEmployeeId
          ? "Employee information updated successfully!"
          : "Employee registered successfully!"
      );

      resetEmployeeForm();
    } catch (error) {
      console.error("Error saving employee:", error);

      alert(getErrorMessage(error, "Employee could not be saved."));
    }
  };

  // =====================================================
  // EDIT EMPLOYEE
  // =====================================================

  const handleEditEmployee = (employee) => {
    setEditingEmployeeId(employee.id);

    setEmployeeForm({
      employeeId: employee.employeeId || "",
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      department: employee.department || "",
      position: employee.position || "",
      hireDate: employee.hireDate || "",
      username: employee.username || "",
      password: "",
      status: employee.status || "Active",
      profilePhoto: employee.profilePhoto || "",
    });

    setShowEmployeePassword(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // DELETE EMPLOYEE
  // =====================================================

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      `Delete ${
        employee.firstName || "this"
      } ${
        employee.lastName || "employee"
      }? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // The server also removes this employee's attendance and biometric rows
      await deleteEmployee(employee.employeeId);
    } catch (error) {
      console.error("Error deleting employee:", error);

      alert(getErrorMessage(error, "Employee could not be deleted."));
      return;
    }

    await loadEmployees(true);
    await loadAttendance(true);

    if (editingEmployeeId === employee.id) {
      resetEmployeeForm();
    }

    if (selectedEmployee?.id === employee.id) {
      setSelectedEmployee(null);
    }

    alert("Employee deleted successfully.");
  };

  // =====================================================
  // TOGGLE EMPLOYEE STATUS
  // =====================================================

  const handleToggleEmployeeStatus = async (employee) => {
    const newStatus =
      employee.status === "Inactive"
        ? "Active"
        : "Inactive";

    try {
      await updateEmployeeStatus(employee.employeeId, newStatus);

      setEmployees((previous) =>
        previous.map((item) =>
          item.id === employee.id
            ? { ...item, status: newStatus }
            : item
        )
      );
    } catch (error) {
      console.error("Error changing status:", error);

      alert(getErrorMessage(error, "Status could not be changed."));
    }
  };

  // =====================================================
  // VIEW EMPLOYEE
  // =====================================================

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
  };

  // =====================================================
  // SEARCH EMPLOYEES
  // =====================================================

  const filteredEmployees = employees.filter(
    (employee) => {
      const search = searchTerm
        .trim()
        .toLowerCase();

      if (!search) return true;

      return [
        employee.employeeId,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.phone,
        employee.department,
        employee.position,
        employee.username,
        employee.status,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );
    }
  );

  // =====================================================
  // INPUT STYLE
  // =====================================================

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    marginTop: "6px",
    boxSizing: "border-box",
    fontSize: "14px",
  };

  // =====================================================
  // PASSWORD INPUT STYLE
  // =====================================================

  const passwordInputWrapper = {
    position: "relative",
    marginTop: "6px",
  };

  const passwordInputStyle = {
    ...inputStyle,
    marginTop: 0,
    paddingRight: "48px",
  };

  const passwordToggleButton = {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "20px",
    padding: "5px",
    lineHeight: 1,
  };

  // =====================================================
  // GET EMPLOYEE INFORMATION
  // =====================================================

  const getEmployeeInformation = (attendance) => {
    const employeeId =
      attendance.employeeId ||
      attendance.id ||
      attendance.employeeID;

    const employee = employees.find(
      (item) =>
        String(item.employeeId) ===
          String(employeeId) ||
        String(item.id) === String(employeeId)
    );

    return employee;
  };

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (time) => {
    if (!time) {
      return "-";
    }

    return time;
  };

  // =====================================================
  // GET ATTENDANCE LOCATION
  // =====================================================

  const getAttendanceLocation = (attendance) => {
    const latitude =
      attendance.signInLatitude ??
      attendance.latitude;

    const longitude =
      attendance.signInLongitude ??
      attendance.longitude;

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      return null;
    }

    return {
      latitude,
      longitude,

      signInLatitude:
        attendance.signInLatitude ??
        attendance.latitude,

      signInLongitude:
        attendance.signInLongitude ??
        attendance.longitude,

      signOutLatitude:
        attendance.signOutLatitude,

      signOutLongitude:
        attendance.signOutLongitude,

      distance:
        attendance.signInDistanceFromSchool,

      status:
        attendance.signInLocationStatus ||
        "UNKNOWN",

      signOutDistance:
        attendance.signOutDistanceFromSchool,

      signOutStatus:
        attendance.signOutLocationStatus,
    };
  };

  // =====================================================
  // REVERSE GEOCODING
  // =====================================================

  const getPlaceName = async (
    latitude,
    longitude
  ) => {
    setLocationLoading(true);
    setPlaceName("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error(
          "Unable to get location name."
        );
      }

      const data = await response.json();

      if (data.display_name) {
        setPlaceName(data.display_name);
      } else {
        setPlaceName(
          "Place name not available"
        );
      }
    } catch (error) {
      console.error(
        "Reverse geocoding error:",
        error
      );

      setPlaceName(
        "Unable to determine place name"
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // =====================================================
  // OPEN LOCATION
  // =====================================================

  const handleViewLocation = (attendance) => {
    const location =
      getAttendanceLocation(attendance);

    if (!location) {
      alert(
        "Location information is not available for this attendance record."
      );
      return;
    }

    const employee =
      getEmployeeInformation(attendance);

    const locationData = {
      ...location,
      attendance,
      employee,
    };

    setSelectedLocation(locationData);

    getPlaceName(
      location.latitude,
      location.longitude
    );
  };

  // =====================================================
  // CLOSE LOCATION MODAL
  // =====================================================

  const closeLocationModal = () => {
    setSelectedLocation(null);
    setPlaceName("");
  };

  // =====================================================
  // CREATE OPENSTREETMAP URL
  // =====================================================

  const getMapUrl = (
    latitude,
    longitude
  ) => {
    const delta = 0.002;

    const left =
      Number(longitude) - delta;

    const right =
      Number(longitude) + delta;

    const top =
      Number(latitude) + delta;

    const bottom =
      Number(latitude) - delta;

    return (
      `https://www.openstreetmap.org/export/embed.html?` +
      `bbox=${left},${bottom},${right},${top}` +
      `&layer=mapnik` +
      `&marker=${latitude},${longitude}`
    );
  };

  // =====================================================
  // DATE HELPERS
  // =====================================================

  const getLocalDateKey = (dateValue) => {
    if (!dateValue) {
      return "";
    }

    // Dates from MySQL already look like 2026-09-20 - use them as they are
    if (
      typeof dateValue === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getTodayDateKey = () => {
    const now = new Date();

    return getLocalDateKey(now);
  };

  // =====================================================
  // ATTENDANCE STATUS
  // =====================================================

  const getAttendanceStatus = (attendance) => {
    const status = String(
      attendance.status ||
        attendance.attendanceStatus ||
        ""
    )
      .trim()
      .toLowerCase();

    if (status === "late") {
      return "Late";
    }

    if (status === "absent") {
      return "Absent";
    }

    if (status === "present") {
      return "Present";
    }

    if (attendance.signIn) {
      return "Present";
    }

    return "Absent";
  };

  // =====================================================
  // GET RECORD EMPLOYEE ID
  // =====================================================

  const getAttendanceEmployeeId = (
    attendance
  ) => {
    return (
      attendance.employeeId ||
      attendance.empId ||
      attendance.employeeID ||
      attendance.employee_id ||
      attendance.id
    );
  };

  // =====================================================
  // ATTENDANCE FILTER
  // =====================================================

  const getFilteredAttendanceRecords = () => {
    if (attendanceFilter === "all") {
      return attendanceRecords;
    }

    const now = new Date();

    const todayKey =
      getLocalDateKey(now);

    // TODAY
    if (attendanceFilter === "today") {
      return attendanceRecords.filter(
        (record) =>
          getLocalDateKey(
            record.date
          ) === todayKey
      );
    }

    // THIS WEEK
    if (attendanceFilter === "week") {
      const startOfWeek =
        new Date(now);

      const currentDay =
        startOfWeek.getDay();

      const mondayOffset =
        currentDay === 0
          ? -6
          : 1 - currentDay;

      startOfWeek.setHours(
        0,
        0,
        0,
        0
      );

      startOfWeek.setDate(
        startOfWeek.getDate() +
          mondayOffset
      );

      const endOfWeek =
        new Date(startOfWeek);

      endOfWeek.setDate(
        startOfWeek.getDate() + 6
      );

      endOfWeek.setHours(
        23,
        59,
        59,
        999
      );

      return attendanceRecords.filter(
        (record) => {
          const recordDate =
            new Date(record.date);

          if (
            Number.isNaN(
              recordDate.getTime()
            )
          ) {
            return false;
          }

          return (
            recordDate >=
              startOfWeek &&
            recordDate <=
              endOfWeek
          );
        }
      );
    }

    // THIS MONTH
    if (attendanceFilter === "month") {
      const currentYear =
        now.getFullYear();

      const currentMonth =
        now.getMonth();

      return attendanceRecords.filter(
        (record) => {
          const recordDate =
            new Date(record.date);

          if (
            Number.isNaN(
              recordDate.getTime()
            )
          ) {
            return false;
          }

          return (
            recordDate.getFullYear() ===
              currentYear &&
            recordDate.getMonth() ===
              currentMonth
          );
        }
      );
    }

    return attendanceRecords;
  };

  const filteredAttendanceRecords =
    getFilteredAttendanceRecords();

  // =====================================================
  // ATTENDANCE SUMMARY
  // =====================================================

  const today = getTodayDateKey();

  const todayAttendance =
    attendanceRecords.filter(
      (attendance) =>
        getLocalDateKey(
          attendance.date
        ) === today
    );

  const todayEmployeeStatus =
    new Map();

  todayAttendance.forEach(
    (attendance) => {
      const employeeId =
        getAttendanceEmployeeId(
          attendance
        );

      if (!employeeId) return;

      const status =
        getAttendanceStatus(
          attendance
        );

      const existing =
        todayEmployeeStatus.get(
          String(employeeId)
        );

      if (
        !existing ||
        status === "Late"
      ) {
        todayEmployeeStatus.set(
          String(employeeId),
          status
        );
      }
    }
  );

  const presentToday =
    Array.from(
      todayEmployeeStatus.values()
    ).filter(
      (status) =>
        status === "Present"
    ).length;

  const lateToday =
    Array.from(
      todayEmployeeStatus.values()
    ).filter(
      (status) =>
        status === "Late"
    ).length;

  const absentToday = Math.max(
    employees.length -
      presentToday -
      lateToday,
    0
  );

  // =====================================================
  // WEEKLY ATTENDANCE CHART
  // =====================================================

  const startOfCurrentWeek =
    new Date();

  const currentDay =
    startOfCurrentWeek.getDay();

  const mondayOffset =
    currentDay === 0
      ? -6
      : 1 - currentDay;

  startOfCurrentWeek.setHours(
    0,
    0,
    0,
    0
  );

  startOfCurrentWeek.setDate(
    startOfCurrentWeek.getDate() +
      mondayOffset
  );

  const weeklyAttendanceData = [
    { label: "Mon", offset: 0 },
    { label: "Tue", offset: 1 },
    { label: "Wed", offset: 2 },
    { label: "Thu", offset: 3 },
    { label: "Fri", offset: 4 },
  ].map((day) => {
    const date =
      new Date(startOfCurrentWeek);

    date.setDate(
      startOfCurrentWeek.getDate() +
        day.offset
    );

    const dateKey =
      getLocalDateKey(date);

    const dayRecords =
      attendanceRecords.filter(
        (record) =>
          getLocalDateKey(
            record.date
          ) === dateKey
      );

    const employeeStatus =
      new Map();

    dayRecords.forEach(
      (record) => {
        const employeeId =
          getAttendanceEmployeeId(
            record
          );

        if (!employeeId) {
          return;
        }

        const status =
          getAttendanceStatus(
            record
          );

        const existing =
          employeeStatus.get(
            String(employeeId)
          );

        if (
          !existing ||
          status === "Late"
        ) {
          employeeStatus.set(
            String(employeeId),
            status
          );
        }
      }
    );

    const present =
      Array.from(
        employeeStatus.values()
      ).filter(
        (status) =>
          status === "Present"
      ).length;

    const late =
      Array.from(
        employeeStatus.values()
      ).filter(
        (status) =>
          status === "Late"
      ).length;

    const absent = Math.max(
      employees.length -
        present -
        late,
      0
    );

    return {
      label: day.label,
      dateKey,
      present,
      late,
      absent,
      total: employees.length,
    };
  });

  // =====================================================
  // ATTENDANCE STATUS STYLE
  // =====================================================

  const getAttendanceStatusStyle = (
    status
  ) => {
    if (status === "Late") {
      return {
        background: "#fff3cd",
        color: "#856404",
      };
    }

    if (status === "Present") {
      return {
        background: "#e8f5e9",
        color: "#2e7d32",
      };
    }

    return {
      background: "#ffebee",
      color: "#c62828",
    };
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    clearSession("admin");

    window.location.href = "/";
  };

  // =====================================================
  // RETURN
  // =====================================================

  return (
    <div className="admin-dashboard">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="admin-sidebar">

        <div className="school-logo">

          <img
            src="/LOGO.JPG"
            alt="School Logo"
            className="sidebar-logo"
          />

          <div>
            <h2>AL-IHSAN</h2>
            <p>GIRLS SECONDARY SCHOOL</p>
          </div>

        </div>

        <div className="sidebar-line"></div>

        <nav className="admin-menu">

          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`menu-item ${
                activeMenu === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveMenu(item.name)
              }
            >
              <span className="menu-icon">
                {item.icon}
              </span>

              <span>{item.name}</span>
            </button>
          ))}

        </nav>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="admin-main">

        {/* =====================================================
            TOP BAR
        ===================================================== */}

        <div className="top-bar">

          <div>
            <h1>
              Administrator Dashboard
            </h1>

            <p>
              Manage and monitor the employee
              attendance system.
            </p>
          </div>

          <div className="admin-small-profile">

            {adminPhoto ? (
              <img
                src={adminPhoto}
                alt="Administrator"
                className="small-profile-image uploaded-small-image"
              />
            ) : (
              <div className="small-profile-image">
                {adminName
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
            )}

            <div>
              <strong>{adminName}</strong>
              <span>{adminPosition}</span>
            </div>

          </div>

        </div>

        {/* =====================================================
            HOME
        ===================================================== */}

        {activeMenu === "Home" && (
          <section className="home-section">

            <div className="welcome-card">

              <div>
                <h2>
                  Welcome back,{" "}
                  {adminName}! 👋
                </h2>

                <p>
                  Welcome to the
                  Al-Ihsan Girls
                  Secondary School
                  Employee Attendance
                  Management System.
                </p>
              </div>

            </div>

            <div className="profile-card">

              <div className="profile-header">
                <div>
                  <h2>
                    Administrator Profile
                  </h2>

                  <p>
                    Your personal information
                  </p>
                </div>
              </div>

              <div className="profile-content">

                <div className="admin-photo-container">

                  <div className="admin-photo-wrapper">

                    {adminPhoto ? (
                      <img
                        src={adminPhoto}
                        alt="Administrator"
                        className="admin-photo uploaded-admin-photo"
                      />
                    ) : (
                      <div className="admin-photo">
                        {adminName
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                    )}

                  </div>

                  <h3>{adminName}</h3>

                  <p>{adminPosition}</p>

                  <label
                    htmlFor="admin-photo-upload"
                    className="upload-photo-button"
                  >
                    📷 Upload Photo
                  </label>

                  <input
                    id="admin-photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={
                      handlePhotoUpload
                    }
                    hidden
                  />

                </div>

                <div className="admin-information">

                  <div className="information-item">
                    <span className="information-label">
                      Full Name
                    </span>

                    <strong>
                      {adminName}
                    </strong>
                  </div>

                  <div className="information-item">
                    <span className="information-label">
                      Position
                    </span>

                    <strong>
                      {adminPosition}
                    </strong>
                  </div>

                  <div className="information-item">
                    <span className="information-label">
                      Contact
                    </span>

                    <strong>
                      {adminPhone}
                    </strong>
                  </div>

                  <div className="information-item">
                    <span className="information-label">
                      Email
                    </span>

                    <strong>
                      {adminEmail}
                    </strong>
                  </div>

                </div>

              </div>

            </div>

          </section>
        )}

        {/* =====================================================
            VIEW EMPLOYEES ATTENDANCE
        ===================================================== */}

        {activeMenu ===
          "View Employees Attendance" && (
          <div
            className="view-attendance-container"
            style={{ padding: "20px" }}
          >

            <div style={{ marginBottom: "20px" }}>

              <h2>
                View Employees Attendance
              </h2>

              <p style={{ color: "#666" }}>
                Administrator can view and
                monitor employee attendance
                records here.
              </p>

            </div>

            {/* SUMMARY CARDS */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "15px",
                marginBottom: "25px",
              }}
            >

              <div
                style={{
                  background: "#e3f2fd",
                  padding: "20px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <h4>Total Employees</h4>

                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                  }}
                >
                  {employees.length}
                </span>
              </div>

              <div
                style={{
                  background: "#e8f5e9",
                  padding: "20px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <h4>Present Today</h4>

                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                  }}
                >
                  {presentToday}
                </span>
              </div>

              <div
                style={{
                  background: "#fffde7",
                  padding: "20px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <h4>Late Today</h4>

                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                  }}
                >
                  {lateToday}
                </span>
              </div>

              <div
                style={{
                  background: "#ffebee",
                  padding: "20px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <h4>Absent Today</h4>

                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                  }}
                >
                  {absentToday}
                </span>
              </div>

            </div>

            {/* WEEKLY REPORT */}

            <div
              style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid #ddd",
                marginBottom: "25px",
              }}
            >

              <h3 style={{ marginBottom: "6px" }}>
                Overall Employees Weekly Report
              </h3>

              <p
                style={{
                  color: "#666",
                  marginTop: 0,
                  marginBottom: "18px",
                }}
              >
                Total attendance status for
                all registered employees from
                Monday to Friday.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(5, minmax(70px, 1fr))",
                  gap: "14px",
                  alignItems: "end",
                  minHeight: "260px",
                  padding:
                    "20px 10px 10px",
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: "8px",
                }}
              >

                {weeklyAttendanceData.map(
                  (day) => {
                    const total =
                      Math.max(
                        day.total,
                        1
                      );

                    const maxChartHeight =
                      180;

                    const presentHeight =
                      (day.present /
                        total) *
                      maxChartHeight;

                    const lateHeight =
                      (day.late /
                        total) *
                      maxChartHeight;

                    const absentHeight =
                      (day.absent /
                        total) *
                      maxChartHeight;

                    return (
                      <div
                        key={day.dateKey}
                        style={{
                          display: "flex",
                          flexDirection:
                            "column",
                          alignItems:
                            "center",
                          justifyContent:
                            "flex-end",
                          height: "220px",
                        }}
                      >

                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            marginBottom: "6px",
                          }}
                        >
                          {day.present +
                            day.late}
                          /
                          {day.total}
                        </div>

                        <div
                          title={`${day.label}: ${day.present} present, ${day.late} late, ${day.absent} absent`}
                          style={{
                            width: "42px",
                            height: `${maxChartHeight}px`,
                            display: "flex",
                            flexDirection:
                              "column-reverse",
                            borderRadius:
                              "5px 5px 0 0",
                            overflow: "hidden",
                            background: "#eee",
                          }}
                        >

                          <div
                            style={{
                              height:
                                `${presentHeight}px`,
                              background:
                                "#2e7d32",
                              transition:
                                "height 0.4s ease",
                            }}
                          />

                          <div
                            style={{
                              height:
                                `${lateHeight}px`,
                              background:
                                "#f9a825",
                              transition:
                                "height 0.4s ease",
                            }}
                          />

                          <div
                            style={{
                              height:
                                `${absentHeight}px`,
                              background:
                                "#e0e0e0",
                              transition:
                                "height 0.4s ease",
                            }}
                          />

                        </div>

                        <strong
                          style={{
                            marginTop: "8px",
                          }}
                        >
                          {day.label}
                        </strong>

                        <small
                          style={{
                            color: "#777",
                            marginTop: "3px",
                          }}
                        >
                          {day.present} P ·{" "}
                          {day.late} L ·{" "}
                          {day.absent} A
                        </small>

                      </div>
                    );
                  }
                )}

              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "center",
                  gap: "20px",
                  flexWrap: "wrap",
                  marginTop: "18px",
                  fontSize: "13px",
                }}
              >
                <span>🟩 Present</span>
                <span>🟨 Late</span>
                <span>⬜ Absent</span>
              </div>

              <p
                style={{
                  textAlign: "center",
                  color: "#777",
                  fontSize: "12px",
                  marginBottom: 0,
                }}
              >
                The chart updates automatically
                from the attendance records stored
                by employees.
              </p>

            </div>

            {/* DAILY ATTENDANCE TABLE */}

            <div
              style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid #ddd",
                overflowX: "auto",
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                  gap: "15px",
                  flexWrap: "wrap",
                }}
              >

                <div>
                  <h3>
                    Daily Attendance Records
                  </h3>

                  <p
                    style={{
                      color: "#777",
                      margin: "5px 0 0",
                    }}
                  >
                    Attendance records including
                    employee location.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems:
                      "center",
                    flexWrap: "wrap",
                  }}
                >

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight:
                          "bold",
                        color: "#555",
                        marginBottom:
                          "5px",
                      }}
                    >
                      Attendance Period
                    </label>

                    <select
                      value={
                        attendanceFilter
                      }
                      onChange={(event) =>
                        setAttendanceFilter(
                          event.target.value
                        )
                      }
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #ccc",
                        borderRadius: "7px",
                        background:
                          "#fff",
                        cursor:
                          "pointer",
                        minWidth:
                          "150px",
                        fontSize:
                          "14px",
                      }}
                    >
                      <option value="all">
                        All Records
                      </option>

                      <option value="today">
                        Today
                      </option>

                      <option value="week">
                        This Week
                      </option>

                      <option value="month">
                        This Month
                      </option>
                    </select>
                  </div>

                  <button
                    onClick={() => loadAttendance()}
                    style={{
                      padding:
                        "10px 15px",
                      border:
                        "1px solid #2d7d46",
                      background:
                        "#fff",
                      color:
                        "#2d7d46",
                      borderRadius:
                        "7px",
                      cursor:
                        "pointer",
                      fontWeight:
                        "bold",
                      marginTop:
                        "18px",
                    }}
                  >
                    🔄 Refresh
                  </button>

                </div>

              </div>

              <div
                style={{
                  background:
                    "#f8faf9",
                  border:
                    "1px solid #e1e8e3",
                  borderRadius:
                    "8px",
                  padding:
                    "10px 14px",
                  marginBottom:
                    "15px",
                  color:
                    "#555",
                  fontSize:
                    "13px",
                }}
              >
                Showing{" "}
                <strong>
                  {
                    filteredAttendanceRecords.length
                  }
                </strong>{" "}
                attendance record
                {filteredAttendanceRecords.length ===
                1
                  ? ""
                  : "s"}{" "}
                —{" "}
                <strong>
                  {attendanceFilter ===
                    "all" &&
                    "All Records"}

                  {attendanceFilter ===
                    "today" &&
                    "Today"}

                  {attendanceFilter ===
                    "week" &&
                    "This Week"}

                  {attendanceFilter ===
                    "month" &&
                    "This Month"}
                </strong>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  marginTop: "15px",
                  minWidth:
                    "1000px",
                }}
              >

                <thead>
                  <tr
                    style={{
                      background:
                        "#f5f5f5",
                    }}
                  >
                    <th style={{ padding: "12px" }}>
                      Date
                    </th>

                    <th style={{ padding: "12px" }}>
                      First Name
                    </th>

                    <th style={{ padding: "12px" }}>
                      Last Name
                    </th>

                    <th style={{ padding: "12px" }}>
                      ID
                    </th>

                    <th style={{ padding: "12px" }}>
                      Position
                    </th>

                    <th style={{ padding: "12px" }}>
                      Sign In
                    </th>

                    <th style={{ padding: "12px" }}>
                      Sign Out
                    </th>

                    <th style={{ padding: "12px" }}>
                      Status
                    </th>

                    <th style={{ padding: "12px" }}>
                      Location
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {filteredAttendanceRecords.length >
                  0 ? (
                    filteredAttendanceRecords.map(
                      (
                        attendance,
                        index
                      ) => {

                        const employee =
                          getEmployeeInformation(
                            attendance
                          );

                        const location =
                          getAttendanceLocation(
                            attendance
                          );

                        const attendanceStatus =
                          getAttendanceStatus(
                            attendance
                          );

                        const statusStyle =
                          getAttendanceStatusStyle(
                            attendanceStatus
                          );

                        return (
                          <tr
                            key={
                              attendance.id ||
                              attendance.attendanceId ||
                              `${attendance.employeeId}-${attendance.date}-${index}`
                            }
                            style={{
                              borderBottom:
                                "1px solid #eee",
                            }}
                          >

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {attendance.date ||
                                "-"}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {employee?.firstName ||
                                attendance.firstName ||
                                "-"}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {employee?.lastName ||
                                attendance.lastName ||
                                "-"}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {employee?.employeeId ||
                                attendance.employeeId ||
                                "-"}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {employee?.position ||
                                attendance.position ||
                                "-"}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {formatTime(
                                attendance.signIn
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              {formatTime(
                                attendance.signOut
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              <span
                                style={{
                                  display:
                                    "inline-block",
                                  padding:
                                    "6px 12px",
                                  borderRadius:
                                    "20px",
                                  background:
                                    statusStyle.background,
                                  color:
                                    statusStyle.color,
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    "bold",
                                  minWidth:
                                    "70px",
                                  textAlign:
                                    "center",
                                }}
                              >
                                {
                                  attendanceStatus
                                }
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "12px",
                              }}
                            >

                              {location ? (
                                <button
                                  onClick={() =>
                                    handleViewLocation(
                                      attendance
                                    )
                                  }
                                  style={{
                                    background:
                                      "#2d7d46",
                                    color:
                                      "#fff",
                                    border:
                                      "none",
                                    padding:
                                      "8px 12px",
                                    borderRadius:
                                      "6px",
                                    cursor:
                                      "pointer",
                                    fontWeight:
                                      "bold",
                                  }}
                                >
                                  📍 View Location
                                </button>
                              ) : (
                                <span
                                  style={{
                                    color:
                                      "#999",
                                  }}
                                >
                                  No location
                                </span>
                              )}

                            </td>

                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "35px",
                          color:
                            "#888",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "35px",
                            marginBottom:
                              "10px",
                          }}
                        >
                          📂
                        </div>

                        No attendance records
                        found for the selected
                        period.

                        <br />

                        <small>
                          Attendance records will
                          appear here after an
                          employee completes
                          attendance.
                        </small>
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>

            </div>

          </div>
        )}

        {/* =====================================================
            MANAGE EMPLOYEE
        ===================================================== */}

        {activeMenu === "Manage Employee" && (
          <div
            className="manage-employee-container"
            style={{
              padding: "20px",
              maxWidth: "1200px",
            }}
          >

            <div
              style={{
                marginBottom: "25px",
              }}
            >
              <h2
                style={{
                  color: "#1b4332",
                  marginBottom: "5px",
                }}
              >
                Employee Management
              </h2>

              <p style={{ color: "#666" }}>
                Register new employees and
                manage staff records.
              </p>
            </div>

            {/* EMPLOYEE FORM */}

            <div
              style={{
                background: "#fff",
                padding: "25px",
                borderRadius: "12px",
                marginBottom: "30px",
                border: "1px solid #ddd",
              }}
            >

              <div className="employee-form-heading">

                <div>
                  <h2
                    style={{
                      color: "#1b4332",
                      marginBottom: "5px",
                    }}
                  >
                    {editingEmployeeId
                      ? "Edit Employee"
                      : "Register Employee"}
                  </h2>

                  <p
                    style={{
                      color: "#777",
                      marginBottom: 0,
                    }}
                  >
                    {editingEmployeeId
                      ? "Update employee information below. Leave password blank to keep the current password."
                      : "Enter employee information and login credentials below."}
                  </p>
                </div>

                {editingEmployeeId && (
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={
                      resetEmployeeForm
                    }
                  >
                    Cancel Edit
                  </button>
                )}

              </div>

              <form
                onSubmit={
                  handleEmployeeSubmit
                }
              >

                <div className="employee-form-grid">

                  <div>
                    <label>
                      Employee ID *
                    </label>

                    <input
                      type="text"
                      name="employeeId"
                      value={
                        employeeForm.employeeId
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="e.g. AGS001"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      First Name *
                    </label>

                    <input
                      type="text"
                      name="firstName"
                      value={
                        employeeForm.firstName
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="Enter first name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Last Name *
                    </label>

                    <input
                      type="text"
                      name="lastName"
                      value={
                        employeeForm.lastName
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="Enter last name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Email *
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={
                        employeeForm.email
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="employee@email.com"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Phone Number *
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={
                        employeeForm.phone
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="+255..."
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Department *
                    </label>

                    <select
                      name="department"
                      value={
                        employeeForm.department
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      style={inputStyle}
                    >
                      <option value="">
                        Select department
                      </option>

                      <option value="Teaching">
                        Teaching
                      </option>

                      <option value="Administration">
                        Administration
                      </option>

                      <option value="Finance">
                        Finance
                      </option>

                      <option value="ICT">
                        ICT
                      </option>

                      <option value="Human Resources">
                        Human Resources
                      </option>
                    </select>
                  </div>

                  <div>
                    <label>
                      Position *
                    </label>

                    <input
                      type="text"
                      name="position"
                      value={
                        employeeForm.position
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="e.g. Teacher"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Hire Date *
                    </label>

                    <input
                      type="date"
                      name="hireDate"
                      value={
                        employeeForm.hireDate
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Username *
                    </label>

                    <input
                      type="text"
                      name="username"
                      value={
                        employeeForm.username
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      placeholder="Employee login username"
                      style={inputStyle}
                    />
                  </div>

                  {/* EMPLOYEE PASSWORD WITH HIDE/UNHIDE */}

                  <div>
                    <label>
                      {editingEmployeeId
                        ? "New Password"
                        : "Password *"}
                    </label>

                    <div
                      style={
                        passwordInputWrapper
                      }
                    >

                      <input
                        type={
                          showEmployeePassword
                            ? "text"
                            : "password"
                        }
                        name="password"
                        value={
                          employeeForm.password
                        }
                        onChange={
                          handleEmployeeChange
                        }
                        placeholder={
                          editingEmployeeId
                            ? "Leave blank to keep current"
                            : "Create password"
                        }
                        style={
                          passwordInputStyle
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowEmployeePassword(
                            (previous) =>
                              !previous
                          )
                        }
                        style={
                          passwordToggleButton
                        }
                        aria-label={
                          showEmployeePassword
                            ? "Hide employee password"
                            : "Show employee password"
                        }
                      >
                        {showEmployeePassword
                          ? "🙈"
                          : "👁️"}
                      </button>

                    </div>
                  </div>

                  <div>
                    <label>
                      Account Status
                    </label>

                    <select
                      name="status"
                      value={
                        employeeForm.status
                      }
                      onChange={
                        handleEmployeeChange
                      }
                      style={inputStyle}
                    >
                      <option value="Active">
                        Active
                      </option>

                      <option value="Inactive">
                        Inactive
                      </option>
                    </select>
                  </div>

                  <div>
                    <label>
                      Profile Photo
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleEmployeePhoto
                      }
                      style={{
                        ...inputStyle,
                        padding: "9px",
                      }}
                    />

                    {employeeForm.profilePhoto && (
                      <img
                        src={
                          employeeForm.profilePhoto
                        }
                        alt="Employee preview"
                        className="employee-photo-preview"
                      />
                    )}
                  </div>

                </div>

                <button
                  type="submit"
                  className="employee-submit-button"
                >
                  {editingEmployeeId
                    ? "Update Employee"
                    : "Register Employee"}
                </button>

              </form>

            </div>

            {/* EMPLOYEE DIRECTORY */}

            <div
              style={{
                background: "#fff",
                padding: "25px",
                borderRadius: "12px",
                border: "1px solid #ddd",
              }}
            >

              <div className="directory-header">

                <div>
                  <h3
                    style={{
                      color: "#1b4332",
                      marginBottom: "5px",
                    }}
                  >
                    Employee Directory
                  </h3>

                  <p
                    style={{
                      color: "#777",
                      margin: 0,
                    }}
                  >
                    {employees.length} employee
                    {employees.length === 1
                      ? ""
                      : "s"}{" "}
                    registered
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search ID, name, email, department, username..."
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  className="employee-search-input"
                />

              </div>

              <div
                style={{
                  overflowX: "auto",
                }}
              >

                <table className="employee-directory-table">

                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Contact</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Biometric</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredEmployees.length >
                    0 ? (
                      filteredEmployees.map(
                        (employee) => (
                          <tr
                            key={
                              employee.id
                            }
                          >

                            <td>
                              <div className="employee-table-person">

                                {employee.profilePhoto ? (
                                  <img
                                    src={
                                      employee.profilePhoto
                                    }
                                    alt=""
                                    className="employee-table-photo"
                                  />
                                ) : (
                                  <div className="employee-table-photo employee-table-placeholder">
                                    👤
                                  </div>
                                )}

                                <div>
                                  <strong>
                                    {
                                      employee.firstName
                                    }{" "}
                                    {
                                      employee.lastName
                                    }
                                  </strong>

                                  <small>
                                    {
                                      employee.employeeId
                                    }
                                  </small>
                                </div>

                              </div>
                            </td>

                            <td>
                              <div>
                                {
                                  employee.email ||
                                  "-"
                                }
                              </div>

                              <small>
                                {
                                  employee.phone ||
                                  "-"
                                }
                              </small>
                            </td>

                            <td>
                              {
                                employee.department ||
                                "-"
                              }
                            </td>

                            <td>
                              {
                                employee.position ||
                                "-"
                              }
                            </td>

                            <td>
                              <span
                                className={`employee-status-badge ${
                                  (
                                    employee.status ||
                                    "Active"
                                  ).toLowerCase()
                                }`}
                              >
                                {
                                  employee.status ||
                                  "Active"
                                }
                              </span>
                            </td>

                            <td>
                              <span
                                className={`biometric-badge ${
                                  employee.biometricStatus ===
                                  "Registered"
                                    ? "registered"
                                    : "not-registered"
                                }`}
                              >
                                {
                                  employee.biometricStatus ||
                                  "Not Registered"
                                }
                              </span>
                            </td>

                            <td>
                              <div className="employee-action-buttons">

                                <button
                                  type="button"
                                  className="view-action"
                                  onClick={() =>
                                    handleViewEmployee(
                                      employee
                                    )
                                  }
                                >
                                  View
                                </button>

                                <button
                                  type="button"
                                  className="edit-action"
                                  onClick={() =>
                                    handleEditEmployee(
                                      employee
                                    )
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="status-action"
                                  onClick={() =>
                                    handleToggleEmployeeStatus(
                                      employee
                                    )
                                  }
                                >
                                  {
                                    employee.status ===
                                    "Inactive"
                                      ? "Activate"
                                      : "Deactivate"
                                  }
                                </button>

                                <button
                                  type="button"
                                  className="delete-action"
                                  onClick={() =>
                                    handleDeleteEmployee(
                                      employee
                                    )
                                  }
                                >
                                  Delete
                                </button>

                              </div>
                            </td>

                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          style={{
                            textAlign:
                              "center",
                            padding:
                              "30px",
                            color:
                              "#777",
                          }}
                        >
                          {employees.length ===
                          0
                            ? "No employees have been registered yet."
                            : "No employees match your search."}
                        </td>
                      </tr>
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* EMPLOYEE DETAILS MODAL */}

            {selectedEmployee && (
              <div
                className="employee-modal-overlay"
                onClick={() =>
                  setSelectedEmployee(
                    null
                  )
                }
              >

                <div
                  className="employee-details-modal"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >

                  <div className="employee-modal-header">

                    <h3>
                      Employee Details
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedEmployee(
                          null
                        )
                      }
                    >
                      ×
                    </button>

                  </div>

                  <div className="employee-details-top">

                    {selectedEmployee.profilePhoto ? (
                      <img
                        src={
                          selectedEmployee.profilePhoto
                        }
                        alt="Employee"
                        className="employee-details-photo"
                      />
                    ) : (
                      <div className="employee-details-photo employee-details-placeholder">
                        👤
                      </div>
                    )}

                    <div>
                      <h2>
                        {
                          selectedEmployee.firstName
                        }{" "}
                        {
                          selectedEmployee.lastName
                        }
                      </h2>

                      <p>
                        {
                          selectedEmployee.position ||
                          "Employee"
                        }
                      </p>

                      <span
                        className={`employee-status-badge ${
                          (
                            selectedEmployee.status ||
                            "Active"
                          ).toLowerCase()
                        }`}
                      >
                        {
                          selectedEmployee.status ||
                          "Active"
                        }
                      </span>
                    </div>

                  </div>

                  <div className="employee-details-grid">

                    <div>
                      <strong>
                        Employee ID
                      </strong>

                      <span>
                        {
                          selectedEmployee.employeeId ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Username
                      </strong>

                      <span>
                        {
                          selectedEmployee.username ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Email
                      </strong>

                      <span>
                        {
                          selectedEmployee.email ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Phone
                      </strong>

                      <span>
                        {
                          selectedEmployee.phone ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Department
                      </strong>

                      <span>
                        {
                          selectedEmployee.department ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Position
                      </strong>

                      <span>
                        {
                          selectedEmployee.position ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Hire Date
                      </strong>

                      <span>
                        {
                          selectedEmployee.hireDate ||
                          "-"
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        Biometric Status
                      </strong>

                      <span>
                        {
                          selectedEmployee.biometricStatus ||
                          "Not Registered"
                        }
                      </span>
                    </div>

                  </div>

                  <div className="employee-modal-footer">

                    <button
                      type="button"
                      className="edit-action"
                      onClick={() => {
                        setSelectedEmployee(
                          null
                        );

                        handleEditEmployee(
                          selectedEmployee
                        );
                      }}
                    >
                      Edit Employee
                    </button>

                    <button
                      type="button"
                      className="secondary-action-button"
                      onClick={() =>
                        setSelectedEmployee(
                          null
                        )
                      }
                    >
                      Close
                    </button>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            SETTINGS
        ===================================================== */}

        {activeMenu === "Settings" && (
          <div
            className="settings-container"
            style={{
              padding: "20px",
              maxWidth: "900px",
            }}
          >

            <div
              style={{
                marginBottom: "25px",
              }}
            >

              <h2
                style={{
                  color: "#1b4332",
                }}
              >
                System & Profile Settings
              </h2>

              <p style={{ color: "#666" }}>
                Configure system rules,
                administrator profile,
                attendance location and
                security settings.
              </p>

            </div>

            {/* ADMIN PROFILE */}

            <div className="settings-card">

              <h3>
                👤 Administrator Profile
              </h3>

              <p>
                Update administrator profile
                information.
              </p>

              <div className="settings-profile-layout">

                <div className="settings-photo-area">

                  {adminPhoto ? (
                    <img
                      src={adminPhoto}
                      alt="Administrator"
                      className="settings-profile-photo"
                    />
                  ) : (
                    <div className="settings-profile-placeholder">
                      👤
                    </div>
                  )}

                  <label className="settings-upload-button">
                    Change Photo

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handlePhotoUpload
                      }
                      hidden
                    />
                  </label>

                </div>

                <div className="settings-grid">

                  <div>
                    <label>
                      Full Name
                    </label>

                    <input
                      type="text"
                      value={
                        adminSettings.fullName
                      }
                      onChange={(e) =>
                        setAdminSettings({
                          ...adminSettings,
                          fullName:
                            e.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Email Address
                    </label>

                    <input
                      type="email"
                      value={
                        adminSettings.email
                      }
                      onChange={(e) =>
                        setAdminSettings({
                          ...adminSettings,
                          email:
                            e.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Phone Number
                    </label>

                    <input
                      type="text"
                      value={
                        adminSettings.phone
                      }
                      onChange={(e) =>
                        setAdminSettings({
                          ...adminSettings,
                          phone:
                            e.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label>
                      Role
                    </label>

                    <input
                      type="text"
                      value="Administrator"
                      disabled
                      style={{
                        ...inputStyle,
                        background:
                          "#f5f5f5",
                      }}
                    />
                  </div>

                </div>

              </div>

            </div>

            {/* WORK TIME */}

            <div className="settings-card">

              <h3>
                ⏰ Attendance & Work Time Rules
              </h3>

              <p>
                Set official employee arrival
                and departure times.
              </p>

              <div className="settings-grid">

                <div>
                  <label>
                    Official Arrival Time
                  </label>

                  <input
                    type="time"
                    value={
                      adminSettings.arrivalTime
                    }
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        arrivalTime:
                          e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label>
                    Official Departure Time
                  </label>

                  <input
                    type="time"
                    value={
                      adminSettings.departureTime
                    }
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        departureTime:
                          e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

              </div>

            </div>

            {/* LOCATION */}

            <div className="settings-card">

              <h3>
                📍 Attendance Location
              </h3>

              <p>
                Define the school location and
                the allowed attendance radius.
              </p>

              <div className="settings-grid three-columns">

                <div>
                  <label>
                    School Latitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={
                      adminSettings.schoolLatitude
                    }
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        schoolLatitude:
                          e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label>
                    School Longitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    value={
                      adminSettings.schoolLongitude
                    }
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        schoolLongitude:
                          e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label>
                    Allowed Radius (meters)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={
                      adminSettings.allowedRadius
                    }
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        allowedRadius:
                          e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

              </div>

            </div>

            {/* SECURITY / CHANGE PASSWORD */}

            <div className="settings-card">

              <h3>
                🔒 Security & Change Password
              </h3>

              <p>
                Change the administrator
                password. Password visibility
                can be controlled using the
                eye button.
              </p>

              <div className="settings-grid three-columns">

                {/* CURRENT PASSWORD */}

                <div>
                  <label>
                    Current Password
                  </label>

                  <div
                    style={
                      passwordInputWrapper
                    }
                  >

                    <input
                      type={
                        showCurrentPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        passwordForm.currentPassword
                      }
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword:
                            e.target.value,
                        })
                      }
                      placeholder="Current password"
                      style={
                        passwordInputStyle
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(
                          (previous) =>
                            !previous
                        )
                      }
                      style={
                        passwordToggleButton
                      }
                      aria-label={
                        showCurrentPassword
                          ? "Hide current password"
                          : "Show current password"
                      }
                    >
                      {showCurrentPassword
                        ? "🙈"
                        : "👁️"}
                    </button>

                  </div>
                </div>

                {/* NEW PASSWORD */}

                <div>
                  <label>
                    New Password
                  </label>

                  <div
                    style={
                      passwordInputWrapper
                    }
                  >

                    <input
                      type={
                        showNewPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        passwordForm.newPassword
                      }
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword:
                            e.target.value,
                        })
                      }
                      placeholder="New password"
                      style={
                        passwordInputStyle
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewPassword(
                          (previous) =>
                            !previous
                        )
                      }
                      style={
                        passwordToggleButton
                      }
                      aria-label={
                        showNewPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {showNewPassword
                        ? "🙈"
                        : "👁️"}
                    </button>

                  </div>
                </div>

                {/* CONFIRM PASSWORD */}

                <div>
                  <label>
                    Confirm Password
                  </label>

                  <div
                    style={
                      passwordInputWrapper
                    }
                  >

                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        passwordForm.confirmPassword
                      }
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword:
                            e.target.value,
                        })
                      }
                      placeholder="Confirm password"
                      style={
                        passwordInputStyle
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (previous) =>
                            !previous
                        )
                      }
                      style={
                        passwordToggleButton
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirmation password"
                          : "Show confirmation password"
                      }
                    >
                      {showConfirmPassword
                        ? "🙈"
                        : "👁️"}
                    </button>

                  </div>
                </div>

              </div>

            </div>

            {/* SAVE SETTINGS */}

            <div
              style={{
                textAlign: "right",
              }}
            >

              <button
                className="save-settings-button"
                onClick={
                  handleSaveSettings
                }
              >
                Save Changes
              </button>

            </div>

          </div>
        )}

        {/* =====================================================
            HELP CENTER
        ===================================================== */}

        {activeMenu === "Help Center" && (
          <AdminHelpCenter />
        )}

      </main>

      {/* =====================================================
          LOCATION MODAL
      ===================================================== */}

      {selectedLocation && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >

          <div
            style={{
              background: "#fff",
              width: "min(900px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "15px",
              padding: "25px",
              position: "relative",
            }}
          >

            <button
              onClick={
                closeLocationModal
              }
              style={{
                position: "absolute",
                right: "15px",
                top: "15px",
                width: "35px",
                height: "35px",
                border: "none",
                borderRadius: "50%",
                background: "#f1f1f1",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ✕
            </button>

            <h2
              style={{
                color: "#1b4332",
                marginBottom: "5px",
              }}
            >
              📍 Employee Attendance Location
            </h2>

            <p
              style={{
                color: "#777",
                marginBottom: "20px",
              }}
            >
              Location recorded when the employee
              marked attendance.
            </p>

            {/* EMPLOYEE INFORMATION */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "20px",
              }}
            >

              <div
                style={{
                  background: "#f7f7f7",
                  padding: "12px",
                  borderRadius: "8px",
                }}
              >
                <small>Employee</small>

                <strong
                  style={{
                    display: "block",
                    marginTop: "5px",
                  }}
                >
                  {selectedLocation.employee
                    ?.firstName ||
                    selectedLocation.attendance
                      ?.firstName ||
                    "-"}{" "}
                  {selectedLocation.employee
                    ?.lastName ||
                    selectedLocation.attendance
                      ?.lastName ||
                    ""}
                </strong>
              </div>

              <div
                style={{
                  background: "#f7f7f7",
                  padding: "12px",
                  borderRadius: "8px",
                }}
              >
                <small>Employee ID</small>

                <strong
                  style={{
                    display: "block",
                    marginTop: "5px",
                  }}
                >
                  {selectedLocation.employee
                    ?.employeeId ||
                    selectedLocation.attendance
                      ?.employeeId ||
                    "-"}
                </strong>
              </div>

              <div
                style={{
                  background: "#f7f7f7",
                  padding: "12px",
                  borderRadius: "8px",
                }}
              >
                <small>Date</small>

                <strong
                  style={{
                    display: "block",
                    marginTop: "5px",
                  }}
                >
                  {selectedLocation.attendance
                    ?.date || "-"}
                </strong>
              </div>

            </div>

            {/* GPS INFORMATION */}

            <div
              style={{
                background: "#eef7f0",
                padding: "20px",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >

              <h3>
                📡 GPS Information
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "15px",
                }}
              >

                <div>
                  <span
                    style={{
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    Latitude
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                    }}
                  >
                    {
                      selectedLocation.latitude
                    }
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    Longitude
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                    }}
                  >
                    {
                      selectedLocation.longitude
                    }
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    Distance From School
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                    }}
                  >
                    {selectedLocation.distance !==
                      undefined &&
                    selectedLocation.distance !==
                      null
                      ? `${Number(
                          selectedLocation.distance
                        ).toFixed(
                          2
                        )} meters`
                      : "Not available"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    Location Status
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                      color:
                        selectedLocation.status ===
                        "INSIDE_SCHOOL"
                          ? "#2e7d32"
                          : selectedLocation.status ===
                            "OUTSIDE_SCHOOL"
                          ? "#c62828"
                          : "#777",
                    }}
                  >
                    {selectedLocation.status ===
                    "INSIDE_SCHOOL"
                      ? "✓ INSIDE SCHOOL"
                      : selectedLocation.status ===
                        "OUTSIDE_SCHOOL"
                      ? "✕ OUTSIDE SCHOOL"
                      : "UNKNOWN"}
                  </strong>
                </div>

              </div>

            </div>

            {/* PLACE NAME */}

            <div
              style={{
                background: "#f8f9fa",
                padding: "18px",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >

              <h3>
                📍 Place Name
              </h3>

              {locationLoading ? (
                <p
                  style={{
                    color: "#777",
                  }}
                >
                  🔄 Finding place name...
                </p>
              ) : (
                <p
                  style={{
                    margin: "5px 0 0",
                    lineHeight: "1.6",
                  }}
                >
                  {placeName ||
                    "Place name not available"}
                </p>
              )}

            </div>

            {/* MAP */}

            <div>

              <h3>
                🗺️ Attendance Map
              </h3>

              <div
                style={{
                  width: "100%",
                  height: "400px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border:
                    "1px solid #ddd",
                  marginTop: "10px",
                }}
              >

                <iframe
                  title="Employee Attendance Location"
                  src={getMapUrl(
                    selectedLocation.latitude,
                    selectedLocation.longitude
                  )}
                  width="100%"
                  height="100%"
                  style={{
                    border: "none",
                  }}
                  loading="lazy"
                ></iframe>

              </div>

            </div>

            {/* OPEN FULL MAP */}

            <div
              style={{
                marginTop: "15px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >

              <a
                href={`https://www.openstreetmap.org/?mlat=${selectedLocation.latitude}&mlon=${selectedLocation.longitude}#map=18/${selectedLocation.latitude}/${selectedLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: "#2d7d46",
                  color: "#fff",
                  textDecoration:
                    "none",
                  padding: "10px 15px",
                  borderRadius: "7px",
                  fontWeight: "bold",
                }}
              >
                🗺️ Open Full Map
              </a>

              <button
                onClick={
                  closeLocationModal
                }
                style={{
                  background: "#eee",
                  color: "#333",
                  border: "none",
                  padding: "10px 15px",
                  borderRadius: "7px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
export default AdminDashboard;