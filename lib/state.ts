/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

export type Template = 'eburon-tts';
export type Theme = 'light' | 'dark';
export type VoiceStyle = 'natural' | 'breathy' | 'dramatic';

export interface Character {
  id: string;
  name: string;
  style: string;
  voiceName: string;
  voiceUrl?: string; // Audio Reference URL
  context?: string;  // Memory / Backstory
}

const generateSystemPrompt = (language: string, characters: Character[] = []) => {
  const castSection = characters.length > 0 ? `
CAST & VOICES (Dynamic Radio Drama):
The following characters appear in the script. When you read a line prefixed with their name (e.g., "${characters[0].name}: ..."), INSTANTLY switch your vocal persona and apply SSML properties.

${characters.map(c => `• **${c.name}**:
  - Voice Reference: ${c.voiceName} (Mimic the timbre/pitch of this voice)
  - Audio Reference (Style/Vibe): ${c.voiceUrl || 'N/A'}
  - Style/Tone: ${c.style}
  - **Memory & Context**: ${c.context || 'No specific backstory provided.'}
  - **Mic Position/Volume**: ${c.name.toLowerCase().includes('caller') || c.style.toLowerCase().includes('phone') 
      ? 'PHONE CALLER: Use <prosody volume="soft" rate="medium"> (Simulate distant/thin phone EQ). Perform interruptions/hesitations.' 
      : 'STUDIO MIC: Use <prosody volume="loud" rate="medium"> (Full studio presence, clear, authoritative).'}`).join('\n')}

If a line has no prefix, use the default NARRATOR voice (Warm, authoritative, engaging, 100% volume).
` : '';

  return `
ROLE: Elite Simultaneous Interpreter & Radio Drama Actor
TARGET LANGUAGE: [${language || 'English'}]

OBJECTIVE:
Translate the incoming text segments into [${language}] and perform them aloud as a HIGH-PRODUCTION RADIO DRAMA / PODCAST using SSML where appropriate.

${castSection}

1. SSML & PACING (CRITICAL):
   - **Pauses**: Use <break time="300ms"/> for quick beats and <break time="800ms"/> for dramatic transitions.
   - **Volume/Rate**: Use <prosody volume="..."> and <prosody rate="..."> to distinguish characters.
     - Callers should sound slightly softer/faster/nervous.
     - Host should sound confident/measured/louder.
   - **NO DEAD AIR**: Keep the gap between characters tight.

2. SOUND EFFECTS & ADLIBS (PERFORM AUDIBLY):
   - If the text or character description contains **[laugh]**, **[chuckle]**, **[sigh]**, **[gasp]**, **[cry]** -> **PERFORM THE SOUND AUDIBLY**. 
   - Do NOT say the word "laugh". Actually make a laughing sound.
   - Example: "[laugh] That's crazy!" -> *Audible laughter* "That's crazy!"

3. SCENE-AWARE PERFORMANCE:
   - **Caller / Phone**: Simulate a phone line—thinner voice, slightly distant, more hesitant or candid.
   - **DJ / Host**: Sound close to the mic, warm, compressed, intimate (proximity effect).
   - **Emotion**:
     - *Argument*: Faster pace <prosody rate="fast">, interruptions, sharp tone.
     - *Comfort*: Slower <prosody rate="slow">, softer, warm tone.

4. MEANING-CENTRIC TRANSLATION:
   - Preserve the *spirit and emotional weight*.
   - Use natural local idioms (e.g., natural Taglish flow for PH context).
   - Make it sound conversational, not like a read script.

5. CONTINUOUS FLOW & LIFE ADVICE (FILLER MODE):
   - If you receive a **[CONTINUE]** or **[SILENCE]** signal, do NOT go silent.
   - **IMMEDIATELY** pivot to "Life Advice / Hugot Mode".
   - Based on the previous story context, offer a short, deep realization, a rhetorical question, or a comforting word to the audience.
   - **Style**: Philosophic, warm, "Real Talk" but empathetic.
   - *Example*: "Alam mo, ganyan talaga ang buhay... minsan akala mo panalo ka na, yun pala sinusubok ka lang."

⛔️ CRITICAL RULE – TECHNICAL DIRECTIONS ⛔️
- **(pause)**, **[break]**: Convert these to <break time="..."/> tags.
- **(fade)**, **(music)**: Ignore these technically, just adjust your voice to fade out if needed.
- **Do NOT read technical tags** like "Voice: ..." -> Just DO the action.

VOICE PERSONA – THE VERSATILE ACTOR:
- You are a one-person audio drama team.
- **Volume Control**:
  - Host/Narrator = 100% Volume.
  - Callers = 75-80% Volume + Phone EQ simulation.
  - Asides/Whispers = 60% Volume.

PERFORMANCE PRIORITIES:
1. **Flow** (Avoid awkward pauses).
2. **Character Distinction** (Clear difference between Host vs Caller using SSML).
3. **Emotional Authenticity** (Adlibs, laughs, breaths).
4. **Entertainment Value**.

Now, translate and perform the incoming text segments accordingly.
`;
};

/**
 * Settings State Definition
 */
interface SettingsState {
  systemPrompt: string;
  model: string;
  voice: string;
  voiceStyle: VoiceStyle;
  language: string;
  detectedLanguage: string | null;
  // Characters / Cast
  characters: Character[];
  // BGM State
  bgmUrls: string[];
  bgmIndex: number;
  bgmVolume: number;
  bgmPlaying: boolean;
  // Background Pad State
  backgroundPadEnabled: boolean;
  backgroundPadVolume: number;
  
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceStyle: (style: VoiceStyle) => void;
  setLanguage: (language: string) => void;
  setDetectedLanguage: (language: string | null) => void;
  // Character Setters
  addCharacter: (character: Omit<Character, 'id'>) => void;
  updateCharacter: (id: string, updates: Partial<Omit<Character, 'id'>>) => void;
  removeCharacter: (id: string) => void;
  // BGM Setters
  addBgmUrl: (url: string) => void;
  setBgmIndex: (index: number) => void;
  setBgmVolume: (volume: number) => void;
  setBgmPlaying: (playing: boolean) => void;
  // Pad Setters
  setBackgroundPadEnabled: (enabled: boolean) => void;
  setBackgroundPadVolume: (volume: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'Tagalog (Taglish)',
      detectedLanguage: null,
      characters: [],
      systemPrompt: generateSystemPrompt('Tagalog (Taglish)', []),
      model: DEFAULT_LIVE_API_MODEL,
      voice: DEFAULT_VOICE,
      voiceStyle: 'breathy',
      
      // BGM Init
      bgmUrls: [
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm.m4a',
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm2.mp3',
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm3.m4a'
      ],
      bgmIndex: 0,
      bgmVolume: 0.5,
      bgmPlaying: false,

      // Pad Init
      backgroundPadEnabled: false,
      backgroundPadVolume: 0.2,

      setSystemPrompt: prompt => set({ systemPrompt: prompt }),
      setModel: model => set({ model }),
      setVoice: voice => set({ voice }),
      setVoiceStyle: voiceStyle => set({ voiceStyle }),
      setLanguage: language => set(state => ({ 
        language, 
        systemPrompt: generateSystemPrompt(language, state.characters) 
      })),
      setDetectedLanguage: detectedLanguage => set({ detectedLanguage }),
      
      addCharacter: (char) => set(state => {
        const newChars = [...state.characters, { ...char, id: Math.random().toString(36).substr(2, 9) }];
        return {
          characters: newChars,
          systemPrompt: generateSystemPrompt(state.language, newChars)
        };
      }),

      updateCharacter: (id, updates) => set(state => {
        const newChars = state.characters.map(c => 
          c.id === id ? { ...c, ...updates } : c
        );
        return {
          characters: newChars,
          systemPrompt: generateSystemPrompt(state.language, newChars)
        };
      }),

      removeCharacter: (id) => set(state => {
        const newChars = state.characters.filter(c => c.id !== id);
        return {
          characters: newChars,
          systemPrompt: generateSystemPrompt(state.language, newChars)
        };
      }),

      addBgmUrl: url => set(state => ({ bgmUrls: [...state.bgmUrls, url] })),
      setBgmIndex: index => set({ bgmIndex: index }),
      setBgmVolume: volume => set({ bgmVolume: volume }),
      setBgmPlaying: playing => set({ bgmPlaying: playing }),

      setBackgroundPadEnabled: enabled => set({ backgroundPadEnabled: enabled }),
      setBackgroundPadVolume: volume => set({ backgroundPadVolume: volume }),
    }),
    {
      name: 'eburon-settings-storage', // unique name for local storage
      partialize: (state) => ({
        // Only persist these fields
        language: state.language,
        voice: state.voice,
        voiceStyle: state.voiceStyle,
        characters: state.characters,
        bgmUrls: state.bgmUrls,
      }),
    }
  )
);

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleTheme: () => void;
}>(set => ({
  isSidebarOpen: false, // Default closed on mobile-first approach
  theme: 'dark',
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: [], // Default to no tools for read-aloud mode
  template: 'eburon-tts',
  setTemplate: (template: Template) => {
    // No-op for now as we only have one mode
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));