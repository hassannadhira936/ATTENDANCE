import React, { useCallback, useEffect, useState } from "react";
import {
  checkBiometricSupport,
  registerDeviceCredential,
  removeDeviceCredential,
} from "./api/webauthn";
import {
  getEmployeeBiometrics,
  deleteBiometric,
} from "./api/biometricApi";

/*
  Employee Settings -> "Biometric sign-in" section.

  Lets the employee explicitly register THIS device's fingerprint / Face
  unlock / Windows Hello / screen lock for faster, passwordless
  verification during attendance check-in/check-out, and see + remove the
  devices they have already registered.

  Every "Register" click here goes through the REAL Spring Security
  WebAuthn ceremony (server-issued challenge, navigator.credentials.create,
  server-side cryptographic verification) - exactly the same flow used
  automatically the first time someone verifies via biometric on the
  attendance screen. This page just lets them do it proactively, and
  manage it, instead of only discovering it during check-in.
*/
function BiometricSettings({ employee }) {
  const employeeId = String(employee?.employeeId ?? "").trim();

  const [supported, setSupported] = useState(true);
  const [supportReason, setSupportReason] = useState("");

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const loadDevices = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const list = await getEmployeeBiometrics(employeeId);

      setDevices(
        (Array.isArray(list) ? list : []).filter(
          (item) => item.status !== "Inactive"
        )
      );
    } catch (error) {
      console.error("Could not load registered devices:", error);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    checkBiometricSupport().then((result) => {
      if (cancelled) return;
      setSupported(result.supported);
      setSupportReason(result.reason);
    });

    loadDevices();

    return () => {
      cancelled = true;
    };
  }, [loadDevices]);

  const handleRegister = async () => {
    if (!employeeId) {
      alert("Employee information is not available.");
      return;
    }

    try {
      setRegistering(true);

      await registerDeviceCredential(employee);

      alert(
        "This device's fingerprint / Face / Windows Hello has been registered. You can now use it to verify attendance on this device."
      );

      await loadDevices();
    } catch (error) {
      console.error("Device registration failed:", error);

      alert(
        error?.message ||
          "Biometric registration failed or was cancelled."
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (device) => {
    const label = device.fingerName || "this device";

    if (
      !window.confirm(
        `Remove "${label}" from biometric sign-in? You will need to register it again to use biometrics on that device.`
      )
    ) {
      return;
    }

    try {
      setRemovingId(device.biometricId);

      if (device.fingerprintId) {
        // Revoke the REAL credential server-side first. If it is already
        // gone (e.g. removed some other way), we still continue and clear
        // the UI row below so the list does not get stuck.
        await removeDeviceCredential(device.fingerprintId).catch(
          (error) => {
            console.warn(
              "Could not remove server-side credential:",
              error
            );
          }
        );
      }

      await deleteBiometric(device.biometricId);

      await loadDevices();
    } catch (error) {
      console.error("Could not remove device:", error);
      alert("Could not remove this device. Please try again.");
    } finally {
      setRemovingId(null);
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
        marginTop: "20px",
      }}
    >
      <h2>Biometric Sign-in</h2>

      <p style={{ color: "#666", marginBottom: "20px" }}>
        Register this device's fingerprint, Face unlock, Windows Hello or
        screen lock so you can verify your identity quickly when marking
        attendance, without typing your password every time. Your
        fingerprint image is never stored - only a cryptographic key that
        stays on this device.
      </p>

      {!supported && (
        <div
          style={{
            background: "#fff3cd",
            color: "#856404",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "20px",
          }}
        >
          {supportReason}
        </div>
      )}

      <button
        type="button"
        onClick={handleRegister}
        disabled={!supported || registering}
        style={{
          background: !supported ? "#aaa" : "#123b2a",
          color: "#fff",
          border: "none",
          padding: "12px 20px",
          borderRadius: "6px",
          cursor: !supported ? "not-allowed" : "pointer",
          fontWeight: "bold",
          marginBottom: "25px",
        }}
      >
        {registering
          ? "Registering..."
          : "🔐 Register this device"}
      </button>

      <h3 style={{ marginBottom: "10px" }}>Registered devices</h3>

      {loading ? (
        <p style={{ color: "#666" }}>Loading...</p>
      ) : devices.length === 0 ? (
        <p style={{ color: "#666" }}>
          No devices registered yet on this account.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {devices.map((device) => (
            <li
              key={device.biometricId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                border: "1px solid #eee",
                borderRadius: "6px",
                marginBottom: "10px",
              }}
            >
              <strong>{device.fingerName || "Device"}</strong>

              <button
                type="button"
                onClick={() => handleRemove(device)}
                disabled={removingId === device.biometricId}
                style={{
                  background: "transparent",
                  color: "#b00020",
                  border: "1px solid #b00020",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                {removingId === device.biometricId
                  ? "Removing..."
                  : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BiometricSettings;
