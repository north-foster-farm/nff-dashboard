import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LoginGate from "./components/LoginGate.jsx";
import "./styles.css";

// LoginGate intercepts every render — nothing below it runs until Supabase
// confirms the visitor is signed in AND their email is in the admins table.
// It uses a render-prop (rather than hooks/context) so the session is only
// handed to the app once authorization is settled; no downstream code ever
// sees a "logged-out" state.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LoginGate>
      {(session) => <App session={session} />}
    </LoginGate>
  </React.StrictMode>
);
