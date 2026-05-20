## Prerequisites 
1. **Docker** (for Neo4j database)
2. **Python 3.10+** (for Backend)
3. **Node.js** (for Frontend)

## Step 1: Start the Database (Neo4j)
Open your terminal and run this Docker command to start the graph database:
docker run --name neo4j-diploma -p 7474:7474 -p 7687:7687 -d --env NEO4J_AUTH=neo4j/password neo4j:latest

## Step 2: Start the Backend (FastAPI + AI)
1. Open a terminal and navigate to the `backend` folder: `cd backend`
2. Install the required Python libraries: 
   pip install fastapi uvicorn google-generativeai pydantic neo4j python-dotenv
3. Make sure the `.env` file is present in the `backend` folder with the `GEMINI_API_KEY`.
4. Run the server:
   python main.py
(The backend will run on http://127.0.0.1:8888)

## Step 3: Start the Frontend (React + Vite)
1. Open a new terminal window and navigate to the `frontend` folder: `cd frontend`
2. Install Node dependencies:
   npm install
3. Start the development server:
   npm run dev
4. Open the link provided in the terminal (usually http://localhost:5173) in your browser.

Now the app is fully functional!