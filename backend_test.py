import requests
import sys
import json
from datetime import datetime

class StakeChessAPITester:
    def __init__(self, base_url="https://stake-match-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.admin_token = None
        self.user_id = None
        self.admin_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                if response.text:
                    try:
                        error_data = response.json()
                        details += f", Error: {error_data.get('detail', 'Unknown error')}"
                    except:
                        details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['user_id']
            print(f"   User created with ID: {self.user_id}")
            print(f"   Demo balance: ${response['user']['wallet_balance']['USDT']}")
        
        return success

    def test_user_login(self):
        """Test user login with demo admin credentials"""
        admin_data = {
            "email": "admin@stakechess.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_user_id = response['user']['user_id']
            print(f"   Admin logged in with ID: {self.admin_user_id}")
            print(f"   Admin status: {response['user']['is_admin']}")
        
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get Current User", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            headers={'Authorization': f'Bearer {self.token}'}
        )
        return success

    def test_create_game(self):
        """Test creating a new game"""
        if not self.token:
            self.log_test("Create Game", False, "No token available")
            return False
            
        game_data = {
            "time_control": "10+0",
            "stake_amount": 5.0,
            "stake_currency": "USDT",
            "game_type": "rapid",
            "is_private": False
        }
        
        success, response = self.run_test(
            "Create Game",
            "POST",
            "games",
            200,
            data=game_data,
            headers={'Authorization': f'Bearer {self.token}'}
        )
        
        if success:
            self.game_id = response.get('game_id')
            print(f"   Game created with ID: {self.game_id}")
        
        return success

    def test_list_games(self):
        """Test listing available games"""
        success, response = self.run_test(
            "List Games",
            "GET",
            "games?status=waiting",
            200
        )
        
        if success:
            print(f"   Found {len(response)} waiting games")
        
        return success

    def test_leaderboard(self):
        """Test leaderboard endpoint"""
        success, response = self.run_test(
            "Get Leaderboard",
            "GET",
            "leaderboard",
            200
        )
        
        if success:
            print(f"   Leaderboard has {len(response)} players")
        
        return success

    def test_wallet_deposit(self):
        """Test wallet deposit"""
        if not self.token:
            self.log_test("Wallet Deposit", False, "No token available")
            return False
            
        deposit_data = {
            "amount": 50.0,
            "currency": "USDT"
        }
        
        success, response = self.run_test(
            "Wallet Deposit",
            "POST",
            "wallet/deposit",
            200,
            data=deposit_data,
            headers={'Authorization': f'Bearer {self.token}'}
        )
        
        if success:
            new_balance = response.get('wallet_balance', {}).get('USDT', 0)
            print(f"   New USDT balance: ${new_balance}")
        
        return success

    def test_wallet_transactions(self):
        """Test getting wallet transactions"""
        if not self.token:
            self.log_test("Wallet Transactions", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Wallet Transactions",
            "GET",
            "wallet/transactions",
            200,
            headers={'Authorization': f'Bearer {self.token}'}
        )
        
        if success:
            print(f"   Found {len(response)} transactions")
        
        return success

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.admin_token:
            self.log_test("Admin Stats", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Admin Stats",
            "GET",
            "admin/stats",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success:
            print(f"   Total users: {response.get('total_users', 0)}")
            print(f"   Total games: {response.get('total_games', 0)}")
            print(f"   Active games: {response.get('active_games', 0)}")
        
        return success

    def test_admin_users(self):
        """Test admin users list"""
        if not self.admin_token:
            self.log_test("Admin Users List", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Admin Users List",
            "GET",
            "admin/users",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success:
            print(f"   Listed {len(response)} users")
        
        return success

    def test_admin_settings(self):
        """Test admin settings"""
        if not self.admin_token:
            self.log_test("Admin Settings", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Get Admin Settings",
            "GET",
            "admin/settings",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success:
            print(f"   Arbiter fee: {response.get('arbiter_fee', 0) * 100}%")
        
        return success

    def test_tournaments(self):
        """Test tournaments endpoint"""
        success, response = self.run_test(
            "List Tournaments",
            "GET",
            "tournaments",
            200
        )
        
        if success:
            print(f"   Found {len(response)} tournaments")
            for tournament in response[:3]:  # Show first 3
                print(f"     - {tournament.get('name', 'Unknown')} ({tournament.get('status', 'unknown')})")
        
        return success

    def test_admin_flagged_players(self):
        """Test admin flagged players endpoint"""
        if not self.admin_token:
            self.log_test("Admin Flagged Players", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Admin Flagged Players",
            "GET",
            "admin/flagged-players",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success:
            print(f"   Found {len(response)} flagged players")
        
        return success

    def test_admin_security_alerts(self):
        """Test admin security alerts endpoint"""
        if not self.admin_token:
            self.log_test("Admin Security Alerts", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Admin Security Alerts",
            "GET",
            "admin/security-alerts",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        
        if success:
            print(f"   Found {len(response)} security alerts")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting StakeChess API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 50)
        
        # Basic API tests
        self.test_root_endpoint()
        
        # Authentication tests
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        
        # Game tests
        self.test_create_game()
        self.test_list_games()
        
        # Leaderboard test
        self.test_leaderboard()
        
        # Wallet tests
        self.test_wallet_deposit()
        self.test_wallet_transactions()
        
        # Admin tests
        self.test_admin_stats()
        self.test_admin_users()
        self.test_admin_settings()
        
        # New feature tests
        self.test_tournaments()
        self.test_admin_flagged_players()
        self.test_admin_security_alerts()
        
        # Print summary
        print("=" * 50)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = StakeChessAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())