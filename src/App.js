import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import './App.css'; // <--- IMPORT THE CSS HERE

function App() {
  // --- STATE MANAGEMENT ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('julu_api_key') || "");
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('julu_chats');
    return saved ? JSON.parse(saved) : [{ id: 1, title: "New Chat", messages: [] }];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem('julu_chats');
    if (!saved) return 1;
    const parsed = JSON.parse(saved);
    return parsed.length > 0 ? parsed[0].id : 1;
  });
  const [currentModel, setCurrentModel] = useState(() => localStorage.getItem('julu_model') || "gemini-3-flash-preview");
  const [systemRules, setSystemRules] = useState(() => localStorage.getItem('julu_rules') || "You are Julu, a helpful and friendly AI assistant.");
  
  const [userInput, setUserInput] = useState("");
  const [tempKeyInput, setTempKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const messagesEndRef = useRef(null);

  // --- EFFECTS ---
  useEffect(() => { localStorage.setItem('julu_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('julu_model', currentModel); }, [currentModel]);
  useEffect(() => { localStorage.setItem('julu_rules', systemRules); }, [systemRules]);
  useEffect(() => { 
    if (apiKey) localStorage.setItem('julu_api_key', apiKey);
    else localStorage.removeItem('julu_api_key');
  }, [apiKey]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, activeChatId, isLoading]);

  const currentChat = chats.find(c => c.id === activeChatId) || chats[0];
  
  const availableModels = [
    { id: "gemini-2.5-flash", name: "Flash 2.5" },
    { id: "gemini-3-flash-preview", name: "Flash 3" } 
  ];

  // --- LOGIC: Sending Messages ---
  const handleSend = async () => {
    if (!userInput.trim()) return;
    if (!apiKey) {
      alert("⚠️ Please enter your API Key in the Side Panel (☰) first!");
      setIsPanelOpen(true);
      return;
    }

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput(""); 

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        const newTitle = chat.messages.length === 0 ? currentInput.slice(0, 20) + "..." : chat.title;
        return { ...chat, title: newTitle, messages: [...chat.messages, { role: "user", text: currentInput }] };
      }
      return chat;
    }));

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: currentModel, systemInstruction: systemRules });
      
      const history = currentChat.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const chatSession = model.startChat({ history, generationConfig: { maxOutputTokens: 1000 } });
      const result = await chatSession.sendMessage(currentInput);
      const response = await result.response;
      
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: response.text() }] };
        }
        return chat;
      }));
    } catch (error) {
      console.error(error);
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: `**Error:** Could not connect. Check API Key or Model.` }] };
        }
        return chat;
      }));
    }
    setIsLoading(false);
  };

  // --- LOGIC: Chat Management ---
  const createNewChat = () => {
    const newChat = { id: Date.now(), title: "New Chat", messages: [] };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setIsPanelOpen(false);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    const filtered = chats.filter(c => c.id !== id);
    setChats(filtered.length ? filtered : [{ id: Date.now(), title: "New Chat", messages: [] }]);
    if (activeChatId === id && filtered.length) setActiveChatId(filtered[0].id);
  };

  const renameChat = (e, id) => {
    e.stopPropagation();
    const newName = prompt("Enter new name:");
    if (newName) setChats(prev => prev.map(c => c.id === id ? { ...c, title: newName } : c));
  };

  const saveApiKey = () => {
    if (tempKeyInput.trim().length > 10) {
      setApiKey(tempKeyInput.trim());
      setTempKeyInput("");
      alert("Key Saved Securely! 🔒");
    } else {
      alert("Key too short.");
    }
  };

  return (
    // We toggle the 'data-theme' attribute to switch colors in CSS!
    <div className="app-container" data-theme={isDarkMode ? "dark" : "light"}>
      
      {/* --- HEADER --- */}
      <header className="app-header">
        <div style={{display: 'flex', alignItems: 'center'}}>
          <h2 className="header-title">Julu AI</h2>
          <span className="model-badge">{currentModel}</span>
          <span 
            className="status-dot" 
            style={{ backgroundColor: apiKey ? 'var(--success)' : 'var(--danger)' }}
            title={apiKey ? "Key Saved" : "No Key"}
          ></span>
        </div>
        <button className="icon-btn" onClick={() => setIsPanelOpen(true)}>☰</button>
      </header>

      {/* --- SIDE PANEL --- */}
      {isPanelOpen && <div className="overlay" onClick={() => setIsPanelOpen(false)} />}
      <div className="side-panel" style={{ transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="panel-header">
          <span>Settings</span>
          <button className="icon-btn" onClick={() => setIsPanelOpen(false)}>✕</button>
        </div>
        
        {/* SETTINGS */}
        <div className="settings-container">
          <label className="settings-label">🔑 API Key:</label>
          {!apiKey ? (
            <div style={{display: 'flex', gap: '5px'}}>
              <input 
                type="password" 
                className="select-input"
                placeholder="Paste Gemini Key..." 
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
              />
              <button onClick={saveApiKey} className="btn success">Save</button>
            </div>
          ) : (
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{color: 'var(--success)', fontWeight: 'bold'}}>✅ Key Saved</span>
              <button onClick={() => {if(window.confirm("Delete key?")) setApiKey("")}} className="btn danger" style={{fontSize: '12px'}}>Delete</button>
            </div>
          )}
        </div>

        <div className="settings-container">
          <label className="settings-label">🧠 AI Model:</label>
          <select className="select-input" value={currentModel} onChange={(e) => setCurrentModel(e.target.value)}>
            {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => { setIsRulesOpen(true); setIsPanelOpen(false); }} className="btn full-width" style={{marginTop: '15px', backgroundColor: '#6c5ce7'}}>
            🧠 Edit Brain Rules
          </button>
        </div>

        <div style={{padding: '15px'}}>
          <button className="btn full-width" onClick={createNewChat}>+ New Chat</button>
        </div>

        <div className="history-list">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => { setActiveChatId(chat.id); setIsPanelOpen(false); }}
            >
              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px'}}>
                {chat.title}
              </span>
              <div>
                <button onClick={(e) => renameChat(e, chat.id)} className="icon-btn" style={{fontSize: '14px'}}>✎</button>
                <button onClick={(e) => deleteChat(e, chat.id)} className="icon-btn" style={{fontSize: '14px', color: 'var(--danger)'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
          {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      {/* --- MODAL --- */}
      {isRulesOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{margin: 0}}>🧠 Brain Rules</h3>
            <textarea 
              className="modal-textarea"
              value={systemRules}
              onChange={(e) => setSystemRules(e.target.value)}
            />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn secondary" onClick={() => setIsRulesOpen(false)}>Close</button>
              <button className="btn success" onClick={() => setIsRulesOpen(false)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CHAT AREA --- */}
      <div className="chat-list">
        {currentChat.messages.length === 0 ? (
          <div style={{textAlign: 'center', marginTop: '50px', opacity: 0.5}}>
            <h3>Hi Janu!</h3>
            <p>I am Julu. Ready to chat!</p>
          </div>
        ) : (
          currentChat.messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.role === 'user' ? 'user' : 'bot'}`}>
              <div className={`message-bubble ${msg.role === 'user' ? 'user' : 'bot'}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="message-row bot">
            <div className="message-bubble bot typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- INPUT AREA --- */}
      <div className="input-area">
        <input 
          className="chat-input"
          value={userInput} 
          onChange={(e) => setUserInput(e.target.value)} 
          placeholder="Message Julu..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="btn" onClick={handleSend} disabled={isLoading}>Send</button>
      </div>
    </div>
  );
}

export default App;