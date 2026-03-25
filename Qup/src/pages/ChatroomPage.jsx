import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket, getGlobalUsername } from '../socket';
import './ChatroomPage.css';

function ChatroomPage() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const [partyInfo, setPartyInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const username = getGlobalUsername();
  const bottomRef = useRef(null);

  useEffect(() => {
    socket.emit('chat:join', { partyId });

    const handleChatInfo = (info) => {
      setPartyInfo(info.party || null);
      setMessages(info.history || []);
    };

    const handleChatMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    const handleChatClosed = () => {
      alert('Party closed.');
      navigate('/');
    };

    socket.on('chat:info', handleChatInfo);
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:closed', handleChatClosed);

    return () => {
      socket.off('chat:info', handleChatInfo);
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:closed', handleChatClosed);
    };
  }, [partyId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('chat:send', { partyId, content: input.trim() });
    setInput('');
  };


  const handleLeaveParty = () => {
    socket.emit('chat:leave', { partyId, username });
    navigate('/');
  };

  return (
    <div className="chatroom-container">
      <header className="chatroom-header">
        <h1>Party Chatroom</h1>
        <button onClick={handleLeaveParty}>Leave party</button>
      </header>

      <div className="party-info-bar">
        <div className="party-name">
          {partyInfo ? partyInfo.name : 'Loading...'}
        </div>
        {partyInfo && (
          <div className="party-meta">
            <span>{partyInfo.category}</span>
            <span>
              ({partyInfo.currentPlayers}/{partyInfo.maxPlayers}) members
            </span>
          </div>
        )}
      </div>

      <main className="chatroom-main">
        <div className="chat-messages">
          {messages.map((m, idx) => {
            if (m.type === 'system') {
              return (
                <div key={idx} className="chat-message system-message">
                  {m.content}
                </div>
              );
            }
            else {
              return (
                <div key={idx} className="chat-message">
                  <span className="chat-sender">{m.sender}:</span>{' '}
                  <span className="chat-content">{m.content}</span>
                </div>
              );
            }
          })}
          {/* {messages.map((m, idx) => (
            <div key={idx} className="chat-message">
              <span className="chat-sender">{m.sender}:</span>{' '}
              <span className="chat-content">{m.content}</span>
            </div>
          ))} */}
          <div ref={bottomRef} />
        </div>

        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}

export default ChatroomPage;
