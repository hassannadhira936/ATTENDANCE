import React, { useState } from "react";
import { changeEmployeePassword } from "./api/employeeApi";
import { getErrorMessage } from "./api/api";

function ChangePassword({ employee }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      alert("Please enter your current password.");
      return;
    }

    if (!newPassword) {
      alert("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const employeeId = String(employee?.employeeId ?? "").trim();

    if (!employeeId) {
      alert("Employee information is not available.");
      return;
    }

    try {
      setSaving(true);

      // The server checks the current password and saves the new one in MySQL
      await changeEmployeePassword(
        employeeId,
        currentPassword,
        newPassword
      );

      alert("Password changed successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Change password error:", error);

      alert(getErrorMessage(error, "Password could not be changed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: "25px",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        maxWidth: "700px",
      }}
    >
      <h2>Change Password</h2>

      <p
        style={{
          color: "#666",
          marginBottom: "25px",
        }}
      >
        Update your account password.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Current Password */}

        <div style={{ marginBottom: "20px" }}>
          <label>
            Current Password
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ccc",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <input
              type={
                showCurrent ? "text" : "password"
              }
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)
              }
              placeholder="Enter current password"
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowCurrent(!showCurrent)
              }
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "12px",
              }}
            >
              {showCurrent ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* New Password */}

        <div style={{ marginBottom: "20px" }}>
          <label>
            New Password
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ccc",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <input
              type={
                showNew ? "text" : "password"
              }
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              placeholder="Enter new password"
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowNew(!showNew)
              }
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "12px",
              }}
            >
              {showNew ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* Confirm Password */}

        <div style={{ marginBottom: "25px" }}>
          <label>
            Confirm Password
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ccc",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <input
              type={
                showConfirm ? "text" : "password"
              }
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Confirm new password"
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirm(!showConfirm)
              }
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "12px",
              }}
            >
              {showConfirm ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            background: "#123b2a",
            color: "#fff",
            border: "none",
            padding: "12px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Update Password
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;