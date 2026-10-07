import { BACKEND_BASE_URL, getErrorMessage } from "./api";
import axios from "axios";
import { getEmployeeBiometrics, markBiometricUsed, registerBiometric } from "./biometricApi";
import { loginEmployee } from "./employeeApi";

/*
  BIOMETRIC VERIFICATION (REAL, SERVER-VERIFIED WEBAUTHN) WITH FALLBACK
  -----------------------------------------------------------------------
  PRIMARY  : the device's own platform authenticator - fingerprint, Face
             unlock, Windows Hello, device PIN, or phone screen-lock -
             through the browser's native WebAuthn API, verified
             CRYPTOGRAPHICALLY on the server by Spring Security WebAuthn
             (spring-security-webauthn). The server never trusts a bare
             credential id as proof of identity: every registration and
             every sign-in is checked against the stored public key,
             origin, RP ID, challenge and signature.
  FALLBACK : when the browser/device cannot do WebAuthn, or the ceremony
             is cancelled/fails, the employee may verify with the account
             password instead. The attendance row records which method
             was used (BIOMETRIC or PASSWORD).

  How it works now
  1. First time on a device: the browser asks Spring Security for real
     registration options (POST /webauthn/register/options - requires the
     employee to already have an authenticated session from the normal
     username/password login), creates a credential on the device
     (fingerprint/Face/PIN prompt), and posts the signed attestation back
     to the server (POST /webauthn/register). Spring Security verifies it
     and stores the credential's PUBLIC KEY server-side, in the
     `user_credentials` table - never a fingerprint image or template.
  2. Next times: the browser asks the server for a real authentication
     challenge (POST /webauthn/authenticate/options), the device signs it
     with the SAME private key (fingerprint/Face/PIN prompt required
     again), and the signed assertion is posted to POST /login/webauthn,
     where Spring Security verifies the cryptographic signature against
     the stored public key before accepting it.

  The `Biometric` / `/api/biometrics` table is kept ONLY as a lightweight,
  UI-facing mirror (so the dashboard can show "this device is
  registered"). It is written to AFTER a real WebAuthn ceremony already
  succeeded, and it is never treated as proof of identity by itself.
*/

// ---------- dedicated client for the root-level /webauthn and /login/webauthn endpoints ----------
// (these are NOT under /api - they are Spring Security's own endpoints)

const webauthnClient = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------- small helpers ----------

const bufferToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const base64urlToBuffer = (value) => {
  const base64 =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
};

const getEmployeeKey = (employee) =>
  String(employee?.employeeId ?? "").trim();

export const getDeviceName = () => {
  const ua = navigator.userAgent || "";

  let os = "Unknown device";

  if (/Windows/i.test(ua)) os = "Windows PC";
  else if (/Android/i.test(ua)) os = "Android phone";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iPhone/iPad";
  else if (/Mac OS X/i.test(ua)) os = "Mac";
  else if (/Linux/i.test(ua)) os = "Linux PC";

  let browser = "Browser";

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${os} - ${browser}`;
};

// ---------- capability check ----------

export const checkBiometricSupport = async () => {
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason:
        "Biometric verification needs a secure connection (HTTPS or localhost) on this device.",
    };
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    return {
      supported: false,
      reason: "This browser does not support biometric (WebAuthn) verification.",
    };
  }

  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!available) {
      return {
        supported: false,
        reason:
          "No fingerprint, Face unlock, Windows Hello or screen lock is set up on this device.",
      };
    }
  } catch {
    return {
      supported: false,
      reason: "Biometric hardware could not be detected on this device.",
    };
  }

  return { supported: true, reason: "" };
};

// ---------- decode server -> browser (base64url strings -> ArrayBuffers) ----------

const decodeCreationOptions = (options) => ({
  ...options,
  challenge: base64urlToBuffer(options.challenge),
  user: {
    ...options.user,
    id: base64urlToBuffer(options.user.id),
  },
  excludeCredentials: (options.excludeCredentials || []).map((descriptor) => ({
    ...descriptor,
    id: base64urlToBuffer(descriptor.id),
  })),
});

const decodeRequestOptions = (options) => ({
  ...options,
  challenge: base64urlToBuffer(options.challenge),
  allowCredentials: (options.allowCredentials || []).map((descriptor) => ({
    ...descriptor,
    id: base64urlToBuffer(descriptor.id),
  })),
});

// ---------- encode browser -> server (ArrayBuffers -> base64url strings) ----------

const encodeAttestationCredential = (credential) => {
  const response = credential.response;

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports:
        typeof response.getTransports === "function"
          ? response.getTransports()
          : [],
    },
  };
};

const encodeAssertionCredential = (credential) => {
  const response = credential.response;

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64url(response.userHandle)
        : null,
    },
  };
};

// ---------- real Spring Security WebAuthn ceremony ----------

/*
  Registers a brand-new platform credential for the CURRENTLY LOGGED-IN
  employee (their normal username/password session must still be active -
  Spring Security needs to know who is registering).

  1. POST /webauthn/register/options  -> server-generated challenge + RP info
  2. navigator.credentials.create()   -> triggers Windows Hello / fingerprint / etc.
  3. POST /webauthn/register          -> server verifies + stores the public key
*/
const registerRealCredential = async (employee) => {
  const { data: creationOptions } = await webauthnClient.post(
    "/webauthn/register/options",
    {}
  );

  const publicKey = decodeCreationOptions(creationOptions);

  const credential = await navigator.credentials.create({ publicKey });

  if (!credential) {
    throw new Error("Biometric registration was not completed.");
  }

  const credentialJSON = encodeAttestationCredential(credential);
  const deviceLabel = getDeviceName();

  await webauthnClient.post("/webauthn/register", {
    publicKey: {
      credential: credentialJSON,
      label: deviceLabel,
    },
  });

  // UI-only mirror so the dashboard can show enrollment status/list.
  // NOTE: the `Biometric` entity's `publicKey` column is NOT NULL and is
  // NOT used for verification anymore (the real public key, signature
  // counter, etc. already live server-side in Spring's own
  // `user_credentials` table, verified by WebAuthnRegistrationFilter
  // above). We store a fixed placeholder here purely to satisfy that
  // legacy column - it is never read back for authentication.
  await registerBiometric(getEmployeeKey(employee), {
    fingerprintId: credentialJSON.id,
    fingerName: deviceLabel,
    status: "Active",
    publicKey: "MANAGED_BY_SPRING_SECURITY_WEBAUTHN",
  }).catch((error) => {
    console.warn("Could not save biometric UI record:", error);
  });

  return credentialJSON.id;
};

/*
  Proves possession of a PREVIOUSLY REGISTERED platform credential and, on
  success, has Spring Security establish a fresh authenticated session for
  the resolved employee.

  1. POST /webauthn/authenticate/options -> server-generated challenge
     (scoped to the currently authenticated employee's own credentials,
     since their password-login session is still active)
  2. navigator.credentials.get()         -> triggers Windows Hello / fingerprint / etc.
  3. POST /login/webauthn                -> server verifies the signature
     against the stored public key
*/
const authenticateRealCredential = async () => {
  const { data: requestOptions } = await webauthnClient.post(
    "/webauthn/authenticate/options",
    {}
  );

  const publicKey = decodeRequestOptions(requestOptions);

  const assertion = await navigator.credentials.get({ publicKey });

  if (!assertion) {
    throw new Error("Biometric verification was not completed.");
  }

  const assertionJSON = encodeAssertionCredential(assertion);

  await webauthnClient.post("/login/webauthn", assertionJSON);

  return assertionJSON.id;
};

/*
  Public entry point for the "Register this device" button in the
  employee Settings page. Requires the employee to already be logged in
  (normal username/password session). Throws a humanized Error on
  failure/cancellation so the caller can show it directly.
*/
export const registerDeviceCredential = async (employee) => {
  try {
    return await registerRealCredential(employee);
  } catch (error) {
    console.warn("Manual device registration failed:", error);
    throw new Error(humanizeWebAuthnError(error));
  }
};

/*
  Public entry point for the "Remove this device" button in Settings.
  Deletes the REAL credential server-side (DELETE /webauthn/register/{id}
  - Spring Security only allows the credential's own owner to do this) so
  the device can no longer be used to sign in or verify attendance. This
  does not touch the UI-only `Biometric` mirror row - the caller should
  remove that separately (see biometricApi.deleteBiometric).
*/
export const removeDeviceCredential = async (credentialId) => {
  await webauthnClient.delete(
    `/webauthn/register/${encodeURIComponent(credentialId)}`
  );
};

const humanizeWebAuthnError = (error) => {
  if (error?.name === "NotAllowedError") {
    return `Biometric verification was cancelled, timed out, or was denied on this device. [Technical: ${error.name} - ${error.message}] [Page: ${window.location.origin}]`;
  }

  if (error?.name === "InvalidStateError") {
    return "This device already has a biometric credential registered for this account.";
  }

  if (error?.name === "SecurityError") {
    return `Biometric sign-in is not allowed from this page address. [Technical: ${error.name} - ${error.message}] [Page: ${window.location.origin}]`;
  }

  if (error?.response) {
    return getErrorMessage(
      error,
      "The server could not verify your biometric credential."
    );
  }

  return (
    error?.message ||
    "Fingerprint / biometric verification failed, was cancelled, or this device is not registered yet."
  );
};

// ---------- password fallback ----------

const passwordFallback = async (employee, reason, canEnrollAfter) => {
  const wantsFallback = window.confirm(
    `${reason}\n\nDo you want to verify with your account password instead?`
  );

  if (!wantsFallback) {
    return {
      verified: false,
      cancelled: true,
      message: "Verification cancelled. Attendance has NOT been recorded.",
    };
  }

  const password = window.prompt(
    "Enter your account password to verify your identity:"
  );

  if (password === null || password === "") {
    return {
      verified: false,
      cancelled: true,
      message: "Verification cancelled. Attendance has NOT been recorded.",
    };
  }

  try {
    const loggedIn = await loginEmployee(
      employee?.username || getEmployeeKey(employee),
      password
    );

    if (
      String(loggedIn?.employeeId || "").toUpperCase() !==
      getEmployeeKey(employee).toUpperCase()
    ) {
      return {
        verified: false,
        message: "Password verification failed. Attendance has NOT been recorded.",
      };
    }
  } catch (error) {
    return {
      verified: false,
      message:
        error?.response?.data?.message ||
        "Password verification failed. Attendance has NOT been recorded.",
    };
  }

  // Password OK (and the login above also refreshed the employee's
  // session). Offer to register this device's real WebAuthn credential so
  // biometrics work next time.
  if (canEnrollAfter) {
    const enroll = window.confirm(
      "Password verified.\n\nDo you want to register this device's fingerprint / Face / PIN for faster sign-in next time?"
    );

    if (enroll) {
      try {
        await registerRealCredential(employee);
      } catch (error) {
        console.warn("Device registration skipped:", error);
      }
    }
  }

  return { verified: true, method: "PASSWORD" };
};

// ---------- MAIN ENTRY ----------

/*
  Returns:
    { verified: true,  method: "BIOMETRIC" | "PASSWORD" }
    { verified: false, message, cancelled? }
*/
export const verifyIdentity = async (employee) => {
  const employeeId = getEmployeeKey(employee);

  const support = await checkBiometricSupport();

  if (!support.supported) {
    return passwordFallback(employee, support.reason, false);
  }

  let registered = [];

  try {
    const biometrics = await getEmployeeBiometrics(employeeId);

    registered = (Array.isArray(biometrics) ? biometrics : []).filter(
      (item) => item.fingerprintId && item.status !== "Inactive"
    );
  } catch (error) {
    console.warn("Could not load biometric enrollment status:", error);
  }

  try {
    // First real biometric use for this employee: register this device
    // with the server (creating the credential already required a
    // fingerprint/Face/PIN prompt, and the server has already verified
    // and stored the public key by the time this call returns).
    if (registered.length === 0) {
      await registerRealCredential(employee);

      return { verified: true, method: "BIOMETRIC" };
    }

    const usedCredentialId = await authenticateRealCredential();

    const matched = registered.find(
      (item) => item.fingerprintId === usedCredentialId
    );

    if (matched) {
      markBiometricUsed(matched.biometricId).catch(() => {});
    }

    return { verified: true, method: "BIOMETRIC" };
  } catch (error) {
    console.warn("Biometric verification failed:", error);

    return passwordFallback(employee, humanizeWebAuthnError(error), true);
  }
};
