import os
import json
import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j import GraphDatabase
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uri = "bolt://localhost:7687"
try:
    driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))
except Exception as e:
    print(f"CONNECTION ERROR К NEO4J: {e}")

#--- PUT YOUR OWN API KEY---
genai.configure(api_key="YOUR_API_KEY`")
model = genai.GenerativeModel('gemini-3.1-pro-preview')

class AuditRequest(BaseModel):
    chapter_text: str

class MasterCommitRequest(BaseModel):
    chapter_title: str
    changes: list 

class GenerateRequest(BaseModel):
    prompt: str
    entities: list   
    style_reference: str = "" 


@app.post("/audit")
async def audit_chapter(payload: AuditRequest):
    lore_context = ""
    try:
        with driver.session() as session:
            names_result = session.run("MATCH (e:Entity) RETURN e.name as name")
            known_names = [r["name"] for r in names_result]
            active_names = [name for name in known_names if name.lower() in payload.chapter_text.lower()]
            
            print(f"Active entities detected: {active_names}")
            
            if active_names:
                profiles_query = """
                MATCH (e:Entity) WHERE e.name IN $names
                OPTIONAL MATCH (e)-[:HAS_TRAIT]->(t:Trait)
                RETURN e.name as name, e.appearance as appearance, e.gender as gender,
                       collect(DISTINCT t.desc) as traits
                """
                p_result = session.run(profiles_query, names=active_names)
                
                profiles_text = "CHARACTER PROFILES:\n"
                for r in p_result:
                    traits = ", ".join(r["traits"]) if r["traits"] else "None"
                    profiles_text += f"- {r['name']} ({r['gender']}): {r['appearance']}. Traits: {traits}\n"
                
           
                timeline_query = """
                MATCH (e:Entity)-[:PARTICIPATED_IN]->(ev:Event)
                WHERE e.name IN $names
                RETURN DISTINCT ev.desc as desc, ev.chapter as chapter, ev.timestamp as ts
                ORDER BY ev.timestamp ASC
                """
                t_result = session.run(timeline_query, names=active_names)
                
                timeline_text = "\nRELEVANT STORY TIMELINE:\n"
                for r in t_result:
                    timeline_text += f"- [{r['chapter']}] {r['desc']}\n"
                
                lore_context = profiles_text + timeline_text

    except Exception as e: 
        print(f"Lore extraction error: {e}")

    prompt = f"""
    You are a story editor. Analyze the text against the WORLD LORE.
    
    WORLD LORE:
    {lore_context if lore_context.strip() else "No lore exists yet. Everything is new."}
    
    RULES:
    1. NEVER create a 'new_character' if the name already exists in the WORLD LORE.
    2. Check for CONTRADICTIONS against the WORLD LORE (e.g., changed gender, wrong items, impossible actions).
    3. For plot events (actions, fights, dialogue outcomes): include the LOCATION name in 'location' if the event happens there!)
    4. CRITICAL: If an event affects a whole room/ship (e.g. engines turning on, an explosion), list ALL characters present in the scene as 'participants'.
    5. You MUST respond ONLY with a valid JSON ARRAY. Start with '[' and end with ']'. Do not use markdown bullet points like '-'.
    6. If you notice a specific, recurring behavioral pattern, speech quirk, or physical habit (e.g., 'always plays with a lighter', 'speaks in short sentences', 'hates magic'), create a 'trait' object. Do NOT invent traits from single normal actions.
    
    JSON FORMAT:
    [
      {{"type": "new_character", "title": "Name", "gender": "Male/Female", "appearance": "Description", "desc": "Needs setup"}},
      {{"type": "location", "title": "Name", "desc": "State of the place"}},
      {{"type": "event", "title": "Action", "desc": "What happened", "participants": ["Char1", "Char2"], "location": "Location Name"}}
      {{"type": "trait", "title": "Character Name", "desc": "The specific habit or quirk (e.g. 'Plays with a lighter')"}},
      {{"type": "contradiction", "title": "Lore Error", "desc": "Explanation", "participants": ["Affected Name"]}}
    ]
    
    NEW TEXT TO ANALYZE: 
    {payload.chapter_text}
    """
    
    try:
        response = model.generate_content(prompt)
        raw_output = response.text.strip()
        
        json_match = re.search(r'\[\s*\{.*\}\s*\]', raw_output, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
        else:
            clean_str = raw_output.replace("- {", "{")
            data = json.loads(f"[{clean_str}]" if not clean_str.startswith("[") else clean_str)

        import time
        valid_data = []
        for i, item in enumerate(data):
            if isinstance(item, dict):
                item['id'] = str(int(time.time() * 1000) + i)
                if 'type' in item:
                    item['type'] = str(item['type']).lower()
                if item.get('type') == 'new_character':
                     item['desc'] = 'Needs setup'
                valid_data.append(item)
        
        return {"changes": valid_data}
    except Exception as e:
        print(f"Audit error: {e}")
        return {"changes": []}


@app.post("/commit_all")
async def commit_all(payload: MasterCommitRequest):
    try:
        with driver.session() as session:
            for fact in payload.changes:
                ftype = fact.get('type', 'event')
                
                # --- locations ---
                if ftype == 'location':
                    session.run("""
                    MERGE (e:Entity {name: $name, type: 'location'})
                    SET e.appearance = $desc
                    """, name=fact.get('title', 'Unknown').strip(), desc=fact.get('desc', ''))


                # --- Characters ---
                elif ftype in ['character_ready', 'new_character']:
                    session.run("""
                    MERGE (e:Entity {name: $name})
                    SET e.type = 'character', e.gender = $gender, e.appearance = $appearance, e.speech = $speech
                    """, name=fact.get('title', 'Unknown'), 
                         gender=fact.get('gender', ''), 
                         appearance=fact.get('appearance', ''), 
                         speech=fact.get('speech', ''))
                
                # --- Events ---
                elif  ftype == 'event':
                    session.run("""MERGE (ev:Event {desc: $desc, chapter: $chapter})
                    ON CREATE SET ev.timestamp = timestamp()
                    """, desc=fact.get('desc'), chapter=payload.chapter_title)

                    participants = fact.get('participants', [])
                    if isinstance(participants, str): participants = [p.strip() for p in participants.split(',')]
                    
                    for person in participants:
                        if person and person != 'Unknown':
                            session.run("""
                            MERGE (e:Entity {name: $name})
                            ON CREATE SET e.type = 'character'
                            MATCH (ev:Event {desc: $desc, chapter: $chapter})
                            MERGE (e)-[:PARTICIPATED_IN]->(ev)
                            """, name=person.strip(), desc=fact.get('desc', ''), chapter=payload.chapter_title)
                            
                
                    location = fact.get('location', '')
                    if location and location != 'Unknown':
                        session.run("""
                        MERGE (loc:Entity {name: $loc_name})
                        ON CREATE SET loc.type = 'location'
                        MATCH (ev:Event {desc: $desc, chapter: $chapter})
                        MERGE (ev)-[:HAPPENED_AT]->(loc)
                        """, loc_name=location.strip(), desc=fact.get('desc'), chapter=payload.chapter_title)
                
                elif ftype == 'trait':
                    person_name = fact.get('title')
                    if person_name:
                        session.run("""
                        MERGE (e:Entity {name: $name})
                        ON CREATE SET e.type = 'character'
                        MERGE (t:Trait {desc: $desc})
                        MERGE (e)-[:HAS_TRAIT]->(t)
                        """, name=person_name, desc=fact.get('desc', ''))

                elif ftype == 'contradiction':
                    session.run("""
                    MERGE (err:Contradiction {desc: $desc, chapter: $chapter})
                    ON CREATE SET err.timestamp = timestamp()
                    """, desc=fact.get('desc'), chapter=payload.chapter_title)
                    
                    participants = fact.get('participants', [])
                    if isinstance(participants, str): participants = [p.strip() for p in participants.split(',')]
                    for person in participants:
                        if person:
                            session.run("""
                            MERGE (e:Entity {name: $name})
                            MATCH (err:Contradiction {desc: $desc, chapter: $chapter})
                            MERGE (err)-[:ABOUT]->(e)
                            """, name=person.strip(), desc=fact.get('desc'), chapter=payload.chapter_title)
        
        return {"status": "success"}
    except Exception as e:
        print(f"Commit error: {e}")
        return {"status": "error"}

@app.get("/library")
async def get_library():
    try:
        with driver.session() as session:
            query = """
            MATCH (e:Entity) 
            RETURN e.name as name, e.type as type, 
                   e.gender as gender, e.appearance as appearance, 
                   e.speech as speech
            """
            result = session.run(query)
            entities = []
            for r in result:
                entities.append({
                    "name": r["name"], 
                    "type": r["type"],
                    "gender": r["gender"] or "",
                    "appearance": r["appearance"] or "",
                    "speech": r["speech"] or ""
                })
            return {"entities": entities}
    except Exception as e:
        print(f"Library error: {e}")
        return {"entities": []}

@app.get("/entity_history/{name}")
async def get_entity_history(name: str):
    with driver.session() as session:
        ev_result = session.run("""
        MATCH (e:Entity {name: $name})-[:PARTICIPATED_IN]->(ev:Event) 
        RETURN ev.desc as desc, ev.chapter as chapter 
        ORDER BY ev.timestamp ASC
        """, name=name)
        history = [{"chapter": r["chapter"], "desc": r["desc"]} for r in ev_result]
                
        loc_result = session.run("""
        MATCH (ev:Event)-[:HAPPENED_AT]->(loc:Entity {name: $name})
        RETURN ev.desc as desc, ev.chapter as chapter 
        ORDER BY ev.timestamp ASC
        """, name=name)
        for r in loc_result:
            history.append({"chapter": r["chapter"], "desc": r["desc"]})
            
        t_result = session.run("MATCH (e:Entity {name: $name})-[:HAS_TRAIT]->(t:Trait) RETURN t.desc as desc", name=name)
        traits = [{"desc": r["desc"]} for r in t_result]

        return {"history": history, "traits": traits}
        

@app.delete("/entity/{name}")
async def delete_entity(name: str):
    with driver.session() as session:
        session.run("MATCH (e:Entity {name: $name}) DETACH DELETE e", name=name)
    return {"status": "deleted"}


@app.post("/generate")
async def generate_scene(payload: GenerateRequest):
    print(f"\n--- Generate scene ---")
    print(f"Request: {payload.prompt}")
    print(f"Choosen entities: {payload.entities}")

    lore_context = ""
    story_context = ""
    
    try:
        with driver.session() as session:
            #  GRAPH RAG
            if payload.entities:
                query_lore = """
                MATCH (e:Entity)
                WHERE e.name IN $names
                OPTIONAL MATCH (e)-[:PARTICIPATED_IN]->(ev:Event)
                OPTIONAL MATCH (e)-[:HAS_TRAIT]->(t:Trait)
                RETURN e.name as name, e.type as type, e.appearance as appearance, 
                       collect(DISTINCT ev.desc) as history,
                       collect(DISTINCT t.desc) as traits
                """
                result_lore = session.run(query_lore, names=payload.entities)
                for r in result_lore:
                    name = r["name"]
                    appr = r["appearance"] or "No description."
                    hist = " ".join(r["history"]) if r["history"] else "No past events."
                    traits = ", ".join(r["traits"]) if r["traits"] else "No traits."
                    lore_context += f"- {name}: {appr} | Traits/Behavior: {traits} | Recent: {hist}\n"
            
            # last 10 global events
            query_story = """
            MATCH (ev:Event)
            RETURN ev.desc as desc
            ORDER BY ev.timestamp DESC LIMIT 10
            """
            result_story = session.run(query_story)
            events = [r["desc"] for r in result_story]
            if events:
                events.reverse() 
                story_context = "\n".join(events)

    except Exception as e:
        print(f"Ошибка выгрузки RAG: {e}")

    
    ai_prompt = f"""
    You are an expert, creative AI co-author writing a novel. Write a scene based on the user's instructions.
    
    [STRICT WORLD LORE]
    These are facts about the selected characters/locations. DO NOT contradict this:
    {lore_context if lore_context else "No specific characters selected from library."}
    
    [STORY SO FAR (RECENT EVENTS)]
    Use this to understand the current context of the world:
    {story_context if story_context else "The story just started."}
    
    [USER INSTRUCTIONS FOR THE SCENE]
    {payload.prompt}
    
    RULES:
    1. Write engaging, vivid prose. 
    2. Focus on show, don't tell.
    3. Return ONLY the story text. No introductions, no meta-text like "Here is your scene".
    """
    if payload.style_reference:
        ai_prompt += f"\n\n[STYLE REFERENCE]\nMatch the tone of this text:\n{payload.style_reference}"
    
    try:
        response = model.generate_content(ai_prompt)
        return {"text": response.text.strip()}
    except Exception as e:
        print(f"Generate error: {e}")
        return {"error": "Failed to generate text."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8888, reload=True)