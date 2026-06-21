import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  Users,
  Trophy,
  DollarSign,
  Settings,
  ChevronLeft,
  Ban,
  Check,
  Edit,
  Shield,
  AlertTriangle,
  Calendar,
  Eye,
  X,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

export default function AdminPanel() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [flaggedPlayers, setFlaggedPlayers] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Balance adjustment
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceCurrency, setBalanceCurrency] = useState("USDT");

  // Settings
  const [newArbiterFee, setNewArbiterFee] = useState("");

  // Tournament creation
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: "",
    time_control: "3+2",
    entry_fee: 5,
    entry_currency: "USDT",
    min_players: 4,
    max_players: 64,
    tournament_type: "arena",
    duration_minutes: 60
  });

  // Withdrawal management
  const [withdrawalNoteDialogOpen, setWithdrawalNoteDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalAction, setWithdrawalAction] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate("/lobby");
      return;
    }
    fetchAdminData();
  }, [user, navigate]);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes, settingsRes, flaggedRes, alertsRes, tournamentsRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/flagged-players`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/security-alerts`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/tournaments`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/withdrawals`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setSettings(settingsRes.data);
      setFlaggedPlayers(flaggedRes.data);
      setSecurityAlerts(alertsRes.data);
      setTournaments(tournamentsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setNewArbiterFee((settingsRes.data.arbiter_fee * 100).toString());
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  // Withdrawal management handlers
  const handleConfirmWithdrawal = async (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalAction("confirm");
    setAdminNote("");
    setWithdrawalNoteDialogOpen(true);
  };

  const handleRejectWithdrawal = async (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalAction("reject");
    setAdminNote("");
    setWithdrawalNoteDialogOpen(true);
  };

  const processWithdrawalAction = async () => {
    if (!selectedWithdrawal || !withdrawalAction) return;
    
    setProcessingWithdrawal(true);
    try {
      const endpoint = withdrawalAction === "confirm" 
        ? `${API}/admin/withdrawals/${selectedWithdrawal.withdrawal_id}/confirm`
        : `${API}/admin/withdrawals/${selectedWithdrawal.withdrawal_id}/reject`;
      
      await axios.put(
        endpoint,
        { admin_note: adminNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(
        withdrawalAction === "confirm" 
          ? "Withdrawal confirmed successfully" 
          : "Withdrawal rejected, balance refunded"
      );
      
      setWithdrawalNoteDialogOpen(false);
      setSelectedWithdrawal(null);
      setWithdrawalAction(null);
      setAdminNote("");
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${withdrawalAction} withdrawal`);
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === "pending").length;

  const handleBanUser = async (userId, isBanned) => {
    try {
      await axios.put(
        `${API}/admin/users/${userId}/${isBanned ? "unban" : "ban"}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isBanned ? "User unbanned" : "User banned");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleClearFlag = async (userId) => {
    try {
      await axios.put(
        `${API}/admin/users/${userId}/clear-flag`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Flag cleared");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to clear flag");
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || !balanceAmount) return;

    try {
      await axios.put(
        `${API}/admin/users/${selectedUser.user_id}/balance`,
        {
          currency: balanceCurrency,
          amount: parseFloat(balanceAmount),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Balance adjusted");
      setBalanceDialogOpen(false);
      setBalanceAmount("");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to adjust balance");
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await axios.put(
        `${API}/admin/settings`,
        {
          arbiter_fee: parseFloat(newArbiterFee) / 100,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Settings updated");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const handleCreateTournament = async () => {
    try {
      await axios.post(
        `${API}/tournaments`,
        newTournament,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Tournament created");
      setTournamentDialogOpen(false);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to create tournament");
    }
  };

  const handleStartTournament = async (tournamentId) => {
    try {
      await axios.post(
        `${API}/tournaments/${tournamentId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Tournament started");
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start tournament");
    }
  };

  const handleEndTournament = async (tournamentId) => {
    try {
      await axios.post(
        `${API}/tournaments/${tournamentId}/end`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Tournament ended");
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to end tournament");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-16 h-16 spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navigation */}
      <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/lobby">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <Link to="/" className="flex items-center gap-3">
                <img src={LOGO_URL} alt="StakeChess" className="w-10 h-10" />
                <span className="font-heading text-xl text-white">
                  Stake<span className="text-[#D4AF37]">Chess</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#D4AF37] text-sm px-3 py-1 bg-[#D4AF37]/10 rounded-sm">
                Admin Panel
              </span>
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-[#0A0A0A] p-1 rounded-sm w-fit">
          {[
            { id: "overview", label: "Overview", icon: Trophy },
            { id: "users", label: "Users", icon: Users },
            { id: "withdrawals", label: "Withdrawals", icon: Wallet, badge: pendingWithdrawalsCount },
            { id: "anticheat", label: "Anti-Cheat", icon: Shield },
            { id: "tournaments", label: "Tournaments", icon: Calendar },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-sm transition-colors relative ${
                activeTab === tab.id
                  ? "bg-[#D4AF37] text-black"
                  : "text-white/70 hover:text-white"
              }`}
              data-testid={`admin-tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h2 className="font-heading text-2xl text-white mb-6">
              Platform Overview
            </h2>

            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm">
                <Users className="w-8 h-8 text-[#00C2FF] mb-2" />
                <p className="text-3xl font-bold text-white font-mono">
                  {stats?.total_users || 0}
                </p>
                <p className="text-white/50 text-sm">Total Users</p>
              </div>
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm">
                <Trophy className="w-8 h-8 text-[#D4AF37] mb-2" />
                <p className="text-3xl font-bold text-white font-mono">
                  {stats?.total_games || 0}
                </p>
                <p className="text-white/50 text-sm">Total Games</p>
              </div>
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm">
                <Shield className="w-8 h-8 text-[#FF3B30] mb-2" />
                <p className="text-3xl font-bold text-[#FF3B30] font-mono">
                  {stats?.flagged_players || 0}
                </p>
                <p className="text-white/50 text-sm">Flagged Players</p>
              </div>
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm">
                <DollarSign className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-3xl font-bold text-green-400 font-mono">
                  ${stats?.total_revenue?.USDT?.toFixed(2) || "0.00"}
                </p>
                <p className="text-white/50 text-sm">Platform Revenue</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-4">
                <h3 className="text-white font-semibold mb-2">Active Games</h3>
                <p className="text-3xl font-mono text-[#00FF94]">{stats?.active_games || 0}</p>
              </div>
              <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-4">
                <h3 className="text-white font-semibold mb-2">Active Tournaments</h3>
                <p className="text-3xl font-mono text-[#D4AF37]">{stats?.active_tournaments || 0}</p>
              </div>
              <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-4">
                <h3 className="text-white font-semibold mb-2">Banned Users</h3>
                <p className="text-3xl font-mono text-[#FF3B30]">{stats?.banned_players || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <h2 className="font-heading text-2xl text-white mb-6">
              User Management
            </h2>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">User</TableHead>
                    <TableHead className="text-white/50">Email</TableHead>
                    <TableHead className="text-white/50 text-center">Rating</TableHead>
                    <TableHead className="text-white/50 text-center">USDT</TableHead>
                    <TableHead className="text-white/50 text-center">Status</TableHead>
                    <TableHead className="text-white/50 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow
                      key={u.user_id}
                      className="border-white/5 hover:bg-white/5"
                    >
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          {u.username}
                          {u.is_admin && (
                            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">Admin</Badge>
                          )}
                          {u.is_flagged && (
                            <Badge className="bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/30">Flagged</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-white/70">{u.email}</TableCell>
                      <TableCell className="text-center font-mono text-[#D4AF37]">{u.rating}</TableCell>
                      <TableCell className="text-center font-mono text-green-400">
                        ${u.wallet_balance?.USDT?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-center">
                        {u.is_banned ? (
                          <Badge className="bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/30">Banned</Badge>
                        ) : (
                          <Badge className="bg-[#00FF94]/20 text-[#00FF94] border-[#00FF94]/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => {
                              setSelectedUser(u);
                              setBalanceDialogOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-white/50 hover:text-[#D4AF37]"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!u.is_admin && (
                            <Button
                              onClick={() => handleBanUser(u.user_id, u.is_banned)}
                              variant="ghost"
                              size="sm"
                              className={u.is_banned ? "text-[#00FF94]" : "text-[#FF3B30]"}
                            >
                              {u.is_banned ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Anti-Cheat Tab */}
        {activeTab === "anticheat" && (
          <div>
            <h2 className="font-heading text-2xl text-white mb-6">
              Anti-Cheat Dashboard
            </h2>

            {/* Flagged Players */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm mb-6">
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
                <h3 className="text-white font-semibold">Flagged Players ({flaggedPlayers.length})</h3>
              </div>
              {flaggedPlayers.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield className="w-12 h-12 text-[#00FF94] mx-auto mb-4" />
                  <p className="text-white/50">No flagged players</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {flaggedPlayers.map((flag) => (
                    <div key={flag.flag_id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-semibold">{flag.user?.username}</span>
                            <span className="text-white/30 text-sm">({flag.user?.email})</span>
                          </div>
                          <div className="space-y-1">
                            {flag.reasons?.map((reason, idx) => (
                              <p key={idx} className="text-[#FF3B30] text-sm flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" />
                                {reason}
                              </p>
                            ))}
                          </div>
                          <p className="text-white/30 text-xs mt-2">
                            Flagged: {new Date(flag.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleClearFlag(flag.user_id)}
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Clear
                          </Button>
                          <Button
                            onClick={() => handleBanUser(flag.user_id, false)}
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30]/10"
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Ban
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Alerts */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#FFD700]" />
                <h3 className="text-white font-semibold">Security Alerts</h3>
              </div>
              {securityAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/50">No security alerts</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                  {securityAlerts.map((alert) => (
                    <div key={alert.alert_id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">
                          <span className="text-[#FFD700]">{alert.type}</span>
                          {alert.type === "multiple_accounts" && (
                            <span className="text-white/50"> - {alert.accounts_count} accounts from IP {alert.ip}</span>
                          )}
                        </p>
                        <p className="text-white/30 text-xs">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === "withdrawals" && (
          <div>
            <h2 className="font-heading text-2xl text-white mb-6">
              Withdrawal Management
            </h2>

            {/* Pending Withdrawals */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm mb-6">
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-white font-semibold">
                  Pending Withdrawals ({withdrawals.filter(w => w.status === "pending").length})
                </h3>
              </div>
              
              {withdrawals.filter(w => w.status === "pending").length === 0 ? (
                <div className="p-8 text-center">
                  <Wallet className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/50">No pending withdrawals</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/50">User</TableHead>
                      <TableHead className="text-white/50">Amount</TableHead>
                      <TableHead className="text-white/50">Method</TableHead>
                      <TableHead className="text-white/50">Wallet Address</TableHead>
                      <TableHead className="text-white/50">Date</TableHead>
                      <TableHead className="text-white/50 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.filter(w => w.status === "pending").map((withdrawal) => (
                      <TableRow key={withdrawal.withdrawal_id} className="border-white/5">
                        <TableCell>
                          <div>
                            <p className="text-white font-medium">{withdrawal.username}</p>
                            <p className="text-white/30 text-xs">{withdrawal.user_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-[#D4AF37] font-mono font-bold">
                            {withdrawal.amount.toFixed(2)} {withdrawal.currency}
                          </span>
                        </TableCell>
                        <TableCell className="text-white/70">{withdrawal.withdrawal_method}</TableCell>
                        <TableCell>
                          <span className="text-white/50 font-mono text-xs">
                            {withdrawal.wallet_address.slice(0, 10)}...{withdrawal.wallet_address.slice(-6)}
                          </span>
                        </TableCell>
                        <TableCell className="text-white/30 text-xs">
                          {new Date(withdrawal.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleConfirmWithdrawal(withdrawal)}
                              size="sm"
                              className="bg-[#00FF94] text-black hover:bg-[#00FF94]/80"
                              data-testid={`confirm-withdrawal-${withdrawal.withdrawal_id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              onClick={() => handleRejectWithdrawal(withdrawal)}
                              size="sm"
                              variant="outline"
                              className="border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30]/10"
                              data-testid={`reject-withdrawal-${withdrawal.withdrawal_id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Recent Withdrawals History */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-white/50" />
                <h3 className="text-white font-semibold">Withdrawal History</h3>
              </div>
              
              {withdrawals.filter(w => w.status !== "pending").length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/50">No completed withdrawals yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/50">User</TableHead>
                      <TableHead className="text-white/50">Amount</TableHead>
                      <TableHead className="text-white/50">Status</TableHead>
                      <TableHead className="text-white/50">Wallet Address</TableHead>
                      <TableHead className="text-white/50">Date</TableHead>
                      <TableHead className="text-white/50">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.filter(w => w.status !== "pending").map((withdrawal) => (
                      <TableRow key={withdrawal.withdrawal_id} className="border-white/5">
                        <TableCell>
                          <p className="text-white">{withdrawal.username}</p>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-white/70">
                            {withdrawal.amount.toFixed(2)} {withdrawal.currency}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            withdrawal.status === "confirmed"
                              ? "bg-[#00FF94]/20 text-[#00FF94] border-[#00FF94]/30"
                              : "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/30"
                          }>
                            {withdrawal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-white/50 font-mono text-xs">
                            {withdrawal.wallet_address.slice(0, 10)}...{withdrawal.wallet_address.slice(-6)}
                          </span>
                        </TableCell>
                        <TableCell className="text-white/30 text-xs">
                          {new Date(withdrawal.updated_at || withdrawal.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-white/50 text-xs max-w-[150px] truncate">
                          {withdrawal.admin_note || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {/* Tournaments Tab */}
        {activeTab === "tournaments" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl text-white">Tournament Management</h2>
              <Button
                onClick={() => setTournamentDialogOpen(true)}
                className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold"
              >
                Create Tournament
              </Button>
            </div>

            <div className="grid gap-4">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.tournament_id}
                  className="bg-[#0A0A0A] border border-white/5 rounded-sm p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold">{tournament.name}</h3>
                        <Badge className={
                          tournament.status === "active" 
                            ? "bg-[#00FF94]/20 text-[#00FF94] border-[#00FF94]/30" 
                            : tournament.status === "upcoming"
                            ? "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30"
                            : "bg-white/10 text-white/50 border-white/20"
                        }>
                          {tournament.status}
                        </Badge>
                      </div>
                      <p className="text-white/50 text-sm">
                        {tournament.time_control} • {tournament.current_players}/{tournament.max_players} players • 
                        Prize Pool: {tournament.prize_pool} {tournament.entry_currency}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {tournament.status === "upcoming" && (
                        <Button
                          onClick={() => handleStartTournament(tournament.tournament_id)}
                          size="sm"
                          className="bg-[#00FF94] text-black hover:bg-[#00FF94]/80"
                        >
                          Start
                        </Button>
                      )}
                      {tournament.status === "active" && (
                        <Button
                          onClick={() => handleEndTournament(tournament.tournament_id)}
                          size="sm"
                          variant="outline"
                          className="border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30]/10"
                        >
                          End
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div>
            <h2 className="font-heading text-2xl text-white mb-6">
              Platform Settings
            </h2>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-6 max-w-md">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/70">Arbiter Fee (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newArbiterFee}
                    onChange={(e) => setNewArbiterFee(e.target.value)}
                    className="bg-[#121212] border-white/10 text-white font-mono"
                  />
                  <p className="text-white/30 text-xs">
                    Current: {(settings?.arbiter_fee * 100).toFixed(1)}%
                  </p>
                </div>

                <Button
                  onClick={handleUpdateSettings}
                  className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Balance Adjustment Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Adjust Balance - {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-white/70">Currency</Label>
              <Select value={balanceCurrency} onValueChange={setBalanceCurrency}>
                <SelectTrigger className="bg-[#121212] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121212] border-white/10">
                  <SelectItem value="USDT" className="text-white hover:bg-white/10">USDT</SelectItem>
                  <SelectItem value="BTC" className="text-white hover:bg-white/10">BTC</SelectItem>
                  <SelectItem value="ETH" className="text-white hover:bg-white/10">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Amount (+ or -)</Label>
              <Input
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="10 or -10"
                className="bg-[#121212] border-white/10 text-white font-mono"
              />
              <p className="text-white/30 text-xs">
                Current: {selectedUser?.wallet_balance?.[balanceCurrency]?.toFixed(6) || 0} {balanceCurrency}
              </p>
            </div>

            <Button
              onClick={handleAdjustBalance}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider"
            >
              Adjust Balance
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Tournament Dialog */}
      <Dialog open={tournamentDialogOpen} onOpenChange={setTournamentDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Create Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-white/70">Name</Label>
              <Input
                value={newTournament.name}
                onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                placeholder="Tournament Name"
                className="bg-[#121212] border-white/10 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Time Control</Label>
                <Select
                  value={newTournament.time_control}
                  onValueChange={(v) => setNewTournament({...newTournament, time_control: v})}
                >
                  <SelectTrigger className="bg-[#121212] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/10">
                    <SelectItem value="1+1" className="text-white">1+1 Bullet</SelectItem>
                    <SelectItem value="3+2" className="text-white">3+2 Blitz</SelectItem>
                    <SelectItem value="5+3" className="text-white">5+3 Blitz</SelectItem>
                    <SelectItem value="10+5" className="text-white">10+5 Rapid</SelectItem>
                    <SelectItem value="15+10" className="text-white">15+10 Rapid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Entry Fee (USDT)</Label>
                <Input
                  type="number"
                  value={newTournament.entry_fee}
                  onChange={(e) => setNewTournament({...newTournament, entry_fee: parseFloat(e.target.value)})}
                  className="bg-[#121212] border-white/10 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Min Players</Label>
                <Input
                  type="number"
                  value={newTournament.min_players}
                  onChange={(e) => setNewTournament({...newTournament, min_players: parseInt(e.target.value)})}
                  className="bg-[#121212] border-white/10 text-white font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Max Players</Label>
                <Input
                  type="number"
                  value={newTournament.max_players}
                  onChange={(e) => setNewTournament({...newTournament, max_players: parseInt(e.target.value)})}
                  className="bg-[#121212] border-white/10 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Duration (minutes)</Label>
              <Input
                type="number"
                value={newTournament.duration_minutes}
                onChange={(e) => setNewTournament({...newTournament, duration_minutes: parseInt(e.target.value)})}
                className="bg-[#121212] border-white/10 text-white font-mono"
              />
            </div>

            <Button
              onClick={handleCreateTournament}
              className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider"
            >
              Create Tournament
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={withdrawalNoteDialogOpen} onOpenChange={setWithdrawalNoteDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {withdrawalAction === "confirm" ? "Confirm Withdrawal" : "Reject Withdrawal"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedWithdrawal && (
              <div className="bg-[#121212] p-4 rounded-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/50">User:</span>
                  <span className="text-white font-medium">{selectedWithdrawal.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Amount:</span>
                  <span className="text-[#D4AF37] font-mono font-bold">
                    {selectedWithdrawal.amount.toFixed(2)} {selectedWithdrawal.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Wallet:</span>
                  <span className="text-white/70 font-mono text-xs">
                    {selectedWithdrawal.wallet_address.slice(0, 8)}...{selectedWithdrawal.wallet_address.slice(-6)}
                  </span>
                </div>
              </div>
            )}

            {withdrawalAction === "reject" && (
              <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 p-3 rounded-sm">
                <p className="text-[#FF3B30] text-sm">
                  Rejecting this withdrawal will refund {selectedWithdrawal?.amount.toFixed(2)} {selectedWithdrawal?.currency} back to the user's wallet.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white/70">Admin Note (optional)</Label>
              <Input
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={withdrawalAction === "confirm" 
                  ? "e.g., Sent to wallet, tx: 0x..." 
                  : "e.g., Invalid wallet address"
                }
                className="bg-[#121212] border-white/10 text-white"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setWithdrawalNoteDialogOpen(false)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                disabled={processingWithdrawal}
              >
                Cancel
              </Button>
              <Button
                onClick={processWithdrawalAction}
                disabled={processingWithdrawal}
                className={`flex-1 font-bold ${
                  withdrawalAction === "confirm"
                    ? "bg-[#00FF94] text-black hover:bg-[#00FF94]/80"
                    : "bg-[#FF3B30] text-white hover:bg-[#FF3B30]/80"
                }`}
              >
                {processingWithdrawal ? "Processing..." : withdrawalAction === "confirm" ? "Confirm" : "Reject & Refund"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
