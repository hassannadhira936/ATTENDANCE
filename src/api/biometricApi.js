import api from "./api";

export const getAllBiometrics = async () => {
  const response = await api.get("/biometrics");
  return response.data;
};

export const getEmployeeBiometrics = async (employeeId) => {
  const response = await api.get(
    `/biometrics/employee/${encodeURIComponent(employeeId)}`
  );
  return response.data;
};

export const registerBiometric = async (employeeId, biometric) => {
  const response = await api.post(
    `/biometrics/employee/${encodeURIComponent(employeeId)}`,
    biometric
  );
  return response.data;
};

export const markBiometricUsed = async (biometricId) => {
  const response = await api.patch(`/biometrics/${biometricId}/used`);
  return response.data;
};

// Removes the UI-facing mirror row only. To also revoke the real WebAuthn
// credential server-side, call removeDeviceCredential() from ./webauthn
// first (see BiometricSettings.jsx).
export const deleteBiometric = async (biometricId) => {
  await api.delete(`/biometrics/${biometricId}`);
};
