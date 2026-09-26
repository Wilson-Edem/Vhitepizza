import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./features/auth/AuthContext.jsx";
import StaffPushBridge from "./features/notifications/StaffPushBridge.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <StaffPushBridge />
      <App />
    </AuthProvider>
  </StrictMode>
);
