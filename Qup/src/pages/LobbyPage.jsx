import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket , setGlobalUsername, getGlobalUsername } from '../socket';
import './LobbyPage.css';

function LobbyPage() {
  const [parties, setParties] = useState([]);
  const [selectedParties, setSelectedParties] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [username, setUsername] = useState(getGlobalUsername());
  const [tempName, setTempName] = useState('');

  const navigate = useNavigate();

  const handleSetUsername = e => {
    e.preventDefault();
    if (!tempName.trim()) return;
    const finalName = tempName.trim();
    setUsername(finalName);
    setGlobalUsername(finalName);
  };

  const handleCreateParty = e => {
    e.preventDefault();
    if (!username) {
      alert('Set a username first.');
      return;
    }
    const form = e.target;
    const name = form.partyName.value.trim();
    const category = form.category.value;
    const maxPlayers = Number(form.maxPlayers.value);
  
    if (!name || maxPlayers < 2) return;
  
    socket.emit(
      'party:create',
      { name, category, maxPlayers },
      (response) => {
        if (!response?.ok) {
          alert(response?.message || 'Failed to create party.');
          return;
        }
      }
    );
  
    form.reset();
  };

  const handleJoinParty = partyId => {
    if (!username) {
      alert('Set a username first.');
      return;
    }

    if (selectedParties.some(p => p.id === partyId)) {
      alert('You are already in this party');
      return;
    }
  
    if (selectedParties.length >= 5) {
      alert('You can only join up to 5 parties.');
      return;
    }
  
    socket.emit('party:join', { partyId: partyId }, response => {
      if (!response?.ok) {
        alert(response.message || 'Unable to join party.');
        return;
      }
    });
  };

  const handleLeaveParty = partyId => {
    socket.emit('party:leave', { partyId }, (response) => {
      if (!response?.ok) {
        alert(response?.message || 'Unable to leave party.');
        return;
      }
    }); 
  };
  

  const filteredParties = useMemo(() => {
    return parties
      .filter(p =>
        categoryFilter === 'all' ? true : p.category === categoryFilter
      )
      .filter(p => {
        if (playerFilter === 'all') return true;
        if (playerFilter === 'almost-full') {
          return p.currentPlayers >= p.maxPlayers - 1;
        }
        if (playerFilter === 'has-space') {
          return p.currentPlayers < p.maxPlayers;
        }
        return true;
      })
      .filter(p =>
        searchId.trim() ? String(p.id).includes(searchId.trim()) : true
      );
  }, [parties, categoryFilter, playerFilter, searchId]);

  useEffect(() => {
    socket.emit('lobby:join'); 

    socket.on('lobby:snapshot', data => {
      setParties(data.parties || []);
    });

    socket.on('lobby:updateParty', updatedParty => {
      setParties(prev =>
        prev.map(p => (p.id === updatedParty.id ? updatedParty : p))
      );
    });

    socket.on('lobby:newParty', newParty => {
      setParties(prev => {
        const exists = prev.some(p => p.id === newParty.id);
        return exists ? prev : [...prev, newParty];
      });
    });
    
    socket.on('lobby:addSelected', newParty => {
      setSelectedParties(prev => {
        const exists = prev.some(p => p.id === newParty.id);
        return exists ? prev : [...prev, newParty];
      });
    });

    socket.on('lobby:removeParty', id => {
      setParties(prev => prev.filter(p => p.id !== id));
    });

    socket.on('lobby:removeSelected', partyId => {
      setSelectedParties(prev =>
        prev.filter(p => p.id !== partyId)
      );
    })

    socket.on('party:finalized', ({ partyId }) => {
      console.log(`finalized party id:${partyId}`);
      selectedParties.forEach(party => {
        if (party.id !== partyId) {
          console.log(`Leaving party: ${party.id}`);
          handleLeaveParty(party.id);  
        }
      });
      navigate(`/chat/${partyId}`);
    });

    return () => {
      socket.off('lobby:snapshot');
      socket.off('lobby:updateParty');
      socket.off('lobby:newParty');
      socket.off('lobby:removeParty');
      socket.off('party:finalized');
    };
  }, [navigate, selectedParties]);


  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>Qup Matchmaking Lobby</h1>
        <form onSubmit={handleSetUsername} className="username-form">
          <input
            type="text"
            placeholder="Enter username"
            value={tempName}
            onChange={e => setTempName(e.target.value)}
          />
          <button type="submit">
            {username ? 'Update Name' : 'Set Name'}
          </button>
        </form>
        {username && <div className="username-display">You: {username}</div>}
      </header>

      <main className="lobby-main">
        <section className="lobby-parties">
          <div className="lobby-filters">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="Overcooked 2">Overcooked 2</option>
              <option value="It Takes Two">It Takes Two</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={playerFilter}
              onChange={e => setPlayerFilter(e.target.value)}
            >
              <option value="all">All parties</option>
              <option value="has-space">Has space</option>
              <option value="almost-full">Almost full</option>
            </select>

            <input
              type="text"
              placeholder="Search by Party ID"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
            />
          </div>

          <table className="party-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Players</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredParties.map(party => (
                <tr key={party.id}>
                  <td>{party.id}</td>
                  <td>{party.name}</td>
                  <td>{party.category}</td>
                  <td>
                    {party.currentPlayers}/{party.maxPlayers}
                  </td>
                  <td>
                    <button
                      onClick={() => handleJoinParty(party.id)}
                      disabled={party.currentPlayers >= party.maxPlayers}
                    >
                      {party.currentPlayers >= party.maxPlayers
                        ? 'Full'
                        : 'Join'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>
                    No parties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <form className="create-party-form" onSubmit={handleCreateParty}>
            <h2>Create Party</h2>
            <input
              type="text"
              name="partyName"
              placeholder="Party name"
              required
            />
            <select name="category" defaultValue="Overcooked 2" required>
              <option value="Overcooked 2">Overcooked 2</option>
              <option value="It Takes Two">It Takes Two</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="number"
              name="maxPlayers"
              min="2"
              max="8"
              defaultValue="2"
              required
            />
            <button type="submit">Create</button>
          </form>
        </section>

        <aside className="selected-parties">
          <h2>Selected Parties</h2>
          {selectedParties.length === 0 && <p>No parties joined.</p>}
          {selectedParties.map(party => (
            <div key={party.id} className="party-card">
              <div>
                <strong>#{party.id}</strong> {party.name}
              </div>
              <div>{party.category}</div>
              <div>
                {party.currentPlayers}/{party.maxPlayers} players
              </div>
              <button onClick={() => handleLeaveParty(party.id)}>Leave</button>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}

export default LobbyPage;