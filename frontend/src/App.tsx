import { useState, useEffect } from "react";
import { Plus, FileText, Sparkles, Check, User, AlertTriangle, X, Book, Library, Edit2, Save, Wand2 } from "lucide-react";
import WorldLibrary from "./Library";
import Generator from "./Generator"; 
type Chapter = {
  id: string;
  title: string;
  content: string;
  wordCount: number;
};

export default function App() {
  const [view, setView] = useState<"editor" | "library" | "generator">("editor");
  const [isLoading, setIsLoading] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>(() => {
    const saved = localStorage.getItem("book_chapters");
    if (saved) return JSON.parse(saved) as Chapter[];
    return [
      { id: "1", title: "Chapter 1", content: "", wordCount: 0 }
    ];
  });
  
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem("active_chapter_id") || "1";
  });


  useEffect(() => {
    localStorage.setItem("book_chapters", JSON.stringify(chapters));
  }, [chapters]);

  useEffect(() => {
    localStorage.setItem("active_chapter_id", activeId);
  }, [activeId]);
  
  const [library, setLibrary] = useState<any[]>([]);
  const [staged, setStaged] = useState<any[]>([]);

  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{desc: string, participants: string[], location: string}>({ desc: "", participants: [], location: "" });


  const [editValue, setEditValue] = useState("");
  const [setupEntity, setSetupEntity] = useState<any>(null);

  const activeChapter = chapters.find(c => c.id === activeId);

  const fetchLibraryData = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8888/library");
      const data = await res.json();
      setLibrary(data.entities || []);
    } catch (err) {
      console.error("Failed to load library");
    }
  };

  useEffect(() => { fetchLibraryData(); }, []);

  const handleAudit = async () => {
    if (!activeChapter?.content) return;
    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8888/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_text: activeChapter.content }),
      });
      const data = await response.json();
      if (data.changes) {
          setStaged(data.changes);
      }
    } catch (error) {
      alert("Backend is not responding.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMasterCommit = async () => {
    const unresolvedErrors = staged.filter(s => s.type === 'contradiction');
    if (unresolvedErrors.length > 0) {
      const proceed = window.confirm(`You have ${unresolvedErrors.length} unresolved logic error(s). Are you sure you want to commit the rest?`);
      if (!proceed) return;
    }

    const readyToCommit = staged.filter(s => 
      s.type !== 'contradiction' && 
      !(s.type === 'new_character' && s.desc === 'Needs setup')
    );

    if (readyToCommit.length === 0) {
      alert("No valid changes to commit. (Resolve errors or setup new characters first).");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8888/commit_all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chapter_title: activeChapter?.title || "Unknown Chapter",
          changes: readyToCommit 
        }),
      });

      if (response.ok) {
        setStaged(staged.filter(s => !readyToCommit.includes(s)));
        fetchLibraryData();
      } else {
        alert("Server error during commit.");
      }
    } catch (error) {
      alert("Database is not responding!");
    }
  };

  // --- Editing ---

  const startEditing = (item: any) => {
    if (item.type === 'new_character') {
      setSetupEntity({ ...item });
    } else {
      setEditingId(item.id);
      const partsArray = Array.isArray(item.participants) ? item.participants : (item.participants ? [item.participants] : []);
      setEditForm({ desc: item.desc, participants: partsArray, location: item.location || "" });
    }
  };

  const saveInlineEdit = (id: string) => {
    setStaged(staged.map(s => s.id === id ? { ...s, desc: editForm.desc, participants: editForm.participants, location: editForm.location } : s));
    setEditingId(null);
  };

  const toggleParticipant = (name: string) => {
    setEditForm(prev => {
      if (prev.participants.includes(name)) {
        return { ...prev, participants: prev.participants.filter(p => p !== name) };
      } else {
        return { ...prev, participants: [...prev.participants, name] };
      }
    });
  };

  const saveNewCharacterModal = () => {
    setStaged(staged.map(s => 
      s.id === setupEntity.id 
        ? { ...setupEntity, desc: "Configured", type: "character_ready" } 
        : s
    ));
    setSetupEntity(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#FFFFFF] text-[#37352f] font-sans antialiased overflow-hidden">
      
      <div className="flex w-64 flex-col border-r border-[#EBEBEB] bg-[#F7F7F5]">
        <div className="p-4 space-y-2 border-b border-[#EBEBEB]">
          <button onClick={() => setView("editor")} className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium ${view === 'editor' ? 'bg-[#EBEBE9] text-black' : 'text-[#37352f]/60 hover:bg-[#EBEBE9]/50'}`}><Book size={18}/> Editor</button>
          <button onClick={() => { fetchLibraryData(); setView("library"); }} className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium ${view === 'library' ? 'bg-[#EBEBE9] text-black' : 'text-[#37352f]/60 hover:bg-[#EBEBE9]/50'}`}><Library size={18}/> World Library</button>
          <button onClick={() => { fetchLibraryData(); setView("generator"); }} className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium ${view === 'generator' ? 'bg-indigo-100 text-indigo-700' : 'text-[#37352f]/60 hover:bg-indigo-50/50'}`}><Wand2 size={18}/> Generate Scene</button>
        </div>

        {view === 'editor' && (
          <>
            <div className="flex items-center justify-between px-4 py-3 mt-2">
              <span className="text-[11px] font-bold opacity-50 uppercase tracking-widest">Chapters</span>
              <button onClick={() => {
                const newCh = { id: Date.now().toString(), title: "Untitled", content: "", wordCount: 0 };
                setChapters([...chapters, newCh]);
                setActiveId(newCh.id);
              }} className="p-1 hover:bg-[#EDECE9] rounded-md transition-colors"><Plus size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chapters.map(ch => (
                <button key={ch.id} onClick={() => setActiveId(ch.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${activeId === ch.id ? 'bg-[#EBEBE9] font-medium' : 'opacity-60'}`}>
                  <FileText size={16} /> <span className="truncate">{ch.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* --- center --- */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'editor' && (
          <>
            <div className="flex-1 flex flex-col bg-white overflow-y-auto">
              <div className="px-16 pt-12 pb-4"> 
                <input className="text-4xl font-bold w-full outline-none border-none text-[#37352f] bg-transparent py-4 leading-normal" value={activeChapter?.title} onChange={(e) => setChapters(chapters.map(c => c.id === activeId ? {...c, title: e.target.value} : c))} placeholder="Untitled"/>
              </div>
              <div className="flex-1 px-16 pb-10">
                <textarea className="h-full w-full outline-none resize-none text-lg leading-relaxed text-[#37352f] bg-transparent" value={activeChapter?.content} onChange={(e) => {
                    const text = e.target.value;
                    setChapters(chapters.map(c => c.id === activeId ? {...c, content: text, wordCount: text.split(' ').length} : c))
                  }} placeholder="Begin your story..."/>
              </div>
            </div>

            {/* --- Right Panel --- */}
            <div className="w-96 flex flex-col border-l border-[#EBEBEB] bg-[#F7F7F5] overflow-hidden">
              <div className="p-4 border-b border-[#EBEBEB] bg-white space-y-3 z-10 shadow-sm">
                <button onClick={handleAudit} disabled={isLoading} className="w-full bg-[#F7F7F5] border border-[#EBEBEB] py-2.5 px-3 rounded-xl text-[12px] font-bold hover:bg-[#EBEBE9] transition-all flex items-center justify-center gap-2">
                  <Sparkles size={14} className={isLoading ? "animate-spin text-purple-500" : "text-purple-500"} /> Audit Chapter
                </button>
                <button onClick={handleMasterCommit} disabled={staged.length === 0} className="w-full bg-[#37352f] text-white py-2.5 px-3 rounded-xl text-[12px] font-bold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                  <Check size={14} /> Commit {staged.length} Changes
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.1em] mb-2">Staged Changes</h3>
                
                {staged.map(s => (
                  <div key={s.id} className="bg-white border border-[#EBEBEB] p-4 rounded-xl shadow-sm relative group">
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId !== s.id && (
                        <button onClick={() => startEditing(s)} className="p-1 text-[#37352f]/40 hover:text-blue-500 bg-[#F7F7F5] rounded"><Edit2 size={14} /></button>
                      )}
                      <button onClick={() => setStaged(staged.filter(x => x.id !== s.id))} className="p-1 text-[#37352f]/40 hover:text-red-500 bg-[#F7F7F5] rounded"><X size={14} /></button>
                    </div>

                    <div className="flex gap-3">
                    <div className={`mt-0.5 ${s.type === 'contradiction' ? 'text-orange-500' : s.type === 'trait' ? 'text-purple-500' : s.type.includes('character') ? 'text-blue-500' : 'text-emerald-500'}`}>
                      {s.type === 'contradiction' ? <AlertTriangle size={16}/> : s.type === 'trait' ? <Sparkles size={16}/> : <User size={16}/>}
                    </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-bold text-[#37352f] flex items-center gap-2">
                          {s.title}
                          {s.type === 'new_character' && s.desc === 'Needs setup' && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">Setup Required</span>}
                          {s.type === 'new_character' && s.desc === 'Configured' && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded uppercase">Configured</span>}
                          {s.type === 'trait' && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded uppercase">Fact / Trait</span>}
                        </div>
                        {s.type === 'event' && editingId !== s.id && (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {s.participants && s.participants.length > 0 && <span className="text-[10px] font-bold text-blue-500/70 uppercase">Characters: {s.participants.join(', ')}</span>}
                            {s.location && <span className="text-[10px] font-bold text-emerald-500/70 uppercase">Location: {s.location}</span>}
                          </div>
                        )}
                        
                        {editingId === s.id ? (
                          <div className="mt-2 space-y-3 bg-[#F7F7F5] p-3 rounded-lg border border-[#EBEBEB]">
                            
                       
                            <div>
                              <label className="text-[9px] font-bold uppercase opacity-50 block mb-1">Event Description</label>
                              <textarea className="w-full text-[12px] p-2 border border-[#EBEBEB] rounded bg-white outline-none focus:border-blue-300 resize-none" rows={2} value={editForm.desc} onChange={(e) => setEditForm({...editForm, desc: e.target.value})} autoFocus />
                            </div>
                            
                            
                            <div>
                              <label className="text-[9px] font-bold uppercase opacity-50 block mb-1">Link Characters (from Library)</label>
                              <div className="flex flex-wrap gap-1.5">
                               
                                {library.filter(e => e.type === 'character').map(char => {
                                  const isSelected = editForm.participants.includes(char.name);
                                  return (
                                    <button 
                                      key={char.name}
                                      onClick={() => toggleParticipant(char.name)}
                                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-700 font-bold' : 'bg-white border-[#EBEBEB] text-[#37352f]/60 hover:bg-gray-50'}`}
                                    >
                                      {char.name}
                                    </button>
                                  );
                                })}
                                {library.filter(e => e.type === 'character').length === 0 && (
                                  <span className="text-[10px] italic text-gray-400">Library is empty. Commit characters first.</span>
                                )}
                              </div>
                            </div>

                         
                            <div>
                              <label className="text-[9px] font-bold uppercase opacity-50 block mb-1">Link Location (Optional)</label>
                              <select 
                                className="w-full text-[12px] p-1.5 border border-[#EBEBEB] rounded bg-white outline-none"
                                value={editForm.location}
                                onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                              >
                                <option value="">-- No specific location (Abstract/Thought) --</option>
                                {library.filter(e => e.type === 'location').map(loc => (
                                  <option key={loc.name} value={loc.name}>{loc.name}</option>
                                ))}
                              </select>
                            </div>

                        
                            <div className="flex justify-end pt-1">
                              <button onClick={() => saveInlineEdit(s.id)} className="flex items-center gap-1 text-[10px] font-bold bg-[#37352f] text-white px-3 py-1.5 rounded hover:bg-black"><Save size={12}/> Save Event</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[12px] text-[#37352f]/60 mt-1 leading-relaxed">
                            {s.desc === 'Configured' ? <span className="italic text-emerald-600">Ready to commit.</span> : s.desc === 'Needs setup' ? <span className="italic text-amber-500 cursor-pointer" onClick={() => startEditing(s)}>Click pencil to configure...</span> : s.desc}
                          </div>
                        )}
                       
                          {s.type === 'contradiction' && (
                            <button 
                              onClick={() => setStaged(staged.filter(x => x.id !== s.id))} 
                              className="mt-2 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                            >
                              Mark as Fixed
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'library' && <WorldLibrary libraryData={library} onRefresh={fetchLibraryData} />}

       
        {view === 'generator' && <Generator libraryData={library} latestText={activeChapter?.content || ""} />}
        
      </div>
  

      {/* --- New character create window --- */}
      {setupEntity && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#EBEBEB] flex justify-between items-center bg-[#F7F7F5]">
              <h2 className="text-lg font-bold">Configure New Character</h2>
              <button onClick={() => setSetupEntity(null)}><X size={18}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase">Name</label>
                <input className="w-full mt-1 p-2 border border-[#EBEBEB] rounded-lg outline-none text-sm font-bold" 
                  value={setupEntity.title} onChange={(e) => setSetupEntity({...setupEntity, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold opacity-40 uppercase">Gender</label>
                  <input className="w-full mt-1 p-2 border border-[#EBEBEB] rounded-lg outline-none text-sm" 
                    value={setupEntity.gender || ""} onChange={(e) => setSetupEntity({...setupEntity, gender: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold opacity-40 uppercase">Speech Style</label>
                  <input className="w-full mt-1 p-2 border border-[#EBEBEB] rounded-lg outline-none text-sm" 
                    value={setupEntity.speech || ""} onChange={(e) => setSetupEntity({...setupEntity, speech: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase">Appearance & Gear</label>
                <textarea className="w-full mt-1 p-2 border border-[#EBEBEB] rounded-lg outline-none text-sm resize-none" rows={3}
                  value={setupEntity.appearance || ""} onChange={(e) => setSetupEntity({...setupEntity, appearance: e.target.value})} />
              </div>
            </div>

            <div className="p-4 border-t border-[#EBEBEB] bg-[#F7F7F5] flex justify-end gap-2">
              <button onClick={() => setSetupEntity(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={saveNewCharacterModal} className="px-4 py-2 text-sm font-bold bg-[#37352f] text-white hover:bg-black rounded-lg">Accept Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}