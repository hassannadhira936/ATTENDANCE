import api from "./api";

export const loginAdmin = async (username, password) => {
  const response = await api.post("/admins/login", {
    username,
    password,
  });

  return response.data;
};

export const updateAdmin = async (adminId, admin) => {
  const response = await api.put(`/admins/${adminId}`, admin);

  return response.data;
};

export const uploadAdminProfilePhoto = async (adminId, file) => {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post(
    `/admins/${adminId}/profile-photo`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const changeAdminPassword = async (
  adminId,
  currentPassword,
  newPassword
) => {
  const response = await api.post(`/admins/${adminId}/change-password`, {
    currentPassword,
    newPassword,
  });

  return response.data;
};