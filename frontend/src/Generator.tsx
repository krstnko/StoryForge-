import { useState } from "react";
import { Sparkles, Copy, User, MapPin, Plus, X, Check } from "lucide-react";

interface GeneratorProps {
  libraryData: any[];
  latestText: string; 
}

export default function Generator({ libraryData, latestText }: GeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
  
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [showCharModal, setShowCharModal] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);

  const availableChars = libraryData.filter(e => e.type === 'character');
  const availableLocs = libraryData.filter(e => e.type === 'location');

  const toggleCharacter = (name: string) => {
    setSelectedChars(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const handleGenerate = async () => {
    if (!prompt) {
      alert("Please describe the scene.");
      return;
    }
    
    setIsGenerating(true);
    const entitiesToSend = [...selectedChars];
    if (selectedLoc) entitiesToSend.push(selectedLoc);

    try {
      const response = await fetch("http://127.0.0.1:8888/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            prompt: prompt, 
            entities: entitiesToSend,
            style_reference: latestText 
        }),
      });
      
      const data = await response.json();
      if (data.text) setGeneratedText(data.text);
    } catch (error) {
      alert("Backend is not responding.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex bg-[#FAFAFA] overflow-hidden">
      
      {/* --- Left panel --- */}
      <div className="w-1/2 flex flex-col border-r border-[#EBEBEB] bg-white p-12 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-2">Generate Scene</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">Describe what happens. The AI will use your library to maintain continuity and mimic your writing style.</p>

        {/* Choose: CHARACTERS */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[11px] font-bold opacity-40 uppercase tracking-widest">Characters involved</label>
            <button onClick={() => setShowCharModal(true)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1 transition-colors">
              <Plus size={12}/> Add
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            {selectedChars.length === 0 && <div className="text-xs text-gray-400 italic bg-[#F7F7F5] p-3 rounded-lg border border-dashed border-[#EBEBEB]">No characters selected.</div>}
            {selectedChars.map(name => (
              <div key={name} className="flex items-center justify-between bg-white border border-[#EBEBEB] p-2.5 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium"><User size={14} className="text-blue-500"/> {name}</div>
                <button onClick={() => toggleCharacter(name)} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Choose: LOCATION */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[11px] font-bold opacity-40 uppercase tracking-widest">Location (Choose ONE)</label>
            <button onClick={() => setShowLocModal(true)} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded flex items-center gap-1 transition-colors">
              <Plus size={12}/> Set Location
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            {!selectedLoc && <div className="text-xs text-gray-400 italic bg-[#F7F7F5] p-3 rounded-lg border border-dashed border-[#EBEBEB]">No specific location set.</div>}
            {selectedLoc && (
              <div className="flex items-center justify-between bg-white border border-[#EBEBEB] p-2.5 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium"><MapPin size={14} className="text-emerald-500"/> {selectedLoc}</div>
                <button onClick={() => setSelectedLoc(null)} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
              </div>
            )}
          </div>
        </div>

        {/* Promt */}
        <div className="flex-1 flex flex-col">
          <label className="text-[11px] font-bold opacity-40 uppercase tracking-widest block mb-3">Scene Prompt</label>
          <textarea 
            className="flex-1 w-full p-4 bg-[#F7F7F5] border border-[#EBEBEB] rounded-xl outline-none resize-none focus:border-gray-400 focus:bg-white transition-all text-sm leading-relaxed"
            placeholder="e.g. They discover a hidden door behind the waterfall. A fight breaks out..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button onClick={handleGenerate} disabled={isGenerating} className="mt-6 w-full bg-[#37352f] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50">
          <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} /> {isGenerating ? "Weaving magic..." : "Generate Scene"}
        </button>
      </div>

      {/* --- Right panel - Result --- */}
      <div className="w-1/2 flex flex-col bg-[#F7F7F5] p-12 overflow-hidden border-l border-[#EBEBEB]">
        <h2 className="text-[11px] font-bold opacity-40 uppercase tracking-widest mb-4">AI Output</h2>
        {generatedText ? (
          <div className="flex-1 bg-white border border-[#EBEBEB] rounded-xl p-8 overflow-y-auto shadow-sm relative group">
            <button onClick={() => navigator.clipboard.writeText(generatedText)} className="absolute top-4 right-4 p-2 bg-[#F7F7F5] hover:bg-[#EBEBE9] rounded-lg text-gray-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs font-bold">
              <Copy size={14}/> Copy
            </button>
            <div className="text-sm leading-loose whitespace-pre-wrap text-[#37352f] font-serif">{generatedText}</div>
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-[#EBEBEB] rounded-xl flex items-center justify-center text-gray-400 text-sm italic">
            Your generated scene will appear here.
          </div>
        )}
      </div>

      {/* --- Choose character window --- */}
      {showCharModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-96 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#EBEBEB] flex justify-between items-center bg-[#F7F7F5]">
              <h3 className="font-bold text-sm">Select Characters</h3>
              <button onClick={() => setShowCharModal(false)}><X size={16}/></button>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {availableChars.map(char => {
                const isSelected = selectedChars.includes(char.name);
                return (
                  <button key={char.name} onClick={() => toggleCharacter(char.name)} className="w-full flex items-center justify-between p-3 hover:bg-[#F7F7F5] rounded-lg transition-colors border-b border-transparent">
                    <div className="flex items-center gap-3"><User size={16} className={isSelected ? "text-blue-500" : "text-gray-400"}/> <span className="text-sm font-medium">{char.name}</span></div>
                    {isSelected && <Check size={16} className="text-blue-500"/>}
                  </button>
                )
              })}
              {availableChars.length === 0 && <div className="p-4 text-center text-sm text-gray-400">Library is empty.</div>}
            </div>
            <div className="p-4 border-t border-[#EBEBEB] bg-[#F7F7F5]">
              <button onClick={() => setShowCharModal(false)} className="w-full bg-[#37352f] text-white py-2 rounded-lg font-bold text-sm hover:bg-black">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Choose location window --- */}
      {showLocModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-96 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#EBEBEB] flex justify-between items-center bg-[#F7F7F5]">
              <h3 className="font-bold text-sm">Set Location</h3>
              <button onClick={() => setShowLocModal(false)}><X size={16}/></button>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {/* Кнопка сброса локации */}
              <button onClick={() => {setSelectedLoc(null); setShowLocModal(false)}} className="w-full flex items-center p-3 hover:bg-red-50 text-red-500 rounded-lg transition-colors text-sm font-medium">
                -- Clear Location --
              </button>
              {availableLocs.map(loc => {
                const isSelected = selectedLoc === loc.name;
                return (
                  <button key={loc.name} onClick={() => {setSelectedLoc(loc.name); setShowLocModal(false)}} className="w-full flex items-center justify-between p-3 hover:bg-[#F7F7F5] rounded-lg transition-colors">
                    <div className="flex items-center gap-3"><MapPin size={16} className={isSelected ? "text-emerald-500" : "text-gray-400"}/> <span className="text-sm font-medium">{loc.name}</span></div>
                    {isSelected && <Check size={16} className="text-emerald-500"/>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}