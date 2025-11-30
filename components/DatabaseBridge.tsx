/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import { supabase, EburonTTSCurrent } from '../lib/supabase';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useLogStore, useSettings } from '../lib/state';
import { SUPPORTED_LANGUAGES } from '../lib/constants';

// Worker script to ensure polling continues even when tab is in background
const workerScript = `
  self.onmessage = function() {
    setInterval(() => {
      self.postMessage('tick');
    }, 5000);
  };
`;

// Helper to segment text into natural reading chunks (sentences)
const segmentText = (text: string): string[] => {
  if (!text) return [];

  let sentences: string[] = [];
  
  // Robust segmentation using Intl.Segmenter (Standard in modern browsers)
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // @ts-ignore
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      // @ts-ignore
      sentences = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    } catch (e) {
      // Fallback if instantiation fails
      sentences = [];
    }
  }
  
  // Fallback regex logic if Intl is missing or failed
  if (sentences.length === 0) {
      // Mask common abbreviations to prevent incorrect splitting
      // Replaces '.' with a placeholder '\u0000' temporarily
      let tempText = text
        .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Rev|Gen|Sen|Rep|Gov|St|Mt)\./g, '$1\u0000')
        .replace(/e\.g\./g, 'e\u0000g\u0000')
        .replace(/i\.e\./g, 'i\u0000e\u0000')
        .replace(/No\./g, 'No\u0000');
      
      // Split by common sentence terminators (. ! ?) followed by space or end of string
      const matches = tempText.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
      
      // Unmask the placeholder back to '.'
      sentences = matches.map(s => s.replace(/\u0000/g, '.'));
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  const SOFT_LIMIT = 100;
  const HARD_LIMIT = 220; 

  // Regex to detect Character Dialogue start (e.g., "John:", "DETECTIVE:", "Alice (Angry):")
  const charRegex = /^([A-Z][a-zA-Z0-9\s\(\)]+):/;

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) continue;
    
    // Check if this sentence starts a new character's dialogue
    const startsWithCharacter = charRegex.test(cleanSentence);

    // If we have a chunk building up, and we hit a hard limit OR a new character speaks, flush the old chunk.
    const potentialLength = currentChunk.length + cleanSentence.length;

    if (currentChunk.length > 0) {
      if (startsWithCharacter) {
        // New speaker? Flush previous chunk immediately to keep voices distinct
        chunks.push(currentChunk.trim());
        currentChunk = cleanSentence;
      } else if (potentialLength > HARD_LIMIT) {
        chunks.push(currentChunk.trim());
        currentChunk = cleanSentence;
      } else if (currentChunk.length > SOFT_LIMIT) {
        chunks.push(currentChunk.trim());
        currentChunk = cleanSentence;
      } else {
        currentChunk += ' ' + cleanSentence;
      }
    } else {
      currentChunk = cleanSentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

export default function DatabaseBridge() {
  const { client, connected } = useLiveAPIContext();
  const { addTurn } = useLogStore();
  const { voiceStyle, language, setLanguage, setDetectedLanguage } = useSettings();
  
  const lastProcessedIdRef = useRef<number | null>(null);
  const voiceStyleRef = useRef(voiceStyle);
  const languageRef = useRef(language);

  // Sync refs for use in effect loop
  useEffect(() => { voiceStyleRef.current = voiceStyle; }, [voiceStyle]);
  useEffect(() => { languageRef.current = language; }, [language]);

  // High-performance queue using Refs
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const shouldBufferRef = useRef(false);

  // Data Ingestion & Processing Logic
  useEffect(() => {
    // 1. Reset Queue logic on Connection Change
    queueRef.current = [];
    isProcessingRef.current = false;
    
    // Trigger buffer only on fresh start
    shouldBufferRef.current = true;

    if (!connected) return;

    // The consumer loop that processes the queue sequentially
    const processQueueLoop = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // PRE-ROLL BUFFER: Wait 8-10 seconds before speaking.
        if (shouldBufferRef.current) {
          console.log('Buffering stream for smooth playback (8s)...');
          await new Promise(resolve => setTimeout(resolve, 8000));
          shouldBufferRef.current = false;
        }

        while (queueRef.current.length > 0 && client.status === 'connected') {
          const rawText = queueRef.current[0];
          const style = voiceStyleRef.current;

          // Inject Stage Directions based on selected Style
          // Note: If dynamic characters are used, the prompt handles the style,
          // but we can still add global pacing cues here.
          let scriptedText = rawText;
          
          // Only add generic cues if it DOESN'T look like a dialogue line
          // (Dialogue lines are handled by the character prompt)
          const isDialogue = /^([A-Z][a-zA-Z0-9\s\(\)]+):/.test(rawText);

          if (!isDialogue) {
            if (style === 'breathy') {
              scriptedText = `(soft inhale) ${rawText} ... (pause)`;
            } else if (style === 'dramatic') {
               scriptedText = `(slowly) ${rawText} ... (long pause)`;
            }
          }

          if (!scriptedText || !scriptedText.trim()) {
            queueRef.current.shift();
            continue;
          }

          // Log to console (Visuals)
          addTurn({
            role: 'system',
            text: scriptedText,
            isFinal: true
          });

          // Send to Gemini Live (Audio)
          client.send([{ text: scriptedText }]);

          // Remove the item we just sent
          queueRef.current.shift();

          // Dynamic delay calculation for human-like pacing
          const wordCount = rawText.split(/\s+/).length;
          const readTime = (wordCount / 2.5) * 1000;
          
          let bufferBase = 2000; 
          if (style === 'natural') bufferBase = 1000;
          if (style === 'dramatic') bufferBase = 3000;

          // Faster buffer for dialogue to keep conversation flowing
          if (isDialogue) bufferBase = 500;

          const bufferTime = bufferBase + (Math.random() * 500); 
          
          await new Promise(resolve => setTimeout(resolve, readTime + bufferTime));
        }
      } catch (e) {
        console.error('Error in processing loop:', e);
      } finally {
        isProcessingRef.current = false;
        
        if (queueRef.current.length > 0 && client.status === 'connected') {
           setTimeout(processQueueLoop, 100);
        }
      }
    };

    const processNewData = (data: EburonTTSCurrent) => {
      // AUTO DETECTION LOGIC
      if (data.target_language && SUPPORTED_LANGUAGES.includes(data.target_language)) {
        if (languageRef.current !== data.target_language) {
          console.log(`Auto-detected target language: ${data.target_language}`);
          setLanguage(data.target_language);
          setDetectedLanguage(data.target_language);
        }
      } else if (data.source_lang_label && SUPPORTED_LANGUAGES.includes(data.source_lang_label)) {
        setDetectedLanguage(data.source_lang_label);
      }

      // Prioritize translated text
      const textToRead = (data.translated_text && data.translated_text.trim().length > 0) 
        ? data.translated_text 
        : data.source_text;

      if (!data || !textToRead) return;

      // Deduplicate based on ID
      if (lastProcessedIdRef.current === data.id) {
        return;
      }

      lastProcessedIdRef.current = data.id;
      
      const segments = segmentText(textToRead);
      
      if (segments.length > 0) {
        queueRef.current.push(...segments);
        processQueueLoop();
      }
    };

    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from('eburon_tts_current')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && data) {
        processNewData(data as EburonTTSCurrent);
      }
    };

    // --- SETUP WORKER & SUBSCRIPTION ---
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => {
      fetchLatest();
    };
    worker.postMessage('start');

    const channel = supabase
      .channel('bridge-realtime-opt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eburon_tts_current' },
        (payload) => {
          if (payload.new) {
             processNewData(payload.new as EburonTTSCurrent);
          }
        }
      )
      .subscribe();

    fetchLatest();

    return () => {
      worker.terminate();
      supabase.removeChannel(channel);
    };
  }, [connected, client, addTurn, setLanguage, setDetectedLanguage]);

  return null;
}