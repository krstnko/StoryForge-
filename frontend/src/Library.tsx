import { useState, useEffect } from "react";
import { User, MapPin, X, Trash2 } from "lucide-react";

interface LibraryProps {
  libraryData: any[];
  onRefresh: () => void;
}

export default function Library({ libraryData, onRefresh }: LibraryProps) {
  const [libraryTab, setLibraryTab] = useState<"character" | "location">("character");
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [traits, setTraits] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); 

  const safeData = Array.isArray(libraryData) ? libraryData : [];

  useEffect(() => {
    if (selectedEntity) {
      setIsLoadingHistory(true);
      fetch(`http://127.0.0.1:8888/entity_history/${selectedEntity.name}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data.history || []);
          setTraits(data.traits || []); 
          setIsLoadingHistory(false);
        })
        .catch(() => {
          setHistory([]);
          setTraits([]); 
          setIsLoadingHistory(false);
        });
    } else {
      setHistory([]);
      setTraits([]);
    }
  }, [selectedEntity]);

  const handleDelete = async () => {
    const confirmDelete = window.confirm(`Delete ${selectedEntity.name} and all history?`);
    if (!confirmDelete) return;

    try {
      await fetch(`http://127.0.0.1:8888/entity/${selectedEntity.name}`, { method: "DELETE" });
      setSelectedEntity(null);
      onRefresh();
    } catch (err) {
      alert("Failed to delete entity");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="px-16 pt-16 pb-8 border-b border-[#EBEBEB]">
        <h1 className="text-4xl font-bold mb-8">World Library</h1>
        <div className="flex gap-6 border-b border-[#EBEBEB]">
          <button onClick={() => setLibraryTab("character")} className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${libraryTab === 'character' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Characters
          </button>
          <button onClick={() => setLibraryTab("location")} className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${libraryTab === 'location' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Locations
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-16 bg-[#FAFAFA]">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {safeData.filter(e => e.type === libraryTab).map(entity => (
            <button key={entity.name} onClick={() => setSelectedEntity(entity)} className="aspect-square bg-white border border-[#EBEBEB] rounded-2xl flex flex-col items-center justify-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
              <div className={`p-4 rounded-full ${entity.type === 'character' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                {entity.type === 'character' ? <User size={32}/> : <MapPin size={32}/>}
              </div>
              <span className="font-bold text-sm text-center px-4">{entity.name}</span>
            </button>
          ))}
          {safeData.filter(e => e.type === libraryTab).length === 0 && (
              <div className="col-span-full text-center py-10 text-gray-400">
                  No {libraryTab}s found.
              </div>
          )}
        </div>
      </div>

      {selectedEntity && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#EBEBEB] flex justify-between items-start bg-[#F7F7F5]">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full bg-white shadow-sm ${selectedEntity.type === 'character' ? 'text-blue-500' : 'text-emerald-500'}`}>
                  {selectedEntity.type === 'character' ? <User size={24}/> : <MapPin size={24}/>}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedEntity.name}</h2>
                  <span className="text-xs font-bold uppercase tracking-widest opacity-40">{selectedEntity.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={20}/></button>
                <button onClick={() => setSelectedEntity(null)} className="p-2 hover:bg-[#EBEBEB] rounded-full"><X size={20}/></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
               
               {/* Basic info */}
               <div>
                  <h3 className="text-[11px] font-bold opacity-40 uppercase tracking-widest mb-3">Base Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEntity.type === 'character' && (
                      <>
                        <div className="p-4 bg-[#F7F7F5] rounded-xl border border-[#EBEBEB]">
                          <div className="text-[10px] font-bold opacity-40 uppercase mb-1">Gender</div>
                          <div className="text-sm font-medium">{selectedEntity.gender || "Not specified"}</div>
                        </div>
                        <div className="p-4 bg-[#F7F7F5] rounded-xl border border-[#EBEBEB]">
                          <div className="text-[10px] font-bold opacity-40 uppercase mb-1">Speech Style</div>
                          <div className="text-sm font-medium">{selectedEntity.speech || "Not specified"}</div>
                        </div>
                      </>
                    )}
                    <div className="col-span-full p-4 bg-[#F7F7F5] rounded-xl border border-[#EBEBEB]">
                      <div className="text-[10px] font-bold opacity-40 uppercase mb-1">Appearance / Description</div>
                      <div className="text-sm leading-relaxed">{selectedEntity.appearance || "No description available."}</div>
                    </div>
                  </div>
               </div>
                {/*  TRAITS */}
               {selectedEntity.type === 'character' && (
                 <div>
                    <h3 className="text-[11px] font-bold opacity-40 uppercase tracking-widest mb-3">Character Profile / Traits</h3>
                    {traits.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm space-y-2 text-[#37352f]/80">
                        {traits.map((t, i) => <li key={i}>{t.desc}</li>)}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-400 italic bg-[#F7F7F5] p-3 rounded-lg border border-dashed border-[#EBEBEB]">No specific traits recorded.</div>
                    )}
                 </div>
               )}
               {/* Evolution */}
               <div>
                 <h3 className="text-[11px] font-bold opacity-40 uppercase tracking-widest mb-4">Evolution / Events</h3>
                 <div className="space-y-4 border-l-2 border-[#EBEBEB] ml-2 pl-6 relative">
                    {isLoadingHistory ? (
                      <div className="text-sm text-gray-400">Loading events...</div>
                    ) : history.length > 0 ? history.map((event, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[31px] top-1.5 w-3 h-3 bg-white border-2 border-[#37352f] rounded-full" />
                        <div className="text-xs font-bold italic opacity-40 mb-1">{event.chapter}</div>
                        <div className="text-sm bg-white border border-[#EBEBEB] p-3 rounded-lg shadow-sm leading-relaxed">
                          {event.desc}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-400">No events recorded yet.</div>
                    )}
                 </div>
               </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}