import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LobbyPage from './pages/LobbyPage';
import ChatroomPage from './pages/ChatroomPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/chat/:partyId" element={<ChatroomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
