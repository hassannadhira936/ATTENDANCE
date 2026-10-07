import api from "./api";

/*
  Employee ID is a STRING everywhere (e.g. "EMP004").
  It is sent as-is in the URL / JSON - never converted to a number.
*/

export const getEmployees = async () => {
  const response = await api.get("/employees");
  return response.data;
};

export const getEmployee = async (employeeId) => {
  const response = await api.get(
    `/employees/${encodeURIComponent(employeeId)}`
  );
  return response.data;
};

export const createEmployee = async (employee) => {
  const response = await api.post("/employees", employee);
  return response.data;
};

export const updateEmployee = async (employeeId, employee) => {
  const response = await api.put(
    `/employees/${encodeURIComponent(employeeId)}`,
    employee
  );
  return response.data;
};

export const updateEmployeeStatus = async (employeeId, status) => {
  const response = await api.patch(
    `/employees/${encodeURIComponent(employeeId)}/status`,
    { status }
  );
  return response.data;
};

export const deleteEmployee = async (employeeId) => {
  await api.delete(`/employees/${encodeURIComponent(employeeId)}`);
};

// identifier = Employee ID OR username
export const loginEmployee = async (identifier, password) => {
  const response = await api.post("/employees/login", {
    username: identifier,
    password,
  });
  return response.data;
};

export const changeEmployeePassword = async (
  employeeId,
  currentPassword,
  newPassword
) => {
  const response = await api.post(
    `/employees/${encodeURIComponent(employeeId)}/change-password`,
    { currentPassword, newPassword }
  );
  return response.data;
};

export const uploadEmployeeProfilePhoto = async (
  employeeId,
  photoFile
) => {
  const formData = new FormData();

  formData.append("photo", photoFile);

  const response = await api.post(
    `/employees/${encodeURIComponent(employeeId)}/profile-photo`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};