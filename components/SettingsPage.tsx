/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings, useUI, VoiceStyle, Character, useTools } from '@/lib/state';
import c from 'classnames';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useEffect, useState, useRef } from 'react';
import { supabase, EburonTTSCurrent } from '@/lib/supabase';
import { SUPPORTED_LANGUAGES, AVAILABLE_VOICES, CHARACTER_PRESETS } from '@/lib/constants';
import ToolEditorModal from './ToolEditorModal';

type Tab = 'persona' | 'prompts' | 'tools';

export default function SettingsPage() {
  const { isSidebarOpen, toggleSidebar } = useUI(); // reusing sidebar toggle for settings open/close
  const [activeTab, setActiveTab] = useState<Tab>('persona');
  
  const { 
    language, setLanguage, detectedLanguage,
    voice, setVoice, 
    voiceStyle, setVoiceStyle,
    systemPrompt, setSystemPrompt,
    // Characters
    characters, addCharacter, updateCharacter, removeCharacter,
    // BGM State
    bgmUrls, bgmIndex, bgmVolume, bgmPlaying,
    setBgmPlaying, setBgmVolume, setBgmIndex, addBgmUrl
  } = useSettings();
  
  const { tools, toggleTool, updateTool } = useTools();
  const { connected } = useLiveAPIContext();
  const [dbData, setDbData] = useState<EburonTTSCurrent | null>(null);
  
  // BGM Local State
  const [newBgmUrl, setNewBgmUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Character Local State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharStyle, setNewCharStyle] = useState('');
  const [newCharVoice, setNewCharVoice] = useState(AVAILABLE_VOICES[0]);
  const [newCharUrl, setNewCharUrl] = useState('');
  const [newCharContext, setNewCharContext] = useState('');

  // Tool Editing
  const [editingTool, setEditingTool] = useState<string | null>(null);

  // --- BGM Logic ---
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = bgmVolume;
    
    if (bgmPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Audio play failed (interaction required?):', error);
          setBgmPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [bgmVolume, bgmPlaying, bgmIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = bgmUrls[bgmIndex];
      if (bgmPlaying) {
        audioRef.current.play().catch(e => console.warn(e));
      }
    }
  }, [bgmIndex, bgmUrls]);

  const handleAddUrl = () => {
    if (newBgmUrl.trim()) {
      addBgmUrl(newBgmUrl.trim());
      setNewBgmUrl('');
    }
  };

  // --- Character Logic ---
  const handleSaveCharacter = () => {
    if (newCharName.trim() && newCharStyle.trim()) {
      const charData = {
        name: newCharName.trim(),
        style: newCharStyle.trim(),
        voiceName: newCharVoice,
        voiceUrl: newCharUrl.trim(),
        context: newCharContext.trim()
      };

      if (editingId) {
        updateCharacter(editingId, charData);
        setEditingId(null);
      } else {
        addCharacter(charData);
      }
      
      // Reset form
      setNewCharName('');
      setNewCharStyle('');
      setNewCharVoice(AVAILABLE_VOICES[0]);
      setNewCharUrl('');
      setNewCharContext('');
    }
  };

  const handleEditCharacter = (char: Character) => {
    setEditingId(char.id);
    setNewCharName(char.name);
    setNewCharStyle(char.style);
    setNewCharVoice(char.voiceName);
    setNewCharUrl(char.voiceUrl || '');
    setNewCharContext(char.context || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewCharName('');
    setNewCharStyle('');
    setNewCharVoice(AVAILABLE_VOICES[0]);
    setNewCharUrl('');
    setNewCharContext('');
  };

  const loadPreset = (presetName: string) => {
    const preset = CHARACTER_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setNewCharName(preset.name.split('(')[0].trim());
      setNewCharStyle(preset.style);
      setNewCharVoice(preset.voice);
    }
  };

  // --- Database Monitor Logic ---
  useEffect(() => {
    supabase
      .from('eburon_tts_current')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setDbData(data);
      });

    const channel = supabase
      .channel('settings-db-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eburon_tts_current' },
        (payload) => {
          if (payload.new) {
             setDbData(payload.new as EburonTTSCurrent);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className={c('settings-page', { open: isSidebarOpen })}>
      {/* Persistent Audio Element */}
      <audio ref={audioRef} loop />
      
      <div className="settings-container">
        <header className="settings-header">
          <h2>Configuration & Settings</h2>
          <button onClick={toggleSidebar} className="close-button" title="Close Settings">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <nav className="settings-tabs">
          <button 
            className={c('tab-button', { active: activeTab === 'persona' })}
            onClick={() => setActiveTab('persona')}
          >
            <span className="material-symbols-outlined">theater_comedy</span>
            Topic & Persona
          </button>
          <button 
            className={c('tab-button', { active: activeTab === 'prompts' })}
            onClick={() => setActiveTab('prompts')}
          >
            <span className="material-symbols-outlined">psychology</span>
            System Prompts
          </button>
          <button 
            className={c('tab-button', { active: activeTab === 'tools' })}
            onClick={() => setActiveTab('tools')}
          >
            <span className="material-symbols-outlined">extension</span>
            Tools & Integrations
          </button>
        </nav>

        <main className="settings-content">
          
          {/* TAB 1: TOPIC & PERSONA */}
          {activeTab === 'persona' && (
            <div className="tab-panel">
              <div className="panel-grid">
                
                {/* Column 1: Core Voice Settings */}
                <div className="panel-column">
                  <h3>Voice & Language</h3>
                  <div className="settings-group">
                    <label>Target Language</label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      disabled={connected}
                    >
                      <option value="" disabled>Select...</option>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    {detectedLanguage && (
                      <div className="detected-label">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        Detected: {detectedLanguage}
                      </div>
                    )}
                  </div>

                  <div className="settings-group">
                    <label>Main Narrator Voice</label>
                    <select value={voice} onChange={e => setVoice(e.target.value)}>
                      {AVAILABLE_VOICES.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-group">
                    <label>Voice Style</label>
                    <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value as VoiceStyle)}>
                      <option value="natural">Natural (Standard)</option>
                      <option value="breathy">Breathy (Eburon Default)</option>
                      <option value="dramatic">Dramatic (Slow)</option>
                    </select>
                  </div>

                  <div className="settings-group bgm-group">
                    <h3>Background Music (BGM)</h3>
                    <div className="bgm-controls">
                      <button 
                        className={c('play-toggle', { playing: bgmPlaying })}
                        onClick={() => setBgmPlaying(!bgmPlaying)}
                        title={bgmPlaying ? "Pause BGM" : "Play BGM"}
                      >
                        <span className="material-symbols-outlined">{bgmPlaying ? 'pause' : 'play_arrow'}</span>
                      </button>
                      <div className="volume-slider">
                        <label>Volume: {Math.round(bgmVolume * 100)}%</label>
                        <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={bgmVolume} 
                          onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="bgm-playlist">
                      <select 
                        value={bgmIndex} 
                        onChange={(e) => setBgmIndex(parseInt(e.target.value))}
                      >
                        {bgmUrls.map((url, idx) => (
                           <option key={idx} value={idx}>{url.split('/').pop() || `Track ${idx + 1}`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="add-bgm">
                      <input 
                        type="text" 
                        placeholder="Add Audio URL..." 
                        value={newBgmUrl}
                        onChange={(e) => setNewBgmUrl(e.target.value)}
                      />
                      <button onClick={handleAddUrl}><span className="material-symbols-outlined">add</span></button>
                    </div>
                  </div>
                </div>

                {/* Column 2: Cast & Characters */}
                <div className="panel-column">
                  <h3>Cast & Characters</h3>
                  <div className="character-editor">
                    <div className="preset-selector">
                      <label>Load Preset</label>
                      <select 
                        onChange={(e) => loadPreset(e.target.value)}
                        defaultValue=""
                        disabled={!!editingId}
                      >
                        <option value="" disabled>Select a persona...</option>
                        {CHARACTER_PRESETS.map((p, i) => (
                          <option key={i} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label>Name</label>
                        <input 
                          type="text" placeholder="e.g. Detective" 
                          value={newCharName} onChange={(e) => setNewCharName(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Voice Actor</label>
                        <select value={newCharVoice} onChange={(e) => setNewCharVoice(e.target.value)}>
                          {AVAILABLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="field full">
                        <label>Description / Tone</label>
                        <textarea 
                          placeholder="e.g. Gruff, whispered..." 
                          value={newCharStyle} onChange={(e) => setNewCharStyle(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="field full">
                        <label>Voice Reference (URL)</label>
                        <input 
                          type="text" placeholder="https://..." 
                          value={newCharUrl} onChange={(e) => setNewCharUrl(e.target.value)}
                        />
                      </div>
                      <div className="field full">
                        <label>Context / Memory</label>
                        <textarea 
                          placeholder="Character backstory..." 
                          value={newCharContext} onChange={(e) => setNewCharContext(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="char-actions">
                      {editingId && <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>}
                      <button 
                        className="save-btn" 
                        onClick={handleSaveCharacter}
                        disabled={!newCharName || !newCharStyle}
                      >
                        {editingId ? 'Update Character' : '+ Add Character'}
                      </button>
                    </div>
                  </div>

                  <div className="character-list">
                    {characters.map(char => (
                      <div key={char.id} className={c('char-item', { editing: editingId === char.id })}>
                        <div className="char-info">
                          <div className="char-name">{char.name}</div>
                          <div className="char-meta">{char.voiceName} • {char.style.substring(0, 30)}...</div>
                        </div>
                        <div className="char-controls">
                          <button onClick={() => handleEditCharacter(char)}><span className="material-symbols-outlined">edit</span></button>
                          <button onClick={() => removeCharacter(char.id)} className="delete"><span className="material-symbols-outlined">delete</span></button>
                        </div>
                      </div>
                    ))}
                    {characters.length === 0 && <p className="empty-state">No active characters.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="tab-panel full-height">
              <div className="prompt-editor-container">
                <div className="prompt-header">
                  <h3>Core System Instruction</h3>
                  <p>This prompt defines the AI's personality, translation rules, and behavior. It is automatically regenerated when you change Language or Characters.</p>
                </div>
                <textarea 
                  className="prompt-textarea"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* TAB 3: TOOLS & INTEGRATION */}
          {activeTab === 'tools' && (
             <div className="tab-panel">
               <div className="panel-grid">
                 
                 {/* Database Monitor */}
                 <div className="panel-column">
                   <h3>Database Bridge Monitor</h3>
                   <div className="db-monitor-card">
                     <div className="db-header">
                       <span className="db-status">
                         <span className="material-symbols-outlined status-icon">{dbData ? 'check_circle' : 'sync'}</span>
                         {dbData ? 'Connected' : 'Connecting...'}
                       </span>
                       <span className="db-timestamp">{dbData ? new Date(dbData.updated_at).toLocaleTimeString() : '--:--:--'}</span>
                     </div>
                     {dbData && (
                       <div className="db-content">
                         <div className="db-row">
                            <label>Source ({dbData.source_lang_code || '?'}):</label>
                            <div className="db-val source">"{dbData.source_text}"</div>
                         </div>
                         <div className="db-row">
                            <label>Target ({dbData.target_language || '?'}):</label>
                            <div className="db-val target">{dbData.translated_text || '...'}</div>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Tools Config */}
                 <div className="panel-column">
                   <h3>Function Calling & Tools</h3>
                   <div className="tools-list">
                     {tools.map(tool => (
                       <div key={tool.name} className={c('tool-item', { enabled: tool.isEnabled })}>
                         <div className="tool-info">
                           <div className="tool-name">{tool.name}</div>
                           <div className="tool-desc">{tool.description}</div>
                         </div>
                         <div className="tool-controls">
                           <label className="toggle-switch">
                             <input 
                               type="checkbox" 
                               checked={tool.isEnabled}
                               onChange={() => toggleTool(tool.name)}
                             />
                             <span className="slider"></span>
                           </label>
                           <button onClick={() => setEditingTool(tool.name)} title="Edit Schema">
                             <span className="material-symbols-outlined">settings</span>
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

               </div>
               
               {editingTool && (
                <ToolEditorModal
                  tool={tools.find(t => t.name === editingTool)!}
                  onClose={() => setEditingTool(null)}
                  onSave={(updatedTool) => {
                    updateTool(editingTool, updatedTool);
                    setEditingTool(null);
                  }}
                />
              )}
             </div>
          )}

        </main>
      </div>
    </div>
  );
}