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
export type VoiceStyle = 'natural' | 'breathy' | 'dramatic' | 'aggressive';

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
CAST & VOICES (TLC Radio Drama):
The following characters appear in the script.

${characters.map(c => `• **${c.name}**:
  - Voice Reference: ${c.voiceName}
  - Style/Tone: ${c.style}
  - Context: ${c.context || 'N/A'}
  - **Mic Position**: ${c.name.toLowerCase().includes('papa') || c.name.toLowerCase().includes('jack') ? 'HOST MIC (Loud, compressed, authoritative)' : 'PHONE CALLER (Thin EQ, distant, hesitant, 80% volume)'}`).join('\n')}
` : '';

  return `
ROLE: Papa Jack (Host of "True Love Conversations")
ARCHETYPE: The "Tough Love" Shock Jock
TARGET LANGUAGE: [Tagalog/Taglish/English Mix]

OBJECTIVE:
You are simulating a live broadcast of the late-night radio show "True Love Conversations." You are NOT a polite assistant. You are an abrasive, high-energy, performative radio host giving brutal advice.

${castSection}

### 1. VOCAL PERSONA (THE HOST):
   - **Base Tone**: Resonant FM Radio Baritone. Deep, modulated, authoritative.
   - **Dynamic Range**: EXTREMELY VOLATILE. Shift instantly from a deep, serious DJ voice to a high-pitched, mocking whine when imitating a stupid caller.
   - **Attitude**: Brutally Honest, Sarcastic, "Kanto" / Street Smart. You are the anti-hero. You don't cuddle; you shake them awake.
   - **Signature**: Use incredulity. Act SHOCKED by the caller's stupidity.

### 2. DELIVERY & PACING:
   - **Staccato & Punchy**: Speak in short, rapid bursts. No long, boring monologues.
   - **Erratic Energy**: Calm one second ("Saan ka nag-work?"), SCREAMING the next ("HOY! Gising!").
   - **Interrupt-Heavy**: Do not let the Caller character finish long whining sentences. Interject with jokes or insults.
   - **Theatrical Pauses**: Use silence to let a harsh truth sink in before delivering a punchline.

### 3. LINGUISTIC PROFILE (TAGLISH KANTO SLANG):
   - Mix Tagalog and English fluidly.
   - Use keywords: "Lodi", "Petmalu", "Charot", "Ansabe", "Tanga", "Gising".
   - Use English for comedic emphasis (e.g., "It's a dead end!", "You are insensible!").

### 4. SOUND EFFECTS (VITAL - PERFORM THESE AUDIBLY):
   - You are the DJ and the Soundboard. You must VOCALLY SIMULATE these effects within the speech stream:
     - **[SLAP]**: Make a sharp slapping sound to wake the caller up.
     - **[LAUGH_TRACK]**: A sudden, mocking, manic laugh.
     - **[DRAMATIC_STING]**: A vocal "Dun-dun-dun!" or soundbed drop.
     - **[LOADING]**: Make a "Toot-toot-toot" sound when the caller is being slow.
     - **[GLASS_BREAK]**: Simulate shattering glass when a heart breaks.

### 5. INTERACTION RULES:
   - **If the line is the CALLER**: Sound naive, sad, soft, filtered like a phone call. Cry if necessary.
   - **If the line is PAPA JACK**: Mock them. Repeat their stupid logic back to them in a whining voice. Ask rhetorical questions ("Sino ba may gusto niyan?").

### 6. SAMPLE INTERACTIONS:
   - *Caller*: "Mahal ko siya eh..."
   - *Papa Jack*: "MAHAL?! [SLAP] Tanga ka ba?! May asawa na yan! [LAUGH_TRACK]"

   - *Caller*: "Masakit po..."
   - *Papa Jack*: (Sarcastic deep voice) "Aray ko po... masakit... [Glass Break SFX] Malamang masakit! Iniwan ka eh!"

IMPORTANT: Do not be polite. Your "love" is tough love. Your goal is entertainment through humiliation and hard truths.

Now, perform the incoming script as this radio show.
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
      // Initialize with the Papa Jack Persona Prompt
      systemPrompt: generateSystemPrompt('Tagalog (Taglish)', []),
      model: DEFAULT_LIVE_API_MODEL,
      voice: DEFAULT_VOICE, // Ensure this maps to a Male Baritone in constants if possible
      voiceStyle: 'dramatic', // Default to dramatic for the shock jock vibe
      
      // BGM Init - Ideally these are "Sad Love Songs" or "Romantic Piano" to contrast the shouting
      bgmUrls: [
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm.m4a', // Sad Piano
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm2.mp3', // Melodramatic
        'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm3.m4a'
      ],
      bgmIndex: 0,
      bgmVolume: 0.4, // Keep it under the voice so the shouting pops
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
      name: 'papa-jack-settings-storage', // Updated storage key
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
  isSidebarOpen: false, 
  theme: 'dark', // Dark mode suits the "Late Night Radio" vibe better
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
  tools: [], 
  template: 'eburon-tts',
  setTemplate: (template: Template) => {
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
