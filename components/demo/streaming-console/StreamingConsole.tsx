/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, memo, useState } from 'react';
import { LiveConnectConfig, Modality, LiveServerContent } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTools,
} from '@/lib/state';

// Helper component for Teleprompter Script Effect with Typewriter
const ScriptReader = memo(({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let index = 0;
    // Reset when text changes (new log entry usually implies new text)
    if (text === displayedText) return;
    
    // Calculate typing speed - faster for long text to keep up, but minimum readable speed
    const typingSpeed = 20; 

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (index >= text.length) {
          clearInterval(interval);
          return text;
        }
        index++;
        return text.slice(0, index);
      });
    }, typingSpeed);

    return () => clearInterval(interval);
  }, [text]);

  // Simple parser to separate stage directions from spoken text
  // Directions are in parentheses () or brackets []
  const parts = displayedText.split(/([(\[].*?[)\]])/g);

  return (
    <div className="script-line">
      {parts.map((part, index) => {
        if (part.match(/^[(\[].*[)\]]$/)) {
          // It's a stage direction
          return <span key={index} className="script-direction">{part}</span>;
        }
        // It's spoken text
        return <span key={index} className="script-spoken">{part}</span>;
      })}
    </div>
  );
});

export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { systemPrompt, voice } = useSettings();
  const { tools } = useTools();
  const turns = useLogStore(state => state.turns);

  useEffect(() => {
    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      // Input audio transcription removed to enforce broadcast mode
      outputAudioTranscription: {},
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
    };

    const enabledTools = tools
      .filter(tool => tool.isEnabled)
      .map(tool => ({
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        ],
      }));

    if (enabledTools.length > 0) {
      config.tools = enabledTools;
    }

    setConfig(config);
  }, [setConfig, systemPrompt, tools, voice]);

  useEffect(() => {
    // We only listen to maintain protocol state, but we don't display transcriptions
    // in the visualizer mode (iframe is covering this anyway).
    // The logs are still kept in the store for the script reader if needed.

    const handleInputTranscription = (text: string, isFinal: boolean) => {};
    const handleOutputTranscription = (text: string, isFinal: boolean) => {};
    const handleContent = (serverContent: LiveServerContent) => {};
    const handleTurnComplete = () => {};

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client]);

  return (
    <div className="streaming-console-layout" style={{width: '100%', height: '100%'}}>
      <iframe 
        src="https://eburon.ai/zoom/index.html" 
        style={{
          width: '100%', 
          height: '100%', 
          border: 'none', 
          display: 'block'
        }}
        title="Eburon Visualizer"
      />
    </div>
  );
}