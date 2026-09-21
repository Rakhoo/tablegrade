import { StrictMode } from "react";
import { Outlet } from "react-router";
import "./App.css";

function App() {
  return (
    <StrictMode>
      <div className="app-container bg-purple-100">
        <Outlet />
      </div>
    </StrictMode>
  );
}

export default App;
