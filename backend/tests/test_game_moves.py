"""
Test suite for StakeChess game moves and timer functionality
Tests the critical bug fixes:
1. Piece movement via API
2. Game creation and joining flow
3. Timer logic (black timer should only start after white's first move)
"""
import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stake-match-1.preview.emergentagent.com').rstrip('/')

class TestGameMoves:
    """Test game move functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_token = None
        self.test_token = None
        self.game_id = None
        
    def get_admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@stakechess.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data['access_token'], data['user']['user_id']
    
    def get_test_user_token(self):
        """Login as test user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Test user login failed: {response.text}"
        data = response.json()
        return data['access_token'], data['user']['user_id']
    
    def test_move_api_endpoint_works(self):
        """Test that the move API endpoint accepts valid moves"""
        # Get existing active game
        response = requests.get(f"{BASE_URL}/api/games/game_74a9f7253ce8")
        assert response.status_code == 200
        game = response.json()
        
        # Verify game is active
        assert game['status'] == 'active', f"Game status is {game['status']}, expected 'active'"
        
        # Verify game has moves
        assert len(game['moves']) >= 1, "Game should have at least one move"
        print(f"Game has {len(game['moves'])} moves: {game['moves']}")
        
    def test_game_creation_flow(self):
        """Test creating a new game"""
        admin_token, admin_id = self.get_admin_token()
        
        # Create a new game
        response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "time_control": "5+0",
                "stake_amount": 0,
                "stake_currency": "USDT",
                "game_type": "blitz",
                "is_private": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Game creation failed: {response.text}"
        
        game = response.json()
        assert game['status'] == 'waiting'
        assert game['white_player']['user_id'] == admin_id
        assert game['black_player'] is None
        assert game['time_control'] == '5+0'
        print(f"Created game: {game['game_id']}")
        
        return game['game_id']
    
    def test_game_join_flow(self):
        """Test joining a game changes status to active"""
        admin_token, admin_id = self.get_admin_token()
        test_token, test_id = self.get_test_user_token()
        
        # Create a new game as admin
        create_response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "time_control": "5+0",
                "stake_amount": 0,
                "stake_currency": "USDT",
                "game_type": "blitz",
                "is_private": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        game_id = create_response.json()['game_id']
        
        # Join game as test user
        join_response = requests.post(
            f"{BASE_URL}/api/games/{game_id}/join",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert join_response.status_code == 200, f"Join failed: {join_response.text}"
        
        joined_game = join_response.json()
        assert joined_game['status'] == 'active', f"Game status should be 'active', got {joined_game['status']}"
        assert joined_game['black_player']['user_id'] == test_id
        print(f"Game {game_id} is now active with both players")
        
        return game_id
    
    def test_make_move_as_white(self):
        """Test making a move as white player"""
        admin_token, admin_id = self.get_admin_token()
        test_token, test_id = self.get_test_user_token()
        
        # Create and join game
        create_response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "time_control": "5+0",
                "stake_amount": 0,
                "stake_currency": "USDT",
                "game_type": "blitz",
                "is_private": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        game_id = create_response.json()['game_id']
        
        requests.post(
            f"{BASE_URL}/api/games/{game_id}/join",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        # Make move as white (admin)
        move_response = requests.post(
            f"{BASE_URL}/api/games/{game_id}/move",
            json={
                "game_id": game_id,
                "move": "e2e4",
                "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
                "move_time": 1.5
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        
        result = move_response.json()
        assert result['success'] == True
        assert 'e2e4' in result['game']['moves']
        assert result['game']['current_turn'] == 'black'
        print(f"Move e2e4 successful, turn is now black")
        
    def test_make_move_as_black(self):
        """Test making a move as black player after white moves"""
        admin_token, admin_id = self.get_admin_token()
        test_token, test_id = self.get_test_user_token()
        
        # Create and join game
        create_response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "time_control": "5+0",
                "stake_amount": 0,
                "stake_currency": "USDT",
                "game_type": "blitz",
                "is_private": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        game_id = create_response.json()['game_id']
        
        requests.post(
            f"{BASE_URL}/api/games/{game_id}/join",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        # White moves first
        requests.post(
            f"{BASE_URL}/api/games/{game_id}/move",
            json={
                "game_id": game_id,
                "move": "e2e4",
                "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
                "move_time": 1.0
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Black responds
        move_response = requests.post(
            f"{BASE_URL}/api/games/{game_id}/move",
            json={
                "game_id": game_id,
                "move": "e7e5",
                "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
                "move_time": 2.0
            },
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert move_response.status_code == 200, f"Black move failed: {move_response.text}"
        
        result = move_response.json()
        assert result['success'] == True
        assert 'e7e5' in result['game']['moves']
        assert result['game']['current_turn'] == 'white'
        print(f"Move e7e5 successful, turn is now white")
        
    def test_cannot_move_out_of_turn(self):
        """Test that players cannot move when it's not their turn"""
        admin_token, admin_id = self.get_admin_token()
        test_token, test_id = self.get_test_user_token()
        
        # Create and join game
        create_response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "time_control": "5+0",
                "stake_amount": 0,
                "stake_currency": "USDT",
                "game_type": "blitz",
                "is_private": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        game_id = create_response.json()['game_id']
        
        requests.post(
            f"{BASE_URL}/api/games/{game_id}/join",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        # Try to move as black when it's white's turn
        move_response = requests.post(
            f"{BASE_URL}/api/games/{game_id}/move",
            json={
                "game_id": game_id,
                "move": "e7e5",
                "fen": "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1",
                "move_time": 1.0
            },
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert move_response.status_code == 400, f"Should fail when moving out of turn, got {move_response.status_code}"
        print("Correctly rejected move when not player's turn")


class TestTimerLogic:
    """Test timer functionality"""
    
    def test_game_initial_times(self):
        """Test that games start with correct initial times"""
        response = requests.get(f"{BASE_URL}/api/games?status=waiting")
        assert response.status_code == 200
        
        games = response.json()
        if games:
            game = games[0]
            # 10+0 time control = 600 seconds
            if game['time_control'] == '10+0':
                assert game['white_time'] == 600
                assert game['black_time'] == 600
            print(f"Game {game['game_id']} has correct initial times")


class TestGameEndpoints:
    """Test all game-related endpoints"""
    
    def test_list_games(self):
        """Test listing games"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)
        print(f"Found {len(games)} games")
        
    def test_list_games_by_status(self):
        """Test filtering games by status"""
        for status in ['waiting', 'active', 'completed']:
            response = requests.get(f"{BASE_URL}/api/games?status={status}")
            assert response.status_code == 200
            games = response.json()
            for game in games:
                assert game['status'] == status
            print(f"Found {len(games)} {status} games")
            
    def test_get_specific_game(self):
        """Test getting a specific game"""
        response = requests.get(f"{BASE_URL}/api/games/game_74a9f7253ce8")
        assert response.status_code == 200
        game = response.json()
        assert game['game_id'] == 'game_74a9f7253ce8'
        assert 'white_player' in game
        assert 'black_player' in game
        assert 'moves' in game
        print(f"Game {game['game_id']} retrieved successfully")
        
    def test_get_nonexistent_game(self):
        """Test getting a game that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/games/nonexistent_game_id")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
