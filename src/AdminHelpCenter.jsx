import React from "react";
import "./HelpCenter.css";

function HelpCenter() {
  return (
    <div className="help-container">
      <h2>Employee Help Center</h2>

      <p className="help-intro">
        Welcome to the Employee Attendance Management System Help Center.
        This guide explains the important functions available on the
        employee side of the system and how to use them correctly.
      </p>

      {/* LOGIN */}
      <div className="help-card">
        <h3>🔐 Employee Login</h3>

        <p>
          The employee must have a registered account before using the
          employee side of the system.
        </p>

        <ol>
          <li>Open the Employee Login page.</li>
          <li>Enter your registered username.</li>
          <li>Enter your password.</li>
          <li>Click Login.</li>
        </ol>

        <p>
          If the account has not been registered or the account information
          is incorrect, login will not be successful.
        </p>
      </div>

      {/* DASHBOARD */}
      <div className="help-card">
        <h3>🏠 Employee Dashboard</h3>

        <p>
          The Employee Dashboard is the main page after successful login.
          It provides access to attendance functions, reports, settings and
          other employee services.
        </p>

        <ul>
          <li>View your employee profile information.</li>
          <li>Access Mark Attendance.</li>
          <li>Access Attendance Report.</li>
          <li>Access Settings.</li>
          <li>Access Help Center.</li>
          <li>Logout from the system.</li>
        </ul>
      </div>

      {/* PROFILE */}
      <div className="help-card">
        <h3>👤 Employee Profile</h3>

        <p>
          The profile area displays the employee information registered in
          the system.
        </p>

        <ul>
          <li>Employee name.</li>
          <li>Email address.</li>
          <li>Contact information.</li>
          <li>Department.</li>
          <li>Position.</li>
          <li>Profile picture when available.</li>
        </ul>

        <p>
          If any important employee information is incorrect, contact the
          administrator responsible for managing employee records.
        </p>
      </div>

      {/* PROFILE PHOTO */}
      <div className="help-card">
        <h3>📷 Profile Picture</h3>

        <p>
          The employee profile area may allow a profile picture to be
          displayed or uploaded depending on the current system configuration.
        </p>

        <ul>
          <li>Select the profile picture option when available.</li>
          <li>Select the required image from the device.</li>
          <li>Check that the correct image is displayed.</li>
        </ul>
      </div>

      {/* MARK ATTENDANCE */}
      <div className="help-card">
        <h3>🕐 How to Mark Attendance</h3>

        <p>
          Employees must record their attendance when arriving at work and
          before leaving work.
        </p>

        <ol>
          <li>Open the Mark Attendance menu.</li>
          <li>Make sure you are ready to verify your attendance.</li>
          <li>Complete the required biometric verification.</li>
          <li>Allow location access when requested.</li>
          <li>Complete the Sign In process when arriving.</li>
          <li>Complete the Sign Out process before leaving.</li>
        </ol>

        <p>
          The system records the attendance information associated with your
          employee account.
        </p>
      </div>

      {/* BIOMETRIC */}
      <div className="help-card">
        <h3>🖐️ Biometric / Fingerprint Verification</h3>

        <p>
          Biometric verification is used to help confirm the identity of the
          employee during attendance marking when biometric functionality is
          available.
        </p>

        <ul>
          <li>Follow the fingerprint scanner instructions.</li>
          <li>Place the required finger correctly on the scanner.</li>
          <li>Keep the finger in the correct position until scanning finishes.</li>
          <li>Wait for the verification result.</li>
        </ul>

        <p>
          If the fingerprint cannot be recognized, reposition the finger and
          try again. If the problem continues, contact the administrator or
          technical support.
        </p>
      </div>

      {/* LOCATION */}
      <div className="help-card">
        <h3>📍 Location Verification</h3>

        <p>
          The attendance system can use the device's location to determine
          where attendance is being recorded.
        </p>

        <ul>
          <li>Allow the browser to access your location.</li>
          <li>Make sure location services are enabled.</li>
          <li>Remain within the permitted attendance area when required.</li>
          <li>Wait for the system to complete location verification.</li>
        </ul>

        <p>
          The location information can be associated with the attendance
          record and can be viewed by the administrator.
        </p>
      </div>

      {/* SIGN IN */}
      <div className="help-card">
        <h3>🟢 Sign In</h3>

        <p>
          Sign In records the employee's arrival at work.
        </p>

        <ol>
          <li>Open Mark Attendance.</li>
          <li>Complete the required identity verification.</li>
          <li>Complete location verification when requested.</li>
          <li>Confirm the Sign In action.</li>
          <li>Check that the attendance has been successfully recorded.</li>
        </ol>

        <p>
          The system records the arrival time automatically when the
          attendance action is successfully completed.
        </p>
      </div>

      {/* SIGN OUT */}
      <div className="help-card">
        <h3>🔴 Sign Out</h3>

        <p>
          Sign Out records the employee's departure from work.
        </p>

        <ol>
          <li>Open Mark Attendance before leaving work.</li>
          <li>Complete the required verification.</li>
          <li>Confirm the Sign Out action.</li>
          <li>Check that the sign-out time has been recorded.</li>
        </ol>

        <p>
          Once the attendance process has been completed for the day, avoid
          repeating the same attendance action unnecessarily.
        </p>
      </div>

      {/* ATTENDANCE STATUS */}
      <div className="help-card">
        <h3>📌 Attendance Status</h3>

        <p>
          The attendance system uses attendance information to determine the
          employee's attendance status.
        </p>

        <ul>
          <li>
            <strong>Present:</strong> Attendance has been successfully recorded
            within the expected working time.
          </li>

          <li>
            <strong>Late:</strong> Attendance has been recorded after the
            official arrival time.
          </li>

          <li>
            <strong>Absent:</strong> No attendance record has been recorded
            for the relevant attendance period.
          </li>
        </ul>
      </div>

      {/* ATTENDANCE REPORT */}
      <div className="help-card">
        <h3>📊 Attendance Report</h3>

        <p>
          The Attendance Report allows an employee to review their attendance
          information.
        </p>

        <ul>
          <li>View attendance history.</li>
          <li>View sign-in times.</li>
          <li>View sign-out times.</li>
          <li>Review attendance status.</li>
          <li>Review attendance performance information.</li>
        </ul>
      </div>

      {/* WEEKLY HOURS */}
      <div className="help-card">
        <h3>📈 Weekly Attendance / Hours Chart</h3>

        <p>
          The weekly chart provides a visual representation of attendance
          information during the working week.
        </p>

        <ul>
          <li>Review attendance activity for different working days.</li>
          <li>Use the chart to understand weekly attendance patterns.</li>
          <li>Review the recorded working hours when available.</li>
        </ul>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="help-card">
        <h3>🔑 Change Password</h3>

        <p>
          Employees can change their password through the password settings
          available in the system.
        </p>

        <ol>
          <li>Open the Settings section.</li>
          <li>Open the Change Password option.</li>
          <li>Enter your current password.</li>
          <li>Enter the new password.</li>
          <li>Confirm the new password.</li>
          <li>Save the password change.</li>
        </ol>

        <p>
          Use a strong password and never share your password with another
          person.
        </p>
      </div>

      {/* FORGOT PASSWORD */}
      <div className="help-card">
        <h3>🔄 Forgot Password / Password Reset</h3>

        <p>
          If you cannot remember your password, use the password reset option
          available on the employee login page when it is provided.
        </p>

        <ul>
          <li>Open the Employee Login page.</li>
          <li>Select the Forgot Password option.</li>
          <li>Provide the requested employee information.</li>
          <li>Follow the password reset instructions.</li>
        </ul>

        <p>
          If the password cannot be reset, contact the administrator for
          assistance.
        </p>
      </div>

      {/* COMMON ISSUES */}
      <div className="help-card">
        <h3>🛠️ Common Problems and Solutions</h3>

        <p><strong>Cannot login?</strong></p>

        <ul>
          <li>Check your username.</li>
          <li>Check your password.</li>
          <li>Make sure your employee account is registered.</li>
          <li>Contact the administrator if your account is inactive.</li>
        </ul>

        <p><strong>Cannot mark attendance?</strong></p>

        <ul>
          <li>Check your internet connection.</li>
          <li>Make sure the required permissions are allowed.</li>
          <li>Check that location services are enabled.</li>
          <li>Try the attendance process again.</li>
          <li>Contact the administrator if the problem continues.</li>
        </ul>

        <p><strong>Fingerprint is not recognized?</strong></p>

        <ul>
          <li>Place the finger correctly on the scanner.</li>
          <li>Keep the finger steady during scanning.</li>
          <li>Try scanning again.</li>
          <li>Contact the administrator if the problem continues.</li>
        </ul>

        <p><strong>Location is not detected?</strong></p>

        <ul>
          <li>Turn on location services.</li>
          <li>Allow location permission in the browser.</li>
          <li>Check the internet connection.</li>
          <li>Try the attendance process again.</li>
        </ul>

        <p><strong>Attendance record is not showing?</strong></p>

        <ul>
          <li>Refresh the page.</li>
          <li>Open the Attendance Report again.</li>
          <li>Confirm that attendance was successfully recorded.</li>
          <li>Contact the administrator if the record is still missing.</li>
        </ul>
      </div>

      {/* SECURITY */}
      <div className="help-card">
        <h3>🔒 Account Security</h3>

        <ul>
          <li>Keep your username and password private.</li>
          <li>Do not share your password with other employees.</li>
          <li>Do not leave your account open on an unattended computer.</li>
          <li>Always logout after finishing your work.</li>
        </ul>
      </div>

      {/* LOGOUT */}
      <div className="help-card">
        <h3>🚪 Logout</h3>

        <p>
          Logout should be used when you finish using the employee side of
          the system.
        </p>

        <ol>
          <li>Finish your required activities.</li>
          <li>Select Logout from the system menu.</li>
          <li>The system will return you to the login page.</li>
        </ol>
      </div>

      {/* CONTACT ADMIN */}
      <div className="help-card">
        <h3>📞 Contact Administrator</h3>

        <p>
          If you experience a problem that cannot be solved using this Help
          Center, contact the system administrator or the technical person
          responsible for the attendance system.
        </p>

        <p>
          When reporting a problem, explain the page you were using and what
          happened so that the problem can be investigated more easily.
        </p>
      </div>
    </div>
  );
}

export default HelpCenter;