import api from "./api";

// The school's single settings row. Returns null when none exists yet.
export const getCurrentSettings = async () => {
  const response = await api.get("/settings/current");
  return response.status === 204 || !response.data ? null : response.data;
};

// Create the row the first time, update it afterwards.
export const saveSettings = async (settingId, settings) => {
  const response = settingId
    ? await api.put(`/settings/${settingId}`, settings)
    : await api.post("/settings", settings);

  return response.data;
};
