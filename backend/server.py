from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import socketio
import httpx
import random
import statistics
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# Try to import stockfish
try:
    from stockfish import Stockfish
    STOCKFISH_PATH = "/usr/games/stockfish"
    STOCKFISH_AVAILABLE = os.path.exists(STOCKFISH_PATH)
except ImportError:
    STOCKFISH_AVAILABLE = False
    STOCKFISH_PATH = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'stakechess-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Parse CORS origins for both Socket.IO and FastAPI middleware
cors_origins_raw = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001')
cors_origins_list = [origin.strip() for origin in cors_origins_raw.split(',') if origin.strip()]
if not cors_origins_list:
    cors_origins_list = ['http://localhost:3000', 'http://localhost:3001']

# Socket.IO server - configured for proxy/kubernetes environment
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=cors_origins_list,
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e6,
    # Allow both transports for compatibility
    transports=['polling', 'websocket']
)

# Create the main app
app = FastAPI(title="StakeChess API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize scheduler for automated tournaments
scheduler = AsyncIOScheduler()

# Stockfish engine instance (lazy loaded)
stockfish_engine = None

def get_stockfish():
    """Get or create Stockfish engine instance"""
    global stockfish_engine
    if STOCKFISH_AVAILABLE and stockfish_engine is None:
        try:
            stockfish_engine = Stockfish(
                path=STOCKFISH_PATH,
                depth=15,
                parameters={"Threads": 1, "Hash": 64}
            )
            logger.info("Stockfish engine initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Stockfish: {e}")
            return None
    return stockfish_engine

# ============= MODELS =============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    username: str
    email: str
    rating: int = 1200
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    wallet_balance: Dict[str, float] = Field(default_factory=lambda: {"USDT": 0, "BTC": 0, "ETH": 0})
    created_at: Optional[str] = None
    is_admin: bool = False
    is_flagged: bool = False
    is_banned: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class GameCreate(BaseModel):
    time_control: str = "10+0"
    stake_amount: float = 0
    stake_currency: str = "USDT"
    is_private: bool = False
    game_type: str = "rapid"

class GameResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str
    white_player: Optional[Dict] = None
    black_player: Optional[Dict] = None
    time_control: str
    stake_amount: float
    stake_currency: str
    arbiter_fee: float = 0.02
    status: str = "waiting"
    fen: str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    moves: List[str] = []
    move_times: List[float] = []
    white_time: int = 600
    black_time: int = 600
    current_turn: str = "white"
    result: Optional[str] = None
    winner_id: Optional[str] = None
    created_at: str
    is_private: bool = False
    game_type: str = "rapid"
    tournament_id: Optional[str] = None

class MoveRequest(BaseModel):
    game_id: str
    move: str
    fen: str
    move_time: Optional[float] = None

class WalletTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tx_id: str
    user_id: str
    tx_type: str
    amount: float
    currency: str
    status: str = "completed"
    created_at: str
    related_game_id: Optional[str] = None

class DepositRequest(BaseModel):
    amount: float
    currency: str

class WithdrawRequest(BaseModel):
    amount: float
    currency: str
    wallet_address: str
    withdrawal_method: str = "crypto"  # crypto, bank_transfer, etc.

class WithdrawStatusUpdate(BaseModel):
    status: str  # confirmed, rejected
    admin_note: Optional[str] = None

class AdminSettingsUpdate(BaseModel):
    arbiter_fee: Optional[float] = None
    min_stake: Optional[float] = None
    max_stake: Optional[float] = None

class TournamentCreate(BaseModel):
    name: str
    time_control: str = "3+2"
    entry_fee: float = 5.0
    entry_currency: str = "USDT"
    min_players: int = 4
    max_players: int = 64
    tournament_type: str = "arena"
    start_time: Optional[str] = None
    duration_minutes: int = 60

class TournamentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tournament_id: str
    name: str
    time_control: str
    entry_fee: float
    entry_currency: str
    prize_pool: float = 0
    min_players: int
    max_players: int
    current_players: int = 0
    tournament_type: str
    status: str = "upcoming"
    start_time: str
    end_time: Optional[str] = None
    duration_minutes: int
    created_at: str
    players: List[Dict] = []
    leaderboard: List[Dict] = []

# ============= HELPER FUNCTIONS =============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            # Check if banned
            if user.get("is_banned"):
                raise HTTPException(status_code=403, detail="Account suspended")
            return user
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_banned"):
            raise HTTPException(status_code=403, detail="Account suspended")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def calculate_elo_change(winner_rating: int, loser_rating: int, k: int = 32) -> tuple:
    expected_winner = 1 / (1 + 10 ** ((loser_rating - winner_rating) / 400))
    expected_loser = 1 - expected_winner
    winner_change = round(k * (1 - expected_winner))
    loser_change = round(k * (0 - expected_loser))
    return winner_change, loser_change

# ============= ANTI-CHEAT FUNCTIONS =============

def analyze_moves_with_stockfish(moves: List[str], fen_positions: List[str] = None) -> Dict:
    """Analyze game moves using Stockfish engine"""
    engine = get_stockfish()
    if not engine:
        return {"engine_available": False, "accuracy": None, "cpl": None}
    
    try:
        from chess import Board
        board = Board()
        
        total_cpl = 0  # Centipawn loss
        engine_matches = 0
        analyzed_moves = 0
        
        for i, move_uci in enumerate(moves):
            try:
                # Set position
                engine.set_fen_position(board.fen())
                
                # Get engine's best move
                best_move = engine.get_best_move()
                
                # Get evaluation before move
                eval_before = engine.get_evaluation()
                
                # Make the player's move
                board.push_uci(move_uci)
                
                # Get evaluation after move
                engine.set_fen_position(board.fen())
                eval_after = engine.get_evaluation()
                
                # Calculate centipawn loss
                if eval_before and eval_after:
                    if eval_before.get("type") == "cp" and eval_after.get("type") == "cp":
                        # Calculate CPL from perspective of player who moved
                        cpl = abs(eval_before["value"] - eval_after["value"])
                        total_cpl += min(cpl, 500)  # Cap at 500 to avoid blunders skewing
                        analyzed_moves += 1
                
                # Check if move matched engine recommendation
                if best_move == move_uci:
                    engine_matches += 1
                    
            except Exception as e:
                logger.debug(f"Move analysis error: {e}")
                continue
        
        avg_cpl = total_cpl / analyzed_moves if analyzed_moves > 0 else None
        accuracy = (engine_matches / len(moves) * 100) if moves else 0
        
        return {
            "engine_available": True,
            "accuracy": accuracy,
            "cpl": avg_cpl,
            "engine_matches": engine_matches,
            "total_moves": len(moves),
            "analyzed_moves": analyzed_moves
        }
    except Exception as e:
        logger.error(f"Stockfish analysis error: {e}")
        return {"engine_available": False, "error": str(e)}

async def analyze_player_behavior(user_id: str) -> Dict:
    """Analyze player for potential cheating"""
    # Get recent games
    games = await db.games.find({
        "$or": [
            {"white_player.user_id": user_id},
            {"black_player.user_id": user_id}
        ],
        "status": "completed"
    }, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    if len(games) < 5:
        return {"flagged": False, "reasons": [], "score": 0}
    
    reasons = []
    score = 0
    
    # 1. Win Rate Analysis
    wins = sum(1 for g in games if g.get("winner_id") == user_id)
    win_rate = wins / len(games)
    
    if win_rate > 0.9 and len(games) >= 10:
        reasons.append(f"Suspicious win rate: {win_rate*100:.1f}%")
        score += 30
    
    # 2. Move Time Consistency Analysis
    all_move_times = []
    for game in games:
        is_white = game.get("white_player", {}).get("user_id") == user_id
        move_times = game.get("move_times", [])
        # Get player's move times (odd indices for white, even for black)
        start_idx = 0 if is_white else 1
        player_times = move_times[start_idx::2] if move_times else []
        all_move_times.extend(player_times)
    
    if len(all_move_times) >= 20:
        # Check for unnaturally consistent timing
        try:
            std_dev = statistics.stdev(all_move_times)
            mean_time = statistics.mean(all_move_times)
            cv = std_dev / mean_time if mean_time > 0 else 0
            
            # Engine users often have very consistent timing
            if cv < 0.15 and mean_time < 3:
                reasons.append(f"Suspicious move timing consistency (CV: {cv:.2f})")
                score += 25
        except:
            pass
    
    # 3. Rapid improvement detection
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        created_at = user.get("created_at")
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            days_since_creation = (datetime.now(timezone.utc) - created_at.replace(tzinfo=timezone.utc)).days
            
            # New account with high rating is suspicious
            if days_since_creation < 7 and user.get("rating", 1200) > 1600:
                reasons.append(f"New account with high rating ({user.get('rating')})")
                score += 20
    
    # 4. Check for abandonment pattern (potential match fixing)
    abandoned_games = await db.games.count_documents({
        "$or": [
            {"white_player.user_id": user_id},
            {"black_player.user_id": user_id}
        ],
        "end_reason": "abandonment",
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    })
    
    if abandoned_games >= 3:
        reasons.append(f"Multiple abandoned games: {abandoned_games}")
        score += 15
    
    # 5. Stockfish-based move accuracy analysis
    if STOCKFISH_AVAILABLE:
        # Get the most recent game with moves
        recent_game = None
        for game in games:
            if game.get("moves") and len(game.get("moves", [])) >= 10:
                recent_game = game
                break
        
        if recent_game:
            is_white = recent_game.get("white_player", {}).get("user_id") == user_id
            # Get player's moves (alternating)
            all_moves = recent_game.get("moves", [])
            player_moves = all_moves[0::2] if is_white else all_moves[1::2]
            
            if len(player_moves) >= 5:
                # Run Stockfish analysis on game
                analysis = analyze_moves_with_stockfish(all_moves)
                
                if analysis.get("engine_available"):
                    accuracy = analysis.get("accuracy", 0)
                    cpl = analysis.get("cpl")
                    
                    # Very high accuracy (>90%) is suspicious
                    if accuracy >= 90:
                        reasons.append(f"Engine-like move accuracy: {accuracy:.1f}%")
                        score += 35
                    elif accuracy >= 80:
                        reasons.append(f"High move accuracy: {accuracy:.1f}%")
                        score += 15
                    
                    # Very low centipawn loss is suspicious
                    if cpl is not None and cpl < 15:
                        reasons.append(f"Suspicious low centipawn loss: {cpl:.1f}")
                        score += 25
    
    return {
        "flagged": score >= 50,
        "reasons": reasons,
        "score": score,
        "stockfish_available": STOCKFISH_AVAILABLE
    }

async def flag_suspicious_player(user_id: str, reasons: List[str]):
    """Flag a player for admin review"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_flagged": True}}
    )
    
    await db.anticheat_flags.insert_one({
        "flag_id": f"flag_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "reasons": reasons,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.warning(f"Player {user_id} flagged for review: {reasons}")

# ============= SECURITY FUNCTIONS =============

async def check_ip_abuse(request: Request, user_id: str) -> bool:
    """Check for multiple accounts from same IP"""
    client_ip = request.client.host if request.client else "unknown"
    
    # Record IP
    await db.user_ips.update_one(
        {"user_id": user_id},
        {
            "$set": {"last_ip": client_ip, "updated_at": datetime.now(timezone.utc).isoformat()},
            "$addToSet": {"ips": client_ip}
        },
        upsert=True
    )
    
    # Check if IP has multiple accounts
    accounts_with_ip = await db.user_ips.count_documents({"ips": client_ip})
    
    if accounts_with_ip > 3:
        await db.security_alerts.insert_one({
            "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
            "type": "multiple_accounts",
            "ip": client_ip,
            "user_id": user_id,
            "accounts_count": accounts_with_ip,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return True
    
    return False

async def apply_abandonment_penalty(user_id: str, game_id: str, stake_amount: float, currency: str):
    """Apply penalty for abandoning a game"""
    # Forfeit stake
    if stake_amount > 0:
        # Winner gets the pot
        game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
        if game:
            opponent_id = None
            if game["white_player"]["user_id"] == user_id:
                opponent_id = game["black_player"]["user_id"]
            else:
                opponent_id = game["white_player"]["user_id"]
            
            if opponent_id:
                total_pot = stake_amount * 2
                arbiter_fee = total_pot * 0.02
                winner_amount = total_pot - arbiter_fee
                
                await db.users.update_one(
                    {"user_id": opponent_id},
                    {"$inc": {f"wallet_balance.{currency}": winner_amount}}
                )
    
    # Record abandonment
    await db.abandonments.insert_one({
        "user_id": user_id,
        "game_id": game_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check total abandonments
    total_abandonments = await db.abandonments.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    })
    
    # Auto-ban if too many abandonments
    if total_abandonments >= 5:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"is_banned": True, "ban_reason": "Excessive game abandonment"}}
        )
        logger.warning(f"User {user_id} auto-banned for excessive abandonment")

# ============= AUTH ROUTES =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(request: Request, user_data: UserCreate):
    existing_user = await db.users.find_one({"$or": [
        {"email": user_data.email},
        {"username": user_data.name}
    ]})
    
    if existing_user:
        if existing_user.get("email") == user_data.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = get_password_hash(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "username": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "rating": 1200,
        "games_played": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "wallet_balance": {"USDT": 100.0, "BTC": 0.001, "ETH": 0.01},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_admin": False,
        "is_flagged": False,
        "is_banned": False
    }
    
    await db.users.insert_one(user_doc)
    
    # Track IP
    await check_ip_abuse(request, user_id)
    
    access_token = create_access_token({"sub": user_id})
    
    user_doc.pop("password", None)
    user_doc.pop("_id", None)
    
    return TokenResponse(access_token=access_token, user=UserResponse(**user_doc))

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(request: Request, user_data: UserLogin, response: Response):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    
    if not user or not verify_password(user_data.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    # Track IP
    await check_ip_abuse(request, user["user_id"])
    
    access_token = create_access_token({"sub": user["user_id"]})
    
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600
    )
    
    user.pop("password", None)
    
    return TokenResponse(access_token=access_token, user=UserResponse(**user))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    user.pop("password", None)
    return UserResponse(**user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            oauth_data = resp.json()
        except Exception as e:
            logger.error(f"OAuth error: {e}")
            raise HTTPException(status_code=401, detail="OAuth validation failed")
    
    email = oauth_data.get("email")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "username": oauth_data.get("name", email.split("@")[0]),
            "email": email,
            "picture": oauth_data.get("picture"),
            "rating": 1200,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "wallet_balance": {"USDT": 100.0, "BTC": 0.001, "ETH": 0.01},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_admin": False,
            "is_flagged": False,
            "is_banned": False
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    session_token = oauth_data.get("session_token")
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    
    user.pop("password", None)
    return UserResponse(**user)

# ============= GAME ROUTES =============

@api_router.post("/games", response_model=GameResponse)
async def create_game(game_data: GameCreate, request: Request):
    user = await get_current_user(request)
    
    parts = game_data.time_control.split("+")
    base_time = int(parts[0]) * 60
    
    if game_data.stake_amount > 0:
        balance = user.get("wallet_balance", {}).get(game_data.stake_currency, 0)
        if balance < game_data.stake_amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {f"wallet_balance.{game_data.stake_currency}": -game_data.stake_amount}}
        )
        
        await db.transactions.insert_one({
            "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "tx_type": "stake",
            "amount": -game_data.stake_amount,
            "currency": game_data.stake_currency,
            "status": "escrow",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    game_doc = {
        "game_id": game_id,
        "white_player": {
            "user_id": user["user_id"],
            "username": user["username"],
            "rating": user.get("rating", 1200)
        },
        "black_player": None,
        "time_control": game_data.time_control,
        "stake_amount": game_data.stake_amount,
        "stake_currency": game_data.stake_currency,
        "arbiter_fee": 0.02,
        "status": "waiting",
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "moves": [],
        "move_times": [],
        "white_time": base_time,
        "black_time": base_time,
        "current_turn": "white",
        "result": None,
        "winner_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_private": game_data.is_private,
        "game_type": game_data.game_type,
        "tournament_id": None
    }
    
    await db.games.insert_one(game_doc)
    game_doc.pop("_id", None)
    
    return GameResponse(**game_doc)

@api_router.post("/games/{game_id}/join", response_model=GameResponse)
async def join_game(game_id: str, request: Request):
    user = await get_current_user(request)
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game is not available to join")
    
    if game["white_player"]["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot join your own game")
    
    if game["stake_amount"] > 0:
        balance = user.get("wallet_balance", {}).get(game["stake_currency"], 0)
        if balance < game["stake_amount"]:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {f"wallet_balance.{game['stake_currency']}": -game["stake_amount"]}}
        )
        
        await db.transactions.insert_one({
            "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "tx_type": "stake",
            "amount": -game["stake_amount"],
            "currency": game["stake_currency"],
            "status": "escrow",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "related_game_id": game_id
        })
    
    await db.games.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "black_player": {
                    "user_id": user["user_id"],
                    "username": user["username"],
                    "rating": user.get("rating", 1200)
                },
                "status": "active",
                "started_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    # Emit player_joined event for real-time update
    await sio.emit('player_joined', {
        "game_id": game_id,
        "username": user["username"],
        "user_id": user["user_id"]
    }, room=game_id)
    
    # Emit game_started event with full game data
    await sio.emit('game_started', game, room=game_id)
    
    return GameResponse(**game)

@api_router.get("/games", response_model=List[GameResponse])
async def list_games(status: Optional[str] = None, game_type: Optional[str] = None):
    query = {"is_private": False, "tournament_id": None}
    if status:
        query["status"] = status
    if game_type:
        query["game_type"] = game_type
    
    games = await db.games.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return [GameResponse(**g) for g in games]

@api_router.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return GameResponse(**game)

@api_router.post("/games/{game_id}/move")
async def make_move(game_id: str, move_data: MoveRequest, request: Request):
    user = await get_current_user(request)
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game is not active")
    
    current_player = game["white_player"] if game["current_turn"] == "white" else game["black_player"]
    if current_player["user_id"] != user["user_id"]:
        raise HTTPException(status_code=400, detail="Not your turn")
    
    next_turn = "black" if game["current_turn"] == "white" else "white"
    
    # Record move time for anti-cheat
    move_time = move_data.move_time if move_data.move_time else 0
    
    await db.games.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "fen": move_data.fen,
                "current_turn": next_turn
            },
            "$push": {
                "moves": move_data.move,
                "move_times": move_time
            }
        }
    )
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    # Compute explicit room name used for emits
    room_name = str(game_id)
    room_clients = game_connections.get(room_name, set())
    payload = {
        "game_id": game_id,
        "move": move_data.move,
        "fen": move_data.fen,
        "current_turn": next_turn
    }
    logger.info(f"🎯 About to emit move_made to room '{room_name}': payload={payload}, clients_in_room={len(room_clients)}")
    print(f"[PRINT] 🎯 About to emit move_made to room '{room_name}': payload={payload}, clients_in_room={len(room_clients)}")
    
    await sio.emit('move_made', payload, room=room_name)
    
    logger.info(f"✅ Emitted move_made to room '{room_name}'")
    print(f"[PRINT] ✅ Emitted move_made to room '{room_name}'")
    
    return {"success": True, "game": GameResponse(**game)}

@api_router.post("/games/{game_id}/end")
async def end_game(game_id: str, request: Request):
    body = await request.json()
    result = body.get("result")
    reason = body.get("reason", "checkmate")
    
    user = await get_current_user(request)
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game is not active")
    
    player_ids = [game["white_player"]["user_id"], game["black_player"]["user_id"]]
    if user["user_id"] not in player_ids:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    
    winner_id = None
    loser_id = None
    
    if result == "white":
        winner_id = game["white_player"]["user_id"]
        loser_id = game["black_player"]["user_id"]
    elif result == "black":
        winner_id = game["black_player"]["user_id"]
        loser_id = game["white_player"]["user_id"]
    
    await db.games.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "status": "completed",
                "result": result,
                "winner_id": winner_id,
                "end_reason": reason,
                "ended_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Handle stake distribution
    if game["stake_amount"] > 0:
        total_pot = game["stake_amount"] * 2
        arbiter_fee = total_pot * game["arbiter_fee"]
        winner_amount = total_pot - arbiter_fee
        
        if winner_id:
            await db.users.update_one(
                {"user_id": winner_id},
                {"$inc": {f"wallet_balance.{game['stake_currency']}": winner_amount}}
            )
            
            await db.transactions.insert_one({
                "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
                "user_id": winner_id,
                "tx_type": "win",
                "amount": winner_amount,
                "currency": game["stake_currency"],
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "related_game_id": game_id
            })
            
            await db.platform_revenue.insert_one({
                "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
                "amount": arbiter_fee,
                "currency": game["stake_currency"],
                "game_id": game_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            for player_id in player_ids:
                await db.users.update_one(
                    {"user_id": player_id},
                    {"$inc": {f"wallet_balance.{game['stake_currency']}": game["stake_amount"]}}
                )
    
    # Update ELO ratings
    if winner_id and loser_id:
        winner = await db.users.find_one({"user_id": winner_id}, {"_id": 0})
        loser = await db.users.find_one({"user_id": loser_id}, {"_id": 0})
        
        winner_change, loser_change = calculate_elo_change(
            winner.get("rating", 1200),
            loser.get("rating", 1200)
        )
        
        await db.users.update_one(
            {"user_id": winner_id},
            {"$inc": {"rating": winner_change, "games_played": 1, "wins": 1}}
        )
        
        await db.users.update_one(
            {"user_id": loser_id},
            {"$inc": {"rating": loser_change, "games_played": 1, "losses": 1}}
        )
        
        # Anti-cheat analysis after game
        analysis = await analyze_player_behavior(winner_id)
        if analysis["flagged"]:
            await flag_suspicious_player(winner_id, analysis["reasons"])
    elif result == "draw":
        for player_id in player_ids:
            await db.users.update_one(
                {"user_id": player_id},
                {"$inc": {"games_played": 1, "draws": 1}}
            )
    
    await sio.emit('game_ended', {
        "game_id": game_id,
        "result": result,
        "winner_id": winner_id,
        "reason": reason
    }, room=game_id)
    
    return {"success": True}

@api_router.post("/games/{game_id}/resign")
async def resign_game(game_id: str, request: Request):
    user = await get_current_user(request)
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["white_player"]["user_id"] == user["user_id"]:
        result = "black"
    elif game["black_player"]["user_id"] == user["user_id"]:
        result = "white"
    else:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    
    # Create a new mock request with the result data
    class MockRequest:
        def __init__(self, original_request, body_data):
            self.cookies = original_request.cookies
            self.headers = original_request.headers
            self._body_data = body_data
        
        async def json(self):
            return self._body_data
    
    mock_req = MockRequest(request, {"result": result, "reason": "resignation"})
    return await end_game(game_id, mock_req)

@api_router.post("/games/{game_id}/abandon")
async def abandon_game(game_id: str, request: Request):
    """Handle game abandonment with penalties"""
    user = await get_current_user(request)
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Game is not active")
    
    # Apply abandonment penalty
    await apply_abandonment_penalty(
        user["user_id"],
        game_id,
        game["stake_amount"],
        game["stake_currency"]
    )
    
    # End the game
    if game["white_player"]["user_id"] == user["user_id"]:
        result = "black"
    else:
        result = "white"
    
    await db.games.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "status": "completed",
                "result": result,
                "end_reason": "abandonment",
                "ended_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Emit game_ended event for real-time update
    await sio.emit('game_ended', {
        "game_id": game_id,
        "result": result,
        "reason": "abandonment"
    }, room=game_id)
    
    return {"success": True}

# ============= TOURNAMENT ROUTES =============

@api_router.post("/tournaments", response_model=TournamentResponse)
async def create_tournament(tournament_data: TournamentCreate, request: Request):
    await get_admin_user(request)
    
    tournament_id = f"tourney_{uuid.uuid4().hex[:12]}"
    
    start_time = tournament_data.start_time
    if not start_time:
        start_time = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    tournament_doc = {
        "tournament_id": tournament_id,
        "name": tournament_data.name,
        "time_control": tournament_data.time_control,
        "entry_fee": tournament_data.entry_fee,
        "entry_currency": tournament_data.entry_currency,
        "prize_pool": 0,
        "min_players": tournament_data.min_players,
        "max_players": tournament_data.max_players,
        "current_players": 0,
        "tournament_type": tournament_data.tournament_type,
        "status": "upcoming",
        "start_time": start_time,
        "end_time": None,
        "duration_minutes": tournament_data.duration_minutes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "players": [],
        "leaderboard": []
    }
    
    await db.tournaments.insert_one(tournament_doc)
    tournament_doc.pop("_id", None)
    
    return TournamentResponse(**tournament_doc)

@api_router.get("/tournaments", response_model=List[TournamentResponse])
async def list_tournaments(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    
    tournaments = await db.tournaments.find(query, {"_id": 0}).sort("start_time", 1).limit(20).to_list(20)
    return [TournamentResponse(**t) for t in tournaments]

@api_router.get("/tournaments/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(tournament_id: str):
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return TournamentResponse(**tournament)

@api_router.post("/tournaments/{tournament_id}/join")
async def join_tournament(tournament_id: str, request: Request):
    user = await get_current_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] not in ["upcoming", "active"]:
        raise HTTPException(status_code=400, detail="Cannot join this tournament")
    
    if tournament["current_players"] >= tournament["max_players"]:
        raise HTTPException(status_code=400, detail="Tournament is full")
    
    # Check if already joined
    if any(p["user_id"] == user["user_id"] for p in tournament.get("players", [])):
        raise HTTPException(status_code=400, detail="Already joined this tournament")
    
    # Deduct entry fee
    if tournament["entry_fee"] > 0:
        balance = user.get("wallet_balance", {}).get(tournament["entry_currency"], 0)
        if balance < tournament["entry_fee"]:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {f"wallet_balance.{tournament['entry_currency']}": -tournament["entry_fee"]}}
        )
        
        await db.transactions.insert_one({
            "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "tx_type": "tournament_entry",
            "amount": -tournament["entry_fee"],
            "currency": tournament["entry_currency"],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "related_tournament_id": tournament_id
        })
    
    # Add player
    player_entry = {
        "user_id": user["user_id"],
        "username": user["username"],
        "rating": user.get("rating", 1200),
        "score": 0,
        "games_played": 0,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {
            "$push": {"players": player_entry, "leaderboard": player_entry},
            "$inc": {"current_players": 1, "prize_pool": tournament["entry_fee"]}
        }
    )
    
    return {"success": True, "message": "Joined tournament successfully"}

@api_router.post("/tournaments/{tournament_id}/start")
async def start_tournament(tournament_id: str, request: Request):
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Tournament already started")
    
    if tournament["current_players"] < tournament["min_players"]:
        raise HTTPException(status_code=400, detail="Not enough players")
    
    end_time = (datetime.now(timezone.utc) + timedelta(minutes=tournament["duration_minutes"])).isoformat()
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {
            "$set": {
                "status": "active",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": end_time
            }
        }
    )
    
    return {"success": True}

@api_router.post("/tournaments/{tournament_id}/end")
async def end_tournament(tournament_id: str, request: Request):
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")
    
    # Distribute prizes
    prize_pool = tournament["prize_pool"]
    leaderboard = sorted(tournament.get("leaderboard", []), key=lambda x: -x.get("score", 0))
    
    if len(leaderboard) >= 1 and prize_pool > 0:
        # 1st place: 50%, 2nd: 30%, 3rd: 20%
        distributions = [0.5, 0.3, 0.2]
        for i, pct in enumerate(distributions):
            if i < len(leaderboard):
                winner = leaderboard[i]
                prize = prize_pool * pct
                
                await db.users.update_one(
                    {"user_id": winner["user_id"]},
                    {"$inc": {f"wallet_balance.{tournament['entry_currency']}": prize}}
                )
                
                await db.transactions.insert_one({
                    "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
                    "user_id": winner["user_id"],
                    "tx_type": "tournament_prize",
                    "amount": prize,
                    "currency": tournament["entry_currency"],
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "related_tournament_id": tournament_id
                })
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {
            "$set": {
                "status": "completed",
                "end_time": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True}

# ============= WALLET ROUTES =============

@api_router.post("/wallet/deposit")
async def deposit(deposit_data: DepositRequest, request: Request):
    user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {f"wallet_balance.{deposit_data.currency}": deposit_data.amount}}
    )
    
    await db.transactions.insert_one({
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "tx_type": "deposit",
        "amount": deposit_data.amount,
        "currency": deposit_data.currency,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"success": True, "wallet_balance": updated_user.get("wallet_balance")}

@api_router.post("/wallet/withdraw")
async def withdraw(withdraw_data: WithdrawRequest, request: Request):
    user = await get_current_user(request)
    
    balance = user.get("wallet_balance", {}).get(withdraw_data.currency, 0)
    if balance < withdraw_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Deduct balance immediately (will be refunded if rejected)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {f"wallet_balance.{withdraw_data.currency}": -withdraw_data.amount}}
    )
    
    # Create withdrawal request
    withdrawal_id = f"wd_{uuid.uuid4().hex[:12]}"
    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "username": user["username"],
        "amount": withdraw_data.amount,
        "currency": withdraw_data.currency,
        "withdrawal_method": withdraw_data.withdrawal_method,
        "wallet_address": withdraw_data.wallet_address,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
        "confirmed_at": None,
        "admin_note": None
    }
    
    await db.withdrawals.insert_one(withdrawal)
    
    # Also create a transaction record
    await db.transactions.insert_one({
        "tx_id": withdrawal["tx_id"],
        "user_id": user["user_id"],
        "tx_type": "withdraw",
        "amount": -withdraw_data.amount,
        "currency": withdraw_data.currency,
        "status": "pending",
        "wallet_address": withdraw_data.wallet_address,
        "withdrawal_id": withdrawal_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify admins via WebSocket
    await sio.emit('new_withdrawal', {
        "withdrawal_id": withdrawal_id,
        "user_id": user["user_id"],
        "username": user["username"],
        "amount": withdraw_data.amount,
        "currency": withdraw_data.currency,
        "wallet_address": withdraw_data.wallet_address,
        "created_at": withdrawal["created_at"]
    }, room="admin_room")
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "success": True, 
        "wallet_balance": updated_user.get("wallet_balance"),
        "withdrawal_id": withdrawal_id,
        "message": "Withdrawal request submitted. Pending admin confirmation."
    }

@api_router.get("/wallet/transactions")
async def get_transactions(request: Request):
    user = await get_current_user(request)
    
    transactions = await db.transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return transactions

# ============= COMPUTER PLAY ROUTES =============

class ComputerMoveRequest(BaseModel):
    fen: str
    depth: int = 10

@api_router.post("/computer/move")
async def get_computer_move(move_req: ComputerMoveRequest):
    """Get best move from Stockfish for computer play"""
    if not STOCKFISH_AVAILABLE:
        # Fallback: return a random legal move using python-chess
        import chess
        board = chess.Board(move_req.fen)
        legal_moves = list(board.legal_moves)
        if not legal_moves:
            raise HTTPException(status_code=400, detail="No legal moves available")
        import random
        move = random.choice(legal_moves)
        return {"move": move.uci(), "source": "random"}
    
    try:
        stockfish = Stockfish(path=STOCKFISH_PATH, depth=move_req.depth)
        stockfish.set_fen_position(move_req.fen)
        
        # Set parameters based on depth (simulates different difficulty levels)
        if move_req.depth <= 3:
            stockfish.set_skill_level(1)
        elif move_req.depth <= 6:
            stockfish.set_skill_level(5)
        elif move_req.depth <= 12:
            stockfish.set_skill_level(12)
        else:
            stockfish.set_skill_level(20)
        
        best_move = stockfish.get_best_move()
        
        if not best_move:
            raise HTTPException(status_code=400, detail="No move available")
        
        return {"move": best_move, "source": "stockfish"}
    except Exception as e:
        logger.error(f"Stockfish error: {e}")
        # Fallback to random
        import chess
        board = chess.Board(move_req.fen)
        legal_moves = list(board.legal_moves)
        if not legal_moves:
            raise HTTPException(status_code=400, detail="No legal moves available")
        import random
        move = random.choice(legal_moves)
        return {"move": move.uci(), "source": "random_fallback"}

# ============= LEADERBOARD ROUTES =============

@api_router.get("/leaderboard")
async def get_leaderboard(sort_by: str = "rating", limit: int = 20):
    sort_field = "rating"
    if sort_by == "wins":
        sort_field = "wins"
    elif sort_by == "games":
        sort_field = "games_played"
    
    users = await db.users.find(
        {"is_banned": {"$ne": True}},
        {"_id": 0, "password": 0}
    ).sort(sort_field, -1).limit(limit).to_list(limit)
    
    return users

# ============= USER ROUTES =============

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.get("/users/{user_id}/games")
async def get_user_games(user_id: str, limit: int = 20):
    games = await db.games.find(
        {
            "$or": [
                {"white_player.user_id": user_id},
                {"black_player.user_id": user_id}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return games

# ============= ADMIN ROUTES =============

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await get_admin_user(request)
    
    total_users = await db.users.count_documents({})
    total_games = await db.games.count_documents({})
    active_games = await db.games.count_documents({"status": "active"})
    flagged_players = await db.users.count_documents({"is_flagged": True})
    banned_players = await db.users.count_documents({"is_banned": True})
    
    revenue_docs = await db.platform_revenue.find({}, {"_id": 0}).to_list(1000)
    total_revenue = {}
    for doc in revenue_docs:
        currency = doc.get("currency", "USDT")
        total_revenue[currency] = total_revenue.get(currency, 0) + doc.get("amount", 0)
    
    active_tournaments = await db.tournaments.count_documents({"status": "active"})
    
    return {
        "total_users": total_users,
        "total_games": total_games,
        "active_games": active_games,
        "total_revenue": total_revenue,
        "flagged_players": flagged_players,
        "banned_players": banned_players,
        "active_tournaments": active_tournaments
    }

@api_router.get("/admin/users")
async def admin_list_users(request: Request, skip: int = 0, limit: int = 50):
    await get_admin_user(request)
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    return users

@api_router.get("/admin/flagged-players")
async def admin_flagged_players(request: Request):
    await get_admin_user(request)
    
    flags = await db.anticheat_flags.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    result = []
    for flag in flags:
        user = await db.users.find_one({"user_id": flag["user_id"]}, {"_id": 0, "password": 0})
        if user:
            flag["user"] = user
        result.append(flag)
    
    return result

@api_router.post("/admin/analyze-player/{user_id}")
async def admin_analyze_player(user_id: str, request: Request):
    """Manually trigger Stockfish-based anti-cheat analysis for a player"""
    await get_admin_user(request)
    
    # Check if user exists
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        analysis = await analyze_player_behavior(user_id)
        return {
            "success": True,
            "user_id": user_id,
            "username": user.get("username"),
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Analysis failed for {user_id}: {e}")
        return {
            "success": False,
            "user_id": user_id,
            "error": str(e)
        }

@api_router.put("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, request: Request):
    await get_admin_user(request)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_banned": True}}
    )
    
    return {"success": True}

@api_router.put("/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, request: Request):
    await get_admin_user(request)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_banned": False, "is_flagged": False}}
    )
    
    # Clear flags
    await db.anticheat_flags.update_many(
        {"user_id": user_id},
        {"$set": {"status": "cleared"}}
    )
    
    return {"success": True}

@api_router.put("/admin/users/{user_id}/clear-flag")
async def admin_clear_flag(user_id: str, request: Request):
    await get_admin_user(request)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_flagged": False}}
    )
    
    await db.anticheat_flags.update_many(
        {"user_id": user_id, "status": "pending"},
        {"$set": {"status": "cleared"}}
    )
    
    return {"success": True}

@api_router.put("/admin/users/{user_id}/balance")
async def admin_adjust_balance(user_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    
    currency = body.get("currency", "USDT")
    amount = body.get("amount", 0)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {f"wallet_balance.{currency}": amount}}
    )
    
    return {"success": True}

@api_router.get("/admin/settings")
async def admin_get_settings(request: Request):
    await get_admin_user(request)
    
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    if not settings:
        settings = {
            "type": "platform",
            "arbiter_fee": 0.02,
            "min_stake": 1,
            "max_stake": 1000
        }
        await db.settings.insert_one(settings)
    
    return settings

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, request: Request):
    await get_admin_user(request)
    
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    
    await db.settings.update_one(
        {"type": "platform"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True}

@api_router.get("/admin/security-alerts")
async def admin_security_alerts(request: Request):
    await get_admin_user(request)
    
    alerts = await db.security_alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return alerts

# ============= WITHDRAWAL MANAGEMENT =============

@api_router.get("/admin/withdrawals")
async def admin_get_withdrawals(request: Request, status: Optional[str] = None):
    """Get all withdrawal requests for admin review"""
    await get_admin_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return withdrawals

@api_router.get("/admin/withdrawals/pending")
async def admin_get_pending_withdrawals(request: Request):
    """Get pending withdrawal requests"""
    await get_admin_user(request)
    
    withdrawals = await db.withdrawals.find(
        {"status": "pending"}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return withdrawals

@api_router.put("/admin/withdrawals/{withdrawal_id}/confirm")
async def admin_confirm_withdrawal(withdrawal_id: str, request: Request):
    """Admin confirms a withdrawal request"""
    admin = await get_admin_user(request)
    body = await request.json()
    admin_note = body.get("admin_note", "")
    
    # Get the withdrawal
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal already {withdrawal['status']}")
    
    # Update withdrawal status
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {
            "$set": {
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "confirmed_by": admin["user_id"],
                "admin_note": admin_note
            }
        }
    )
    
    # Update transaction status
    await db.transactions.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {"status": "completed"}}
    )
    
    # Notify user via WebSocket
    await sio.emit('withdrawal_status_update', {
        "withdrawal_id": withdrawal_id,
        "status": "confirmed",
        "message": "Your withdrawal has been confirmed and processed.",
        "admin_note": admin_note
    }, room=f"user_{withdrawal['user_id']}")
    
    logger.info(f"Withdrawal {withdrawal_id} confirmed by admin {admin['user_id']}")
    
    return {"success": True, "message": "Withdrawal confirmed"}

@api_router.put("/admin/withdrawals/{withdrawal_id}/reject")
async def admin_reject_withdrawal(withdrawal_id: str, request: Request):
    """Admin rejects a withdrawal request and refunds the balance"""
    admin = await get_admin_user(request)
    body = await request.json()
    admin_note = body.get("admin_note", "Withdrawal rejected by admin")
    
    # Get the withdrawal
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal already {withdrawal['status']}")
    
    # Refund the balance to user
    await db.users.update_one(
        {"user_id": withdrawal["user_id"]},
        {"$inc": {f"wallet_balance.{withdrawal['currency']}": withdrawal["amount"]}}
    )
    
    # Update withdrawal status
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {
            "$set": {
                "status": "rejected",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "rejected_by": admin["user_id"],
                "admin_note": admin_note
            }
        }
    )
    
    # Update transaction status
    await db.transactions.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {"status": "rejected"}}
    )
    
    # Create refund transaction
    await db.transactions.insert_one({
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": withdrawal["user_id"],
        "tx_type": "refund",
        "amount": withdrawal["amount"],
        "currency": withdrawal["currency"],
        "status": "completed",
        "related_withdrawal_id": withdrawal_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify user via WebSocket
    await sio.emit('withdrawal_status_update', {
        "withdrawal_id": withdrawal_id,
        "status": "rejected",
        "message": "Your withdrawal was rejected. Balance has been refunded.",
        "admin_note": admin_note
    }, room=f"user_{withdrawal['user_id']}")
    
    logger.info(f"Withdrawal {withdrawal_id} rejected by admin {admin['user_id']}, balance refunded")
    
    return {"success": True, "message": "Withdrawal rejected and balance refunded"}

@api_router.get("/wallet/withdrawals")
async def get_user_withdrawals(request: Request):
    """Get current user's withdrawal history"""
    user = await get_current_user(request)
    
    withdrawals = await db.withdrawals.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return withdrawals

# ============= SOCKET.IO EVENTS =============

# Track active connections per game for debugging
game_connections = {}

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    # Clean up game connections
    for game_id in list(game_connections.keys()):
        if sid in game_connections.get(game_id, set()):
            game_connections[game_id].discard(sid)

@sio.event
async def join_admin_room(sid, data):
    """Admin joins the admin notification room"""
    logger.info(f"Attempting to enter room: admin_room (sid={sid}, room_repr={repr('admin_room')}, room_type={type('admin_room')})")
    print(f"[PRINT] Attempting to enter room: admin_room (sid={sid}, room_repr={repr('admin_room')}, room_type={type('admin_room')})")
    await sio.enter_room(sid, "admin_room")
    logger.info(f"Admin client {sid} joined admin_room")
    print(f"[PRINT] Admin client {sid} joined admin_room")
    await sio.emit('joined_admin_room', {"success": True}, room=sid)

@sio.event
async def join_user_room(sid, data):
    """User joins their personal notification room"""
    user_id = data.get("user_id")
    if user_id:
        room_name = f"user_{user_id}"
        logger.info(f"Attempting to enter room: {room_name} (sid={sid}, room_repr={repr(room_name)}, room_type={type(room_name)})")
        print(f"[PRINT] Attempting to enter room: {room_name} (sid={sid}, room_repr={repr(room_name)}, room_type={type(room_name)})")
        await sio.enter_room(sid, room_name)
        logger.info(f"User {user_id} joined their notification room: {room_name}")
        print(f"[PRINT] User {user_id} joined their notification room: {room_name}")
        await sio.emit('joined_user_room', {"success": True, "user_id": user_id}, room=sid)

@sio.event
async def join_game(sid, data):
    game_id = data.get("game_id")
    if game_id:
        room_name = str(game_id)
        logger.info(f"Attempting to enter room: {room_name} (sid={sid}, room_repr={repr(room_name)}, room_type={type(room_name)})")
        print(f"[PRINT] Attempting to enter room: {room_name} (sid={sid}, room_repr={repr(room_name)}, room_type={type(room_name)})")
        await sio.enter_room(sid, room_name)
        # Track connection
        if room_name not in game_connections:
            game_connections[room_name] = set()
        game_connections[room_name].add(sid)
        
        logger.info(f"Client {sid} joined game room '{room_name}', total in room: {len(game_connections[room_name])}")
        print(f"[PRINT] Client {sid} joined game room '{room_name}', total in room: {len(game_connections[room_name])}")
        
        # Send current game state to newly connected client
        game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
        if game:
            await sio.emit('game_sync', {
                "game_id": game_id,
                "fen": game.get("fen", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
                "current_turn": game.get("current_turn", "white"),
                "status": game.get("status"),
                "moves": game.get("moves", [])
            }, room=sid)
        
        await sio.emit('joined_game', {"game_id": game_id}, room=sid)

@sio.event
async def leave_game(sid, data):
    game_id = data.get("game_id")
    if game_id:
        room_name = str(game_id)
        logger.info(f"Leaving room: {room_name} (sid={sid})")
        print(f"[PRINT] Leaving room: {room_name} (sid={sid})")
        await sio.leave_room(sid, room_name)
        if room_name in game_connections:
            game_connections[room_name].discard(sid)
        logger.info(f"Client {sid} left game room '{room_name}'")
        print(f"[PRINT] Client {sid} left game room '{room_name}'")

@sio.event
async def game_move(sid, data):
    """Handle real-time move broadcast from client"""
    game_id = data.get("game_id")
    move = data.get("move")
    fen = data.get("fen")
    current_turn = data.get("current_turn")
    
    if game_id and move and fen:
        room_name = str(game_id)
        room_clients = game_connections.get(room_name, set())
        logger.info(f"🎮 game_move received: sid={sid}, game_id={game_id}, room_name={room_name}, move={move}, clients_in_room={len(room_clients)}")
        print(f"[PRINT] 🎮 game_move received: sid={sid}, game_id={game_id}, room_name={room_name}, move={move}, clients_in_room={len(room_clients)}")
        # Broadcast to all OTHER clients in the game room
        await sio.emit('move_made', {
            "game_id": game_id,
            "move": move,
            "fen": fen,
            "current_turn": current_turn
        }, room=room_name, skip_sid=sid)
        logger.info(f"✅ Broadcast move_made to room {room_name} (except sender {sid})")
        print(f"[PRINT] ✅ Broadcast move_made to room {room_name} (except sender {sid})")

@sio.event
async def chat_message(sid, data):
    game_id = data.get("game_id")
    message = data.get("message")
    username = data.get("username")
    
    if game_id:
        await sio.emit('chat_message', {
            "username": username,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, room=game_id)

@sio.event
async def time_update(sid, data):
    game_id = data.get("game_id")
    white_time = data.get("white_time")
    black_time = data.get("black_time")
    
    if game_id:
        await sio.emit('time_sync', {
            "white_time": white_time,
            "black_time": black_time
        }, room=game_id, skip_sid=sid)

@sio.event
async def threefold_repetition(sid, data):
    """Handle threefold repetition draw claim"""
    game_id = data.get("game_id")
    fen = data.get("fen")
    
    if game_id:
        logger.info(f"Threefold repetition claimed in game {game_id}")
        
        # Update game in database
        await db.games.update_one(
            {"game_id": game_id},
            {
                "$set": {
                    "status": "completed",
                    "result": "draw",
                    "end_reason": "threefold_repetition",
                    "ended_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update player stats
        game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
        if game:
            for player in [game.get("white_player"), game.get("black_player")]:
                if player:
                    await db.users.update_one(
                        {"user_id": player["user_id"]},
                        {"$inc": {"games_played": 1, "draws": 1}}
                    )
            
            # Refund stakes if any
            if game.get("stake_amount", 0) > 0:
                for player in [game.get("white_player"), game.get("black_player")]:
                    if player:
                        await db.users.update_one(
                            {"user_id": player["user_id"]},
                            {"$inc": {f"wallet_balance.{game['stake_currency']}": game["stake_amount"]}}
                        )
        
        # Broadcast draw to both players
        await sio.emit('draw_declared', {
            "game_id": game_id,
            "reason": "threefold_repetition"
        }, room=game_id)

# ============= ROOT ROUTE =============

@api_router.get("/")
async def root():
    return {"message": "StakeChess API", "version": "2.0.0"}


# Temporary debug route to inspect active socket rooms and members
@api_router.get("/debug/rooms")
async def debug_rooms():
    # Convert sets to lists for JSON serialization
    return {room: list(sids) for room, sids in game_connections.items()}

# Include the router in the main app
app.include_router(api_router)

# Add CORS middleware BEFORE wrapping with Socket.IO
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define FastAPI lifecycle events BEFORE wrapping with Socket.IO
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_tasks():
    # Create admin user
    admin = await db.users.find_one({"email": "admin@stakechess.com"})
    if not admin:
        admin_doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "username": "admin",
            "email": "admin@stakechess.com",
            "password": get_password_hash("admin123"),
            "rating": 1200,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "wallet_balance": {"USDT": 10000.0, "BTC": 1.0, "ETH": 10.0},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_admin": True,
            "is_flagged": False,
            "is_banned": False
        }
        await db.users.insert_one(admin_doc)
        logger.info("Admin user created: admin@stakechess.com / admin123")
    
    # Create sample tournaments
    existing_tournaments = await db.tournaments.count_documents({})
    if existing_tournaments == 0:
        sample_tournaments = [
            {
                "tournament_id": f"tourney_{uuid.uuid4().hex[:12]}",
                "name": "Blitz Arena",
                "time_control": "3+2",
                "entry_fee": 5.0,
                "entry_currency": "USDT",
                "prize_pool": 0,
                "min_players": 4,
                "max_players": 64,
                "current_players": 0,
                "tournament_type": "arena",
                "status": "upcoming",
                "start_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "end_time": None,
                "duration_minutes": 60,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "players": [],
                "leaderboard": []
            },
            {
                "tournament_id": f"tourney_{uuid.uuid4().hex[:12]}",
                "name": "Rapid Arena",
                "time_control": "10+5",
                "entry_fee": 10.0,
                "entry_currency": "USDT",
                "prize_pool": 0,
                "min_players": 4,
                "max_players": 32,
                "current_players": 0,
                "tournament_type": "arena",
                "status": "upcoming",
                "start_time": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
                "end_time": None,
                "duration_minutes": 90,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "players": [],
                "leaderboard": []
            },
            {
                "tournament_id": f"tourney_{uuid.uuid4().hex[:12]}",
                "name": "Bullet Arena",
                "time_control": "1+1",
                "entry_fee": 2.0,
                "entry_currency": "USDT",
                "prize_pool": 0,
                "min_players": 4,
                "max_players": 128,
                "current_players": 0,
                "tournament_type": "arena",
                "status": "upcoming",
                "start_time": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
                "end_time": None,
                "duration_minutes": 30,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "players": [],
                "leaderboard": []
            },
            {
                "tournament_id": f"tourney_{uuid.uuid4().hex[:12]}",
                "name": "Daily Classic",
                "time_control": "15+10",
                "entry_fee": 15.0,
                "entry_currency": "USDT",
                "prize_pool": 0,
                "min_players": 8,
                "max_players": 16,
                "current_players": 0,
                "tournament_type": "swiss",
                "status": "upcoming",
                "start_time": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
                "end_time": None,
                "duration_minutes": 120,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "players": [],
                "leaderboard": []
            }
        ]
        
        await db.tournaments.insert_many(sample_tournaments)
        logger.info("Sample tournaments created")
    
    # Start the scheduler for automated tournaments
    await setup_tournament_scheduler()

async def create_automated_tournament(tournament_type: str):
    """Create an automated tournament"""
    try:
        tournament_configs = {
            "bullet": {
                "name": f"Bullet Arena #{random.randint(1000, 9999)}",
                "time_control": "1+0",
                "entry_fee": 2.0,
                "duration_minutes": 30,
                "min_players": 4,
                "max_players": 128
            },
            "blitz": {
                "name": f"Blitz Arena #{random.randint(1000, 9999)}",
                "time_control": "3+2",
                "entry_fee": 5.0,
                "duration_minutes": 60,
                "min_players": 4,
                "max_players": 64
            },
            "rapid": {
                "name": f"Rapid Arena #{random.randint(1000, 9999)}",
                "time_control": "10+5",
                "entry_fee": 10.0,
                "duration_minutes": 90,
                "min_players": 4,
                "max_players": 32
            },
            "classical": {
                "name": f"Classical Swiss #{random.randint(1000, 9999)}",
                "time_control": "15+10",
                "entry_fee": 15.0,
                "duration_minutes": 120,
                "min_players": 8,
                "max_players": 16
            }
        }
        
        config = tournament_configs.get(tournament_type, tournament_configs["blitz"])
        
        tournament = {
            "tournament_id": f"auto_tourney_{uuid.uuid4().hex[:12]}",
            "name": config["name"],
            "time_control": config["time_control"],
            "entry_fee": config["entry_fee"],
            "entry_currency": "USDT",
            "prize_pool": 0,
            "min_players": config["min_players"],
            "max_players": config["max_players"],
            "current_players": 0,
            "tournament_type": "arena" if tournament_type != "classical" else "swiss",
            "status": "upcoming",
            "start_time": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "end_time": None,
            "duration_minutes": config["duration_minutes"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "players": [],
            "leaderboard": [],
            "automated": True
        }
        
        await db.tournaments.insert_one(tournament)
        logger.info(f"Automated tournament created: {tournament['name']}")
        
    except Exception as e:
        logger.error(f"Failed to create automated tournament: {e}")

async def setup_tournament_scheduler():
    """Setup scheduled jobs for automated tournaments"""
    try:
        # Bullet tournament every 30 minutes
        scheduler.add_job(
            create_automated_tournament,
            IntervalTrigger(minutes=30),
            args=["bullet"],
            id="bullet_tournament",
            replace_existing=True
        )
        
        # Blitz tournament every hour
        scheduler.add_job(
            create_automated_tournament,
            IntervalTrigger(hours=1),
            args=["blitz"],
            id="blitz_tournament",
            replace_existing=True
        )
        
        # Rapid tournament every 2 hours
        scheduler.add_job(
            create_automated_tournament,
            IntervalTrigger(hours=2),
            args=["rapid"],
            id="rapid_tournament",
            replace_existing=True
        )
        
        # Classical tournament daily at midnight UTC
        scheduler.add_job(
            create_automated_tournament,
            CronTrigger(hour=0, minute=0),
            args=["classical"],
            id="classical_tournament",
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("Tournament scheduler started with automated jobs")
        
    except Exception as e:
        logger.error(f"Failed to setup tournament scheduler: {e}")

# Mount Socket.IO - this wraps the FastAPI app to handle both HTTP and WebSocket
# The variable name 'app' is used so uvicorn can find it as server:app
_fastapi_app = app
app = socketio.ASGIApp(sio, _fastapi_app)
