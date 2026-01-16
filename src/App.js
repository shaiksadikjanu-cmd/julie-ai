import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';

function App() {
  // --- STATE MANAGEMENT ---
  
  // 1. API KEY STATE (Loaded from Local Storage)
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('julu_api_key') || "";
  });

  // 2. Chat History
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('julu_chats');
    return saved ? JSON.parse(saved) : [{ id: 1, title: "New Chat", messages: [] }];
  });

  // 3. Active Chat
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem('julu_chats');
    if (!saved) return 1;
    const parsed = JSON.parse(saved);
    return parsed.length > 0 ? parsed[0].id : 1;
  });

  // 4. Model Selection
  const [currentModel, setCurrentModel] = useState(() => {
    return localStorage.getItem('julu_model') || "gemini-3-flash-preview";
  });

  // 5. Brain Rules
  const [systemRules, setSystemRules] = useState(() => {
    return localStorage.getItem('julu_rules') || "You are Julu, a helpful and friendly AI assistant.";
  });

  const [userInput, setUserInput] = useState("");
  const [tempKeyInput, setTempKeyInput] = useState(""); // Temporary input for the API key box
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const messagesEndRef = useRef(null);

  // --- EFFECTS: Auto-Save ---
  useEffect(() => { localStorage.setItem('julu_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('julu_model', currentModel); }, [currentModel]);
  useEffect(() => { localStorage.setItem('julu_rules', systemRules); }, [systemRules]);
  
  // Save API Key when it changes
  useEffect(() => { 
    if (apiKey) localStorage.setItem('julu_api_key', apiKey);
    else localStorage.removeItem('julu_api_key');
  }, [apiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId, isLoading]);

  const currentChat = chats.find(c => c.id === activeChatId) || chats[0];

  const availableModels = [
    { id: "gemini-2.5-flash", name: "Flash 2.5" },
    { id: "gemini-3-flash-preview", name: "Flash 3" } 
  ];

  // --- LOGIC: Sending Messages ---
  const handleSend = async () => {
    if (!userInput.trim()) return;

    // SECURITY CHECK: Do we have a key?
    if (!apiKey) {
      alert("⚠️ Please enter your API Key in the Side Panel (☰) first!");
      setIsPanelOpen(true); // Open the panel for them
      return;
    }

    setIsLoading(true);
    const currentInput = userInput;
    setUserInput(""); 

    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === activeChatId) {
        const newTitle = chat.messages.length === 0 ? currentInput.slice(0, 20) + "..." : chat.title;
        return { 
          ...chat, 
          title: newTitle,
          messages: [...chat.messages, { role: "user", text: currentInput }] 
        };
      }
      return chat;
    }));

    try {
      const genAI = new GoogleGenerativeAI(apiKey); // Use the saved state key
      
      const model = genAI.getGenerativeModel({ 
        model: currentModel,
        systemInstruction: systemRules 
      });

      const history = currentChat.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const chatSession = model.startChat({
        history: history,
        generationConfig: { maxOutputTokens: 1000 },
      });

      const result = await chatSession.sendMessage(currentInput);
      const response = await result.response;
      const text = response.text();

      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: text }] };
        }
        return chat;
      }));

    } catch (error) {
      console.error(error);
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { 
            role: "bot", 
            text: `**Error:** Could not connect. \n\n1. Check your internet.\n2. Check if your API Key is correct in the Side Panel.` 
          }] };
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
    if (filtered.length === 0) {
      setChats([{ id: Date.now(), title: "New Chat", messages: [] }]);
    } else {
      setChats(filtered);
      if (activeChatId === id) setActiveChatId(filtered[0].id);
    }
  };

  const renameChat = (e, id) => {
    e.stopPropagation();
    const newName = prompt("Enter new name:");
    if (newName) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: newName } : c));
    }
  };

  // --- LOGIC: API Key Management ---
  const saveApiKey = () => {
    if (tempKeyInput.trim().length > 10) {
      setApiKey(tempKeyInput.trim());
      setTempKeyInput(""); // Clear the input box for safety
      alert("Key Saved Securely! 🔒");
    } else {
      alert("That key looks too short. Please check it.");
    }
  };

  const deleteApiKey = () => {
    if (window.confirm("Are you sure? You will need to enter it again to chat.")) {
      setApiKey("");
    }
  };

  // --- THEME ---
  const theme = {
    bg: isDarkMode ? '#121212' : '#f0f2f5',
    header: isDarkMode ? '#1f1f1f' : '#ffffff',
    text: isDarkMode ? '#e0e0e0' : '#111111',
    panelBg: isDarkMode ? '#1f1f1f' : '#ffffff',
    panelBorder: isDarkMode ? '#333' : '#ddd',
    inputBg: isDarkMode ? '#2d2d2d' : '#ffffff',
    userBubble: '#007bff', 
    botBubble: isDarkMode ? '#2d2d2d' : '#ffffff',
    activeChat: isDarkMode ? '#333' : '#e6f2ff',
    selectBg: isDarkMode ? '#2d2d2d' : '#f8f9fa',
    modalBg: isDarkMode ? '#2d2d2d' : '#ffffff',
    success: '#00b894',
    danger: '#d63031',
  };

  const animationStyles = `
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    .typing-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 3px;
      background-color: ${isDarkMode ? '#aaa' : '#555'};
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
  `;

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg, color: theme.text, fontFamily: 'sans-serif', overflow: 'hidden' },
    header: { padding: '15px 20px', background: theme.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 10 },
    chatList: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
    inputArea: { padding: '20px', background: theme.header, display: 'flex', gap: '10px', borderTop: `1px solid ${theme.panelBorder}` },
    input: { flex: 1, padding: '12px', borderRadius: '20px', border: `1px solid ${theme.panelBorder}`, background: theme.inputBg, color: theme.text, fontSize: '16px', outline: 'none' },
    
    // Side Panel
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, display: isPanelOpen ? 'block' : 'none' },
    sidePanel: { 
      position: 'fixed', top: 0, right: 0, width: '300px', height: '100%', 
      background: theme.panelBg, boxShadow: '-2px 0 5px rgba(0,0,0,0.2)', 
      transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)', 
      transition: 'transform 0.3s ease', zIndex: 100, display: 'flex', flexDirection: 'column'
    },
    panelHeader: { padding: '20px', borderBottom: `1px solid ${theme.panelBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold' },
    historyList: { flex: 1, overflowY: 'auto', padding: '10px' },
    historyItem: (id) => ({
      padding: '12px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer',
      background: id === activeChatId ? theme.activeChat : 'transparent',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      color: theme.text
    }),
    btn: { cursor: 'pointer', padding: '8px 15px', borderRadius: '5px', border: 'none', background: '#007bff', color: 'white', fontWeight: 'bold' },
    iconBtn: { cursor: 'pointer', background: 'none', border: 'none', fontSize: '18px', color: theme.text },
    themeToggle: { margin: '20px', padding: '10px', borderRadius: '10px', border: `1px solid ${theme.panelBorder}`, background: 'transparent', color: theme.text, cursor: 'pointer' },
    
    // Model & Key Settings
    settingsContainer: { padding: '15px', borderBottom: `1px solid ${theme.panelBorder}` },
    label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: theme.text, opacity: 0.8 },
    select: { width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${theme.panelBorder}`, background: theme.selectBg, color: theme.text, fontSize: '14px', outline: 'none', cursor: 'pointer' },
    
    // Rules Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: isRulesOpen ? 'flex' : 'none', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxWidth: '500px', background: theme.modalBg, padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '15px' },
    textArea: { width: '100%', height: '150px', padding: '10px', borderRadius: '10px', border: `1px solid ${theme.panelBorder}`, background: theme.inputBg, color: theme.text, resize: 'none', fontSize: '14px' },
    modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px' }
  };

  return (
    <div style={styles.container}>
      <style>{animationStyles}</style>
      
      {/* --- HEADER --- */}
      <header style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <h2 style={{margin: 0}}>Julu AI</h2>
          <span style={{fontSize: '10px', background: theme.panelBorder, padding: '2px 6px', borderRadius: '4px'}}>
            {currentModel}
          </span>
          {/* Key Status Dot */}
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%', 
            background: apiKey ? theme.success : theme.danger,
            display: 'inline-block'
          }} title={apiKey ? "Key Saved" : "No Key"}></span>
        </div>
        <button style={styles.iconBtn} onClick={() => setIsPanelOpen(true)}>☰</button>
      </header>

      {/* --- SIDE PANEL --- */}
      <div style={styles.overlay} onClick={() => setIsPanelOpen(false)} />
      <div style={styles.sidePanel}>
        <div style={styles.panelHeader}>
          <span>Settings</span>
          <button style={styles.iconBtn} onClick={() => setIsPanelOpen(false)}>✕</button>
        </div>
        
        {/* API KEY MANAGER */}
        <div style={styles.settingsContainer}>
          <label style={styles.label}>🔑 API Key:</label>
          {!apiKey ? (
            <div style={{display: 'flex', gap: '5px'}}>
              <input 
                type="password" 
                placeholder="Paste Gemini Key..." 
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                style={{...styles.select, flex: 1}}
              />
              <button onClick={saveApiKey} style={{...styles.btn, background: theme.success}}>Save</button>
            </div>
          ) : (
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.selectBg, padding: '10px', borderRadius: '8px', border: `1px solid ${theme.success}`}}>
              <span style={{fontSize: '14px', color: theme.success, fontWeight: 'bold'}}>✅ Key Saved</span>
              <button onClick={deleteApiKey} style={{...styles.btn, padding: '5px 10px', background: theme.danger, fontSize: '12px'}}>Delete</button>
            </div>
          )}
          <p style={{fontSize: '11px', opacity: 0.6, marginTop: '5px'}}>
            Key is saved in your browser (LocalStorage).
          </p>
        </div>

        {/* MODEL SELECTOR */}
        <div style={styles.settingsContainer}>
          <label style={styles.label}>🧠 AI Model:</label>
          <select style={styles.select} value={currentModel} onChange={(e) => setCurrentModel(e.target.value)}>
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          
          {/* BRAIN RULES BUTTON */}
          <button 
            onClick={() => { setIsRulesOpen(true); setIsPanelOpen(false); }}
            style={{...styles.btn, width: '100%', marginTop: '15px', backgroundColor: '#6c5ce7'}}
          >
            🧠 Edit Brain Rules
          </button>
        </div>

        <div style={{padding: '15px'}}>
          <button style={{...styles.btn, width: '100%'}} onClick={createNewChat}>+ New Chat</button>
        </div>

        <div style={styles.historyList}>
          {chats.map(chat => (
            <div 
              key={chat.id} 
              style={styles.historyItem(chat.id)}
              onClick={() => { setActiveChatId(chat.id); setIsPanelOpen(false); }}
            >
              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px'}}>
                {chat.title}
              </span>
              <div>
                <button onClick={(e) => renameChat(e, chat.id)} style={{...styles.iconBtn, fontSize: '14px', marginRight: '5px'}}>✎</button>
                <button onClick={(e) => deleteChat(e, chat.id)} style={{...styles.iconBtn, fontSize: '14px', color: '#ff4444'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <button style={styles.themeToggle} onClick={() => setIsDarkMode(!isDarkMode)}>
          {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      {/* --- BRAIN RULES MODAL --- */}
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <h3 style={{margin: 0}}>🧠 Brain Rules (System Instructions)</h3>
          <p style={{fontSize: '13px', opacity: 0.7, margin: 0}}>
            Tell Julu how to behave.
          </p>
          <textarea 
            style={styles.textArea}
            value={systemRules}
            onChange={(e) => setSystemRules(e.target.value)}
            placeholder="Enter rules here..."
          />
          <div style={styles.modalActions}>
            <button style={{...styles.btn, background: '#888'}} onClick={() => setIsRulesOpen(false)}>Close</button>
            <button style={styles.btn} onClick={() => setIsRulesOpen(false)}>Save Rules</button>
          </div>
        </div>
      </div>

      {/* --- CHAT AREA --- */}
      <div style={styles.chatList}>
        {currentChat.messages.length === 0 ? (
          <div style={{textAlign: 'center', marginTop: '50px', opacity: 0.5}}>
            <h3>Hi Janu!</h3>
            <p>I am Julu. Please enter your API Key in the side panel to start.</p>
          </div>
        ) : (
          currentChat.messages.map((msg, idx) => (
            <div key={idx} style={{display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'}}>
              <div style={{
                background: msg.role === 'user' ? theme.userBubble : theme.botBubble,
                color: msg.role === 'user' ? 'white' : theme.text,
                padding: '12px 18px', borderRadius: '15px', maxWidth: '75%',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={{display: 'flex', justifyContent: 'flex-start'}}>
            <div style={{
              background: theme.botBubble,
              padding: '15px 20px', borderRadius: '15px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center'
            }}>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- INPUT AREA --- */}
      <div style={styles.inputArea}>
        <input 
          style={styles.input} 
          value={userInput} 
          onChange={(e) => setUserInput(e.target.value)} 
          placeholder="Message Julu..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button style={styles.btn} onClick={handleSend} disabled={isLoading}>Send</button>
      </div>

    </div>
  );
}

export default App;