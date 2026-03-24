import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import LobbyPage from "./pages/LobbyPage.jsx";
import ChatroomPage from "./pages/ChatroomPage.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/chat/:partyId" element={<ChatroomPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
