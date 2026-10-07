
import React, { useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Navigate,
} from "react-router-dom";

import "./App.css";
import Dashboard from "./Dashboard";
import AdminDashboard from "./AdminDashboard";
import { loginEmployee } from "./api/employeeApi";
import { loginAdmin } from "./api/adminApi";
import { getErrorMessage } from "./api/api";
import { saveSession, getSession, clearSession } from "./api/session";


/* =========================
   SCHOOL LOGO
========================= */

function Logo() {
  return (
    <div className="school-header">

      <img
        src="/LOGO.JPG"
        alt="Alihsan Girls Secondary School Logo"
        className="school-logo"
      />

      <div className="school-name">

        <h1>AL-IHSAN GIRLS</h1>

        <h2>SECONDARY SCHOOL</h2>

      </div>

    </div>
  );
}


/* =========================
   HOME / ROLE SELECTION
========================= */

function RoleSelection() {

  const navigate = useNavigate();

  return (

    <div className="page">

      <div className="role-card">

        <Logo />

        <div className="welcome">

          <h1>
            Biometric Attendance System
          </h1>

          <p>
            Welcome to Alihsan Girls Secondary School
          </p>

          <p className="instruction">
            Please select your role to continue
          </p>

        </div>


        <div className="role-buttons">

          {/* =========================
              EMPLOYEE
          ========================= */}

          <button
            className="role-button employee"
            onClick={() =>
              navigate("/employee-login")
            }
          >

            <span className="role-icon">
              👩‍💼
            </span>

            <div>

              <strong>
                Employee
              </strong>

              <small>
                Employee attendance & account
              </small>

            </div>

          </button>


          {/* =========================
              ADMINISTRATOR
          ========================= */}

          <button
            className="role-button administrator"
            onClick={() =>
              navigate("/admin/login")
            }
          >

            <span className="role-icon">
              👩‍💻
            </span>

            <div>

              <strong>
                Administrator
              </strong>

              <small>
                Manage employees & attendance
              </small>

            </div>

          </button>

        </div>


        <footer>
          © 2026 Alihsan Girls Secondary School
        </footer>

      </div>

    </div>
  );
}


/* =========================
   EMPLOYEE LOGIN
========================= */

function EmployeeLogin() {

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* PASSWORD SHOW / HIDE */
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async (e) => {

    e.preventDefault();

    if (!username.trim() || !password) {

      alert(
        "Please enter username and password."
      );

      return;
    }

    try {

      /*
        The backend checks the Employee ID (e.g. EMP004) or username
        and the password against MySQL, and rejects inactive accounts.
      */
      const employee = await loginEmployee(
        username.trim(),
        password
      );

      saveSession("employee", employee);

      navigate("/employee-dashboard");

    } catch (error) {

      console.error("Employee login error:", error);

      alert(
        getErrorMessage(
          error,
          "Login failed. Employee ID/Username or password is not recognized."
        )
      );
    }
  };


  return (

    <div className="page">

      <div className="auth-card">

        <Logo />

        <h1>
          Employee Login
        </h1>

        <p className="auth-subtitle">
          Login to access your attendance system
        </p>


        <form onSubmit={handleLogin}>

          <label>
            Employee ID / Username
          </label>

          <input
            type="text"
            placeholder="Enter employee ID"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
          />


          <label>
            Password
          </label>

          {/* PASSWORD WITH EYE */}
          <div
            style={{
              position: "relative",
              width: "100%",
            }}
          >

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              style={{
                width: "100%",
                paddingRight: "45px",
                boxSizing: "border-box",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "20px",
                padding: "4px",
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>

          </div>


          <button
            type="submit"
            className="primary-button"
          >
            Login
          </button>

        </form>


        <button
          className="back-button"
          onClick={() =>
            navigate("/")
          }
        >
          ← Back to Role Selection
        </button>

      </div>

    </div>
  );
}


/* =========================
   ADMIN LOGIN
========================= */

function AdminLogin() {

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* PASSWORD SHOW / HIDE */
  const [showPassword, setShowPassword] = useState(false);


const handleLogin = async (e) => {

  e.preventDefault();

  if (!username.trim() || !password) {

    alert(
      "Please enter administrator credentials."
    );

    return;
  }

  try {

    /*
      Backend checks the administrator in MySQL and returns the
      real administrator record (adminId, fullName, email ...).
    */
    const admin = await loginAdmin(
      username.trim(),
      password
    );

    saveSession("admin", admin);

    navigate("/admin/dashboard");

  } catch (error) {

    console.error(
      "Admin login error:",
      error
    );

    alert(
      getErrorMessage(
        error,
        "Login failed. Username or password is not recognized."
      )
    );
  }
};


  return (

    <div className="page">

      <div className="auth-card">

        <Logo />

        <h1>
          Administrator Login
        </h1>

        <p className="auth-subtitle">
          Login to manage the attendance system
        </p>


        <form onSubmit={handleLogin}>

          <label>
            Administrator Username
          </label>

          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
          />


          <label>
            Password
          </label>

          {/* PASSWORD WITH EYE */}
          <div
            style={{
              position: "relative",
              width: "100%",
            }}
          >

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              style={{
                width: "100%",
                paddingRight: "45px",
                boxSizing: "border-box",
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "20px",
                padding: "4px",
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>

          </div>


          <button
            type="submit"
            className="primary-button"
          >
            Login as Administrator
          </button>

        </form>


        <button
          className="back-button"
          onClick={() =>
            navigate("/")
          }
        >
          ← Back to Role Selection
        </button>

      </div>

    </div>
  );
}


/* =========================
   PROTECTED EMPLOYEE DASHBOARD
========================= */

function EmployeeDashboardPage() {

  const navigate = useNavigate();

  const employee = getSession("employee");

  /*
    Protect the employee dashboard: no valid session = back to login.
  */
  if (!employee) {

    return (
      <Navigate
        to="/employee-login"
        replace
      />
    );
  }

  return (

    <Dashboard
      employee={employee}
      onLogout={() => {

        clearSession("employee");

        navigate("/", { replace: true });

      }}
    />

  );
}


/* =========================
   PROTECTED ADMIN DASHBOARD
========================= */

function AdminDashboardPage() {

  /*
    Get administrator information
    from the current session.
  */

  const admin = getSession("admin");


  /*
    Protect administrator dashboard.
  */

  if (!admin) {

    return (

      <Navigate
        to="/admin/login"
        replace
      />

    );
  }


  return (

    <AdminDashboard
      admin={admin}
    />

  );
}


/* =========================
   APP ROUTES
========================= */

function App() {

  return (

    <Routes>


      {/* =========================
          ROLE SELECTION
      ========================= */}

      <Route
        path="/"
        element={
          <RoleSelection />
        }
      />


      {/* =========================
          EMPLOYEE LOGIN
      ========================= */}

      <Route
        path="/employee-login"
        element={
          <EmployeeLogin />
        }
      />


      {/* =========================
          EMPLOYEE DASHBOARD
      ========================= */}

      <Route
        path="/employee-dashboard"
        element={

          <EmployeeDashboardPage />

        }
      />


      {/* =========================
          ADMINISTRATOR LOGIN
      ========================= */}

      <Route
        path="/admin/login"
        element={
          <AdminLogin />
        }
      />


      {/* =========================
          ADMINISTRATOR DASHBOARD
      ========================= */}

      <Route
        path="/admin/dashboard"
        element={
          <AdminDashboardPage />
        }
      />


      {/* =========================
          UNKNOWN ROUTE
      ========================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>

  );
}


export default App;