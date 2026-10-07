import api from "./api";

/*
  method = "BIOMETRIC" (fingerprint / Face / Windows Hello)
        or "PASSWORD"  (fallback when the device has no WebAuthn)
  employeeId is always the STRING Employee ID (e.g. "EMP004").
*/

// ===============================
// CHECK-IN
// ===============================
export const checkIn = async (
  employeeId,
  latitude,
  longitude,
  method = "BIOMETRIC"
) => {
  const response = await api.post("/attendance/check-in", null, {
    params: {
      employeeId,
      latitude,
      longitude,
      method,
    },
  });

  return response.data;
};

// ===============================
// CHECK-OUT
// ===============================
export const checkOut = async (
  employeeId,
  latitude,
  longitude,
  method = "BIOMETRIC"
) => {
  const response = await api.post("/attendance/check-out", null, {
    params: {
      employeeId,
      latitude,
      longitude,
      method,
    },
  });

  return response.data;
};

// ===============================
// GET EMPLOYEE ATTENDANCE
// ===============================
export const getEmployeeAttendance = async (employeeId) => {
  const response = await api.get(
    `/attendance/employee/${encodeURIComponent(employeeId)}`
  );
  return response.data;
};

// ===============================
// GET EMPLOYEE ATTENDANCE SUMMARY
// ===============================
export const getEmployeeSummary = async (employeeId) => {
  const response = await api.get(
    `/attendance/employee/${encodeURIComponent(employeeId)}/summary`
  );

  return response.data;
};

// ===============================
// GET WEEKLY ATTENDANCE
// ===============================
export const getWeeklyAttendance = async (
  employeeId,
  startDate,
  endDate
) => {
  const response = await api.get(
    `/attendance/employee/${encodeURIComponent(employeeId)}/weekly`,
    {
      params: {
        startDate,
        endDate,
      },
    }
  );

  return response.data;
};

// ===============================
// ADMIN: ALL ATTENDANCE RECORDS
// ===============================
export const getAllAttendanceForAdmin = async () => {
  const response = await api.get("/attendance/admin");
  return response.data;
};
