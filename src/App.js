import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import mermaid from 'mermaid';
import './App.css';

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
  const [currentModel, setCurrentModel] = useState(() => localStorage.getItem('julu_model') || "gemini-2.5-flash-preview");
  const [systemRules, setSystemRules] = useState(() => localStorage.getItem('julu_rules') || "You are Julu. If asked for diagrams, generate Mermaid JS code wrapped in ```mermaid ``` blocks.");
  
  // VOICE SETTINGS
  const [speechLang, setSpeechLang] = useState(() => localStorage.getItem('julu_speech_lang') || "en-US");
  const [pitch, setPitch] = useState(() => parseFloat(localStorage.getItem('julu_pitch')) || 1);
  const [rate, setRate] = useState(() => parseFloat(localStorage.getItem('julu_rate')) || 1);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => localStorage.getItem('julu_voice_uri') || "");

  const [userInput, setUserInput] = useState("");
  const [tempKeyInput, setTempKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // ATTACHMENT MENU STATE
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- INIT & EFFECTS ---
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: isDarkMode ? 'dark' : 'default', securityLevel: 'loose', fontFamily: 'sans-serif' });
  }, [isDarkMode]);

  useEffect(() => { mermaid.contentLoaded(); }, [chats]);

  // Load Voices when browser is ready
  useEffect(() => {
    const loadVoices = () => {
      const avail = window.speechSynthesis.getVoices();
      setVoices(avail);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Save Settings
  useEffect(() => { localStorage.setItem('julu_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('julu_model', currentModel); }, [currentModel]);
  useEffect(() => { localStorage.setItem('julu_rules', systemRules); }, [systemRules]);
  useEffect(() => { localStorage.setItem('julu_speech_lang', speechLang); }, [speechLang]);
  useEffect(() => { localStorage.setItem('julu_pitch', pitch); }, [pitch]);
  useEffect(() => { localStorage.setItem('julu_rate', rate); }, [rate]);
  useEffect(() => { localStorage.setItem('julu_voice_uri', selectedVoiceURI); }, [selectedVoiceURI]);
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

  const availableLanguages = [
    { code: "en-US", name: "English (US)" },
    { code: "en-IN", name: "English (India)" },
    { code: "te-IN", name: "Telugu (తెలుగు)" },
    { code: "hi-IN", name: "Hindi (हिन्दी)" }
  ];

  // Filter voices based on selected language
  const filteredVoices = voices.filter(v => v.lang.startsWith(speechLang.split('-')[0]));

  // --- DIAGRAM DOWNLOADER ---
  const downloadDiagram = (e) => {
    const button = e.target;
    const wrapper = button.parentElement;
    const svg = wrapper.querySelector('svg');
    if (!svg) { alert("Wait for diagram..."); return; }
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgSize = svg.getBoundingClientRect();
    const scale = 2;
    canvas.width = svgSize.width * scale;
    canvas.height = svgSize.height * scale;
    img.onload = () => {
      ctx.fillStyle = isDarkMode ? "#2d2d2d" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.download = `julu-diagram-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // --- VOICE INPUT ---
  const toggleListening = () => {
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Use Chrome/Edge for voice."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = speechLang; 
    setIsListening(true);
    recognition.onresult = (event) => {
      setUserInput((prev) => prev + " " + event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsAttachMenuOpen(false); // Close menu after clicking
  };

  // --- VOICE OUTPUT ---
  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.lang = speechLang; 
    // Use selected voice if available, otherwise find a default for lang
    const voiceToUse = voices.find(v => v.voiceURI === selectedVoiceURI) || voices.find(v => v.lang === speechLang);
    if (voiceToUse) utterance.voice = voiceToUse;

    utterance.rate = rate;   // User Speed
    utterance.pitch = pitch; // User Pitch
    window.speechSynthesis.speak(utterance);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachment(reader.result);
      reader.readAsDataURL(file);
    }
    setIsAttachMenuOpen(false); // Close menu
  };

  const handleSend = async () => {
    if (!userInput.trim() && !attachment) return;
    if (!apiKey) { alert("⚠️ Enter API Key in Side Panel!"); setIsPanelOpen(true); return; }
    
    setIsLoading(true);
    const currentInput = userInput;
    const currentImage = attachment;
    setUserInput(""); setAttachment(null);

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        const newTitle = chat.messages.length === 0 ? currentInput.slice(0, 20) + "..." : chat.title;
        return { ...chat, title: newTitle, messages: [...chat.messages, { role: "user", text: currentInput, image: currentImage }] };
      }
      return chat;
    }));

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: currentModel, systemInstruction: systemRules });
      let result;

      if (currentImage) {
        result = await model.generateContent([currentInput, { inlineData: { data: currentImage.split(',')[1], mimeType: "image/png" } }]);
      } else {
        const history = currentChat.messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
        const chatSession = model.startChat({ history, generationConfig: { maxOutputTokens: 2000 } });
        result = await chatSession.sendMessage(currentInput);
      }
      
      const text = (await result.response).text();
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) return { ...chat, messages: [...chat.messages, { role: "bot", text }] };
        return chat;
      }));
    } catch (error) {
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) return { ...chat, messages: [...chat.messages, { role: "bot", text: `**Error:** ${error.message}` }] };
        return chat;
      }));
    }
    setIsLoading(false);
  };

  // --- HELPERS (Chat Management) ---
  const createNewChat = () => { const newChat = { id: Date.now(), title: "New Chat", messages: [] }; setChats([newChat, ...chats]); setActiveChatId(newChat.id); setIsPanelOpen(false); };
  const deleteChat = (e, id) => { e.stopPropagation(); const filtered = chats.filter(c => c.id !== id); setChats(filtered.length ? filtered : [{ id: Date.now(), title: "New Chat", messages: [] }]); if (activeChatId === id && filtered.length) setActiveChatId(filtered[0].id); };
  const renameChat = (e, id) => { e.stopPropagation(); const newName = prompt("Name:"); if (newName) setChats(prev => prev.map(c => c.id === id ? { ...c, title: newName } : c)); };
  const saveApiKey = () => { if (tempKeyInput.length > 10) { setApiKey(tempKeyInput.trim()); setTempKeyInput(""); alert("Saved!"); } };

  return (
    <div className="app-container" data-theme={isDarkMode ? "dark" : "light"}>
      <header className="app-header">
        <div style={{display: 'flex', alignItems: 'center'}}><h2 className="header-title">Julu AI</h2><span className="model-badge">{currentModel}</span></div>
        <button className="icon-btn" onClick={() => setIsPanelOpen(true)}>☰</button>
      </header>

      {isPanelOpen && <div className="overlay" onClick={() => setIsPanelOpen(false)} />}
      <div className="side-panel" style={{ transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="panel-header"><span>Settings</span><button className="icon-btn" onClick={() => setIsPanelOpen(false)}>✕</button></div>
        
        <div className="settings-container">
            <label className="settings-label">🔑 API Key:</label>
            {!apiKey ? (<div style={{display: 'flex', gap: '5px'}}><input type="password" className="select-input" placeholder="Paste Key..." value={tempKeyInput} onChange={(e) => setTempKeyInput(e.target.value)} /><button onClick={saveApiKey} className="btn success">Save</button></div>) : (<div style={{display: 'flex', justifyContent: 'space-between'}}><span style={{color: 'var(--success)'}}>✅ Saved</span><button onClick={() => setApiKey("")} className="btn danger" style={{fontSize: '12px'}}>Delete</button></div>)}
        </div>
        
        {/* VOICE CONTROL SECTION */}
        <div className="settings-container">
            <label className="settings-label">🗣️ Voice Settings:</label>
            
            <label style={{fontSize: '12px', opacity: 0.8}}>Language:</label>
            <select className="select-input" value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
                {availableLanguages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
            
            <label style={{fontSize: '12px', opacity: 0.8, marginTop: '10px', display: 'block'}}>Specific Voice:</label>
            <select className="select-input" value={selectedVoiceURI} onChange={(e) => setSelectedVoiceURI(e.target.value)}>
                <option value="">Default Voice</option>
                {filteredVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>

            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <div style={{flex:1}}>
                <label style={{fontSize: '10px'}}>Pitch: {pitch}</label>
                <input type="range" min="0.5" max="2" step="0.1" value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} style={{width:'100%'}} />
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize: '10px'}}>Speed: {rate}</label>
                <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} style={{width:'100%'}} />
              </div>
            </div>
        </div>

        <div className="settings-container">
            <label className="settings-label">🧠 Model:</label>
            <select className="select-input" value={currentModel} onChange={(e) => setCurrentModel(e.target.value)}>{availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <button onClick={() => { setIsRulesOpen(true); setIsPanelOpen(false); }} className="btn full-width" style={{marginTop: '15px', backgroundColor: '#6c5ce7'}}>🧠 Brain Rules</button>
        </div>

        <div style={{padding: '15px'}}><button className="btn full-width" onClick={createNewChat}>+ New Chat</button></div>
        <div className="history-list">{chats.map(chat => (<div key={chat.id} className={`history-item ${chat.id === activeChatId ? 'active' : ''}`} onClick={() => { setActiveChatId(chat.id); setIsPanelOpen(false); }}><span>{chat.title}</span><div><button onClick={(e) => renameChat(e, chat.id)} className="icon-btn">✎</button><button onClick={(e) => deleteChat(e, chat.id)} className="icon-btn" style={{color: 'var(--danger)'}}>🗑</button></div></div>))}</div>
        <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? "☀️ Light" : "🌙 Dark"}</button>
      </div>

      {isRulesOpen && (<div className="modal-overlay"><div className="modal-content"><h3>🧠 Brain Rules</h3><textarea className="modal-textarea" value={systemRules} onChange={(e) => setSystemRules(e.target.value)} /><div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}><button className="btn secondary" onClick={() => setIsRulesOpen(false)}>Close</button><button className="btn success" onClick={() => setIsRulesOpen(false)}>Save</button></div></div></div>)}

      <div className="chat-list">
        {currentChat.messages.length === 0 ? (<div style={{textAlign: 'center', marginTop: '50px', opacity: 0.5}}><h3>Hi Janu!</h3><p>I am Julu. Click the + to add images or talk!</p></div>) : (
          currentChat.messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.role === 'user' ? 'user' : 'bot'}`}>
              <div className={`message-bubble ${msg.role === 'user' ? 'user' : 'bot'}`}>
                {msg.image && <img src={msg.image} alt="Upload" className="message-image" />}
                <ReactMarkdown components={{
                    code({node, inline, className, children, ...props}) {
                      const match = /language-(\w+)/.exec(className || '')
                      if (!inline && match && match[1] === 'mermaid') {
                        return <div className="mermaid-wrapper"><div className="mermaid">{children}</div><button className="download-btn" onClick={downloadDiagram}>💾 Save PNG</button></div>
                      }
                      return <code className={className} {...props}>{children}</code>
                    }
                  }}>{msg.text}</ReactMarkdown>
                {msg.role === 'bot' && <button className="speak-btn" onClick={() => speakText(msg.text)}>🔊</button>}
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="message-row bot"><div className="message-bubble bot typing-indicator"><div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div></div></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {attachment && (<div className="preview-container"><img src={attachment} alt="Preview" className="preview-img" /><button className="remove-preview" onClick={() => setAttachment(null)}>✕</button></div>)}
        
        {/* PLUS BUTTON & POPUP MENU */}
        <div className="attach-container">
            <button className={`icon-btn plus-btn ${isAttachMenuOpen ? 'active' : ''}`} onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}>＋</button>
            {isAttachMenuOpen && (
                <div className="attach-menu">
                    <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" style={{display: 'none'}} />
                    <button className="menu-item" onClick={() => fileInputRef.current.click()}>🖼️ Image</button>
                    <button className={`menu-item ${isListening ? 'listening' : ''}`} onClick={toggleListening}>{isListening ? '🛑 Stop' : '🎤 Voice'}</button>
                </div>
            )}
        </div>

        <input className="chat-input" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={isListening ? "Listening..." : "Message..."} onKeyPress={(e) => e.key === 'Enter' && handleSend()} />
        <button className="btn" onClick={handleSend} disabled={isLoading}>Send</button>
      </div>
    </div>
  );
}

export default App;