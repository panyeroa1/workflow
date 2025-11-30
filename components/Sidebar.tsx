/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings, useUI, VoiceStyle, Character } from '@/lib/state';
import c from 'classnames';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useEffect, useState, useRef } from 'react';
import { supabase, EburonTTSCurrent } from '@/lib/supabase';
import { SUPPORTED_LANGUAGES, AVAILABLE_VOICES, CHARACTER_PRESETS } from '@/lib/constants';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { 
    language, setLanguage, detectedLanguage,
    voice, setVoice, 
    voiceStyle, setVoiceStyle,
    // Characters
    characters, addCharacter, updateCharacter, removeCharacter,
    // BGM State
    bgmUrls, bgmIndex, bgmVolume, bgmPlaying,
    setBgmPlaying, setBgmVolume, setBgmIndex, addBgmUrl
  } = useSettings();
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

  // BGM Logic
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
  }, [bgmVolume, bgmPlaying, bgmIndex]); // Re-run on index change to ensure play state persists if enabled

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
        // Update existing
        updateCharacter(editingId, charData);
        setEditingId(null);
      } else {
        // Add new
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
      setNewCharName(preset.name.split('(')[0].trim()); // Just the name part usually preferred
      setNewCharStyle(preset.style);
      setNewCharVoice(preset.voice);
    }
  };

  useEffect(() => {
    // Initial fetch
    supabase
      .from('eburon_tts_current')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setDbData(data);
      });

    // Real-time subscription for UI updates
    const channel = supabase
      .channel('sidebar-db-monitor')
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
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h3>Settings</h3>
          <button onClick={toggleSidebar} className="close-button">
            <span className="icon">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Database Monitor</h4>
            <div style={{ fontSize: '12px', background: 'var(--bg-panel-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {dbData ? (
                <>
                  <div style={{ marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>Current ID: {dbData.id}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{new Date(dbData.updated_at).toLocaleTimeString()}</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                     <strong style={{color: 'var(--accent-blue)'}}>Source ({dbData.source_lang_code || '?'}):</strong><br />
                     <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{dbData.source_text}"</div>
                  </div>
                  <div>
                    <strong style={{color: 'var(--accent-green)'}}>Target ({dbData.target_language || '?'}):</strong><br />
                    <div style={{ color: 'var(--text-main)', marginTop: '4px' }}>{dbData.translated_text || '...'}</div>
                  </div>
                </>
              ) : (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="material-symbols-outlined" style={{fontSize: '16px', animation: 'spin 2s linear infinite'}}>sync</span>
                  Connecting to Eburon DB...
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <fieldset disabled={connected}>
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Target Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  <option value="" disabled>Select...</option>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                {detectedLanguage && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--accent-green)',
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span className="material-symbols-outlined" style={{fontSize: '14px'}}>auto_awesome</span>
                    Detected: {detectedLanguage}
                  </div>
                )}
              </div>

              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Main Narrator Voice</label>
                <select
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Voice Style</label>
                <select
                  value={voiceStyle}
                  onChange={e => setVoiceStyle(e.target.value as VoiceStyle)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  <option value="natural">Natural (Standard)</option>
                  <option value="breathy">Breathy (Eburon Default)</option>
                  <option value="dramatic">Dramatic (Slow)</option>
                </select>
              </div>
            </fieldset>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Cast & Characters (Audio Drama)</h4>
            <div style={{background: 'var(--bg-panel-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '12px'}}>
              <div style={{marginBottom: '12px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 'bold'}}>Load Preset Character</label>
                <select 
                  onChange={(e) => loadPreset(e.target.value)}
                  defaultValue=""
                  disabled={!!editingId} // Disable presets while editing
                  style={{fontSize: '0.85rem', padding: '8px', border: '1px solid var(--accent-blue)'}}
                >
                  <option value="" disabled>Select a persona...</option>
                  {CHARACTER_PRESETS.map((p, i) => (
                    <option key={i} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{borderTop: '1px solid var(--border-color)', margin: '12px 0'}}></div>

              <div style={{marginBottom: '8px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Character Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Detective, Alice" 
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  style={{fontSize: '0.85rem', padding: '8px', marginBottom: '8px'}}
                />
              </div>
              <div style={{marginBottom: '8px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Description / Tone</label>
                <textarea 
                  placeholder="e.g. Gruff, whispered, anxious" 
                  value={newCharStyle}
                  onChange={(e) => setNewCharStyle(e.target.value)}
                  rows={2}
                  style={{fontSize: '0.85rem', padding: '8px', marginBottom: '8px', resize: 'vertical', fontFamily: 'inherit'}}
                />
              </div>
              <div style={{marginBottom: '8px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Voice Reference Audio (URL)</label>
                <input 
                  type="text" 
                  placeholder="https://... (Audio Sample)" 
                  value={newCharUrl}
                  onChange={(e) => setNewCharUrl(e.target.value)}
                  style={{fontSize: '0.85rem', padding: '8px', marginBottom: '8px'}}
                />
              </div>
              <div style={{marginBottom: '8px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Character Memory / Context</label>
                <textarea 
                  placeholder="Key facts this character knows..." 
                  value={newCharContext}
                  onChange={(e) => setNewCharContext(e.target.value)}
                  rows={2}
                  style={{fontSize: '0.85rem', padding: '8px', marginBottom: '8px', resize: 'vertical', fontFamily: 'inherit'}}
                />
              </div>
              <div style={{marginBottom: '8px'}}>
                <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Voice Actor</label>
                <select 
                  value={newCharVoice} 
                  onChange={(e) => setNewCharVoice(e.target.value)}
                  style={{
                    fontSize: '0.85rem', padding: '8px',
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em'
                  }}
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              
              <div style={{display: 'flex', gap: '8px'}}>
                {editingId && (
                  <button 
                    onClick={handleCancelEdit}
                    style={{
                      flexGrow: 1,
                      background: 'var(--Neutral-30)', 
                      color: 'var(--text-main)', 
                      borderRadius: '6px', 
                      padding: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button 
                  onClick={handleSaveCharacter}
                  disabled={!newCharName || !newCharStyle}
                  style={{
                    flexGrow: 2,
                    background: editingId ? 'var(--accent-green)' : 'var(--Blue-500)', 
                    color: 'white', 
                    borderRadius: '6px', 
                    padding: '8px',
                    opacity: (!newCharName || !newCharStyle) ? 0.5 : 1,
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    transition: 'background-color 0.3s'
                  }}
                >
                  {editingId ? 'Update Character' : '+ Add Character'}
                </button>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {characters.length === 0 && (
                 <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center'}}>
                   No characters added. Using default narrator only.
                 </div>
              )}
              {characters.map(char => (
                <div key={char.id} style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '8px', 
                  background: editingId === char.id ? 'var(--active-bg-subtle)' : 'var(--Neutral-20)', 
                  borderRadius: '6px', 
                  borderLeft: `3px solid ${editingId === char.id ? 'var(--accent-green)' : 'var(--accent-blue)'}`
                }}>
                  <div style={{overflow: 'hidden', flexGrow: 1}}>
                    <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{char.name}</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px'}}>{char.style}</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--accent-blue)'}}>Voice: {char.voiceName}</div>
                  </div>
                  <div style={{display: 'flex', gap: '4px'}}>
                    <button 
                      onClick={() => handleEditCharacter(char)}
                      title="Edit"
                      style={{color: 'var(--text-secondary)'}}
                    >
                      <span className="material-symbols-outlined" style={{fontSize: '18px'}}>edit</span>
                    </button>
                    <button 
                      onClick={() => removeCharacter(char.id)}
                      title="Delete"
                      style={{color: 'var(--Red-400)'}}
                    >
                      <span className="material-symbols-outlined" style={{fontSize: '18px'}}>delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Background Audio (BGM)</h4>
            
            {/* Hidden Audio Element */}
            <audio ref={audioRef} loop />

            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
               
               {/* Controls */}
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-panel-secondary)', padding: '10px', borderRadius: '8px'}}>
                 <button 
                    onClick={() => setBgmPlaying(!bgmPlaying)}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: bgmPlaying ? 'var(--accent-red)' : 'var(--accent-green)', 
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title={bgmPlaying ? "Pause" : "Play"}
                 >
                   <span className="material-symbols-outlined">{bgmPlaying ? 'pause' : 'play_arrow'}</span>
                 </button>
                 <button 
                    onClick={() => { setBgmPlaying(false); if(audioRef.current) audioRef.current.currentTime = 0; }}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: 'var(--Neutral-30)', 
                      color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="Stop / Reset"
                 >
                   <span className="material-symbols-outlined">stop</span>
                 </button>
                 <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <label style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>Volume: {Math.round(bgmVolume * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={bgmVolume} 
                      onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                      style={{width: '100%', height: '4px'}}
                    />
                 </div>
               </div>

               {/* Track List */}
               <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                 <label style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Select Track</label>
                 <select 
                    value={bgmIndex} 
                    onChange={(e) => {
                      setBgmIndex(parseInt(e.target.value));
                      // If changing track, auto play if already playing
                      if (bgmPlaying && audioRef.current) {
                         // Logic handled by effect
                      }
                    }}
                    style={{fontSize: '0.85rem', padding: '8px'}}
                 >
                   {bgmUrls.map((url, idx) => {
                      const name = url.split('/').pop() || `Track ${idx + 1}`;
                      return <option key={idx} value={idx}>{name}</option>;
                   })}
                 </select>
               </div>

               {/* Add URL */}
               <div style={{display: 'flex', gap: '8px'}}>
                 <input 
                    type="text" 
                    placeholder="https://... (Add Audio URL)" 
                    value={newBgmUrl}
                    onChange={(e) => setNewBgmUrl(e.target.value)}
                    style={{flexGrow: 1, fontSize: '0.85rem', padding: '8px'}}
                 />
                 <button 
                    onClick={handleAddUrl}
                    style={{
                      background: 'var(--Blue-500)', color: 'white', 
                      borderRadius: '8px', width: '40px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="Add to Playlist"
                 >
                   <span className="material-symbols-outlined">add</span>
                 </button>
               </div>
            </div>
          </div>
          
          <div className="sidebar-section">
            <div style={{padding: '12px', background: 'var(--active-bg-subtle)', borderRadius: '8px', border: '1px solid var(--accent-blue)', fontSize: '12px'}}>
              <strong style={{display:'block', marginBottom:'4px', color:'var(--accent-blue)'}}>Eburon Active</strong>
              Tools disabled. Polling interval: 5s.
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}