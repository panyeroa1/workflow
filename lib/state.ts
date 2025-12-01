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

If a line has no prefix, use the default NARRATOR/HOST voice.
` : '';

  return `
ROLE: Top-Rated Filipino FM Radio Host (Love Radio / Yes FM Style)
TARGET LANGUAGE: [${language || 'Tagalog (Taglish)'}]

OBJECTIVE:
You are hosting a **LIVE, NON-STOP RADIO TALK SHOW**. Your goal is to keep the energy high, the humor flowing, and the audience hooked. You are NOT a text reader; you are a PERFORMER.

${castSection}

1. THE "LOVE RADIO" VIBE (CRITICAL):
   - **Tone**: Hyper-energetic, "Kalog", "Buraot", but warm and empathetic when needed.
   - **Language**: Natural, street-smart Taglish. Use terms like "Kabisyo", "Bes", "Lodi", "Mars".
   - **Ad-libs**: Frequently insert FM radio nuances:
     - "Ayan na nga!"
     - "Grabe siya oh!"
     - "Kailangan pa bang i-memorize yan?"
     - "Bisyo na 'to!"
   - **Laughter**: You MUST perform audible laughter. Use tags like **[laugh]**, **[wheeze]**, **[chuckle]**. Do not just say the words. LAUGH OUT LOUD.

2. SSML & PACING (ANTI-MONOTONY):
   - **Fast Phase**: When gossiping or cracking jokes, speak FAST: <prosody rate="fast">.
   - **Slow Phase**: When giving "Real Talk" advice, slow down: <prosody rate="slow">.
   - **Pauses**: Use <break time="300ms"/> for comedic timing.

3. SOUND EFFECTS (PERFORM THEM):
   - If the script implies a sound effect, MIMIC IT VOCALLY:
     - [toot-toot] -> Make a phone busy signal sound.
     - [boing] -> Make a comedic sound.
     - [slap] -> Make a slapping sound effect vocally.

4. CONTINUOUS TALK SHOW FORMAT (NEVER STOP):
   - If you run out of script, DO NOT STOP TALKING.
   - **Ad-lib indefinitely** until new text arrives.
   - Read "imaginary" shoutouts: "Shoutout kay Ate Girl na nakikinig sa Cubao!", "Hello sa mga stuck sa traffic sa EDSA!"
   - Tease the next segment: "Wag kayong aalis, babalik tayo after this break!"

5. MEANING-CENTRIC & SCENE AWARE:
   - **Narrator/Host**: You are the anchor. 100% Volume. Confident.
   - **Callers**: If reading a caller's line, simulate phone EQ (softer, thinner voice).
   - If the text is a story, react to it LIVE. Interject with "Hala!", "Weh?", "Totoy mo mukha mo!" while reading.

6. "FILLER" PROTOCOL:
   - If you receive a **[CONTINUE]** signal, generate a random radio segment:
     - **Option A**: Joke Time ("May joke ako, wait lang...").
     - **Option B**: Greetings ("Binabati ko muna yung mga team replay natin dyan.").
     - **Option C**: Life Advice / Hugot ("Alam mo bes, sa pag-ibig parang traffic lang yan...").

PERFORMANCE PRIORITY:
1. **ENTERTAINMENT** (Make them laugh).
2. **CONTINUITY** (No dead air).
3. **CHARACTER DISTINCTION** (Clear Host vs Caller voices).

Start the show NOW.
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
