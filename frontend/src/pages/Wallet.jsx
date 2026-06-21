import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronLeft,
  Copy,
  Check,
  QrCode,
  AlertTriangle,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

const CURRENCIES = [
  { 
    value: "USDT", 
    symbol: "$", 
    color: "text-green-400", 
    bgColor: "bg-green-400/10",
    network: "TRC20 (Tron Network)",
    networkColor: "text-red-400"
  },
  { 
    value: "BTC", 
    symbol: "₿", 
    color: "text-orange-400", 
    bgColor: "bg-orange-400/10",
    network: "Bitcoin Network",
    networkColor: "text-orange-400"
  },
  { 
    value: "ETH", 
    symbol: "Ξ", 
    color: "text-purple-400", 
    bgColor: "bg-purple-400/10",
    network: "ERC20 (Ethereum Network)",
    networkColor: "text-purple-400"
  },
];

// Official Platform Deposit Addresses
const DEPOSIT_ADDRESSES = {
  BTC: "bc1qegzv05zl09fn4egtr3dm5j6m805gtkut6rsajj",
  ETH: "0xCEe068a3af0a54B0f664A85316E2ae78cef1cD76",
  USDT: "TLo5r4kXq71xwpaLJWXvVwG9QBe2dWa9Ue", // TRC20
};

// QR Code generation URL
const getQRCodeUrl = (address, currency) => {
  const size = 200;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(address)}&bgcolor=0A0A0A&color=D4AF37`;
};

export default function Wallet() {
  const { user, token, updateUser, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  // Deposit form
  const [depositCurrency, setDepositCurrency] = useState("USDT");
  const [copiedAddress, setCopiedAddress] = useState(null);

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState("USDT");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("crypto");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchWithdrawals();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API}/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(response.data);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await axios.get(`${API}/wallet/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWithdrawals(response.data);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!withdrawAddress) {
      toast.error("Enter a wallet address");
      return;
    }

    setWithdrawing(true);
    try {
      const response = await axios.post(
        `${API}/wallet/withdraw`,
        {
          amount: parseFloat(withdrawAmount),
          currency: withdrawCurrency,
          wallet_address: withdrawAddress,
          withdrawal_method: withdrawMethod,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      updateUser({
        ...user,
        wallet_balance: response.data.wallet_balance,
      });

      toast.success("Withdrawal request submitted! Pending admin confirmation.", { duration: 5000 });
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
      fetchTransactions();
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const copyAddress = (currency) => {
    navigator.clipboard.writeText(DEPOSIT_ADDRESSES[currency]);
    setCopiedAddress(currency);
    toast.success("Address copied to clipboard!");
    setTimeout(() => setCopiedAddress(null), 3000);
  };

  const getCurrencyInfo = (currency) => {
    return CURRENCIES.find((c) => c.value === currency) || CURRENCIES[0];
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="w-4 h-4 text-[#00FF94]" />;
      case "withdraw":
        return <ArrowUpRight className="w-4 h-4 text-[#FF3B30]" />;
      case "stake":
        return <WalletIcon className="w-4 h-4 text-[#FFD700]" />;
      case "win":
        return <ArrowDownLeft className="w-4 h-4 text-[#00FF94]" />;
      default:
        return <Clock className="w-4 h-4 text-white/50" />;
    }
  };

  const currentDepositCurrency = getCurrencyInfo(depositCurrency);

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
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="font-heading text-3xl text-white mb-2"
              data-testid="wallet-title"
            >
              Wallet
            </h1>
            <p className="text-white/50">Manage your crypto balance</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {CURRENCIES.map((currency) => {
            const balance = user?.wallet_balance?.[currency.value] || 0;
            return (
              <div
                key={currency.value}
                className={`${currency.bgColor} border border-white/5 p-6 rounded-sm`}
                data-testid={`balance-${currency.value.toLowerCase()}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-white/70 text-sm uppercase tracking-wider">
                      {currency.value}
                    </span>
                    <p className={`text-xs ${currency.networkColor} mt-1`}>
                      {currency.network}
                    </p>
                  </div>
                  <span className={`${currency.color} text-2xl`}>
                    {currency.symbol}
                  </span>
                </div>
                <p className={`${currency.color} font-mono text-3xl font-bold`}>
                  {currency.value === "USDT"
                    ? balance.toFixed(2)
                    : balance.toFixed(6)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-[#00FF94] text-black hover:bg-[#00FF94]/80 font-bold uppercase tracking-wider px-8 btn-scale"
                data-testid="deposit-btn"
              >
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Deposit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">
                  Deposit Funds
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="USDT" value={depositCurrency} onValueChange={setDepositCurrency} className="mt-4">
                <TabsList className="bg-[#121212] w-full grid grid-cols-3 mb-6">
                  {CURRENCIES.map((c) => (
                    <TabsTrigger 
                      key={c.value} 
                      value={c.value}
                      className={`data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={c.color}>{c.symbol}</span>
                        {c.value}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {CURRENCIES.map((currency) => (
                  <TabsContent key={currency.value} value={currency.value} className="space-y-4">
                    {/* Network Warning */}
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 p-3 rounded-sm flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[#FF3B30] text-sm font-semibold">Important</p>
                        <p className="text-white/70 text-xs">
                          Only send <span className={currency.networkColor}>{currency.value}</span> via{" "}
                          <span className={currency.networkColor}>{currency.network}</span>. 
                          Sending via wrong network will result in permanent loss of funds.
                        </p>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-[#121212] p-6 rounded-sm text-center">
                      <div className="inline-block p-3 bg-white rounded-sm mb-4">
                        <img 
                          src={getQRCodeUrl(DEPOSIT_ADDRESSES[currency.value], currency.value)}
                          alt={`${currency.value} QR Code`}
                          className="w-40 h-40"
                          data-testid={`qr-code-${currency.value.toLowerCase()}`}
                        />
                      </div>
                      <p className="text-white/50 text-xs mb-2">
                        Scan QR code or copy address below
                      </p>
                    </div>

                    {/* Address */}
                    <div className="bg-[#121212] p-4 rounded-sm border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold ${currency.networkColor}`}>
                          {currency.value} Deposit Address ({currency.network.split(' ')[0]})
                        </span>
                        <QrCode className="w-4 h-4 text-white/30" />
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-[#D4AF37] flex-1 break-all font-mono bg-black/30 p-2 rounded">
                          {DEPOSIT_ADDRESSES[currency.value]}
                        </code>
                        <Button
                          onClick={() => copyAddress(currency.value)}
                          variant="ghost"
                          size="sm"
                          className="text-white/50 hover:text-white shrink-0 h-10 px-3"
                          data-testid={`copy-address-btn-${currency.value.toLowerCase()}`}
                        >
                          {copiedAddress === currency.value ? (
                            <Check className="w-5 h-5 text-[#00FF94]" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Copy Full Address Button */}
                    <Button
                      onClick={() => copyAddress(currency.value)}
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider btn-scale"
                    >
                      {copiedAddress === currency.value ? (
                        <span className="flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Address Copied!
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          Copy {currency.value} Address
                        </span>
                      )}
                    </Button>

                    <p className="text-white/30 text-xs text-center">
                      Deposits typically confirm within 10-30 minutes depending on network congestion.
                    </p>
                  </TabsContent>
                ))}
              </Tabs>
            </DialogContent>
          </Dialog>

          <Dialog
            open={withdrawDialogOpen}
            onOpenChange={setWithdrawDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-transparent border-white/10 text-white hover:bg-white/5 font-bold uppercase tracking-wider px-8"
                data-testid="withdraw-btn"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">
                  Withdraw Funds
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Currency</Label>
                  <Select
                    value={withdrawCurrency}
                    onValueChange={setWithdrawCurrency}
                  >
                    <SelectTrigger
                      className="bg-[#121212] border-white/10 text-white"
                      data-testid="withdraw-currency-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10">
                      {CURRENCIES.map((c) => (
                        <SelectItem
                          key={c.value}
                          value={c.value}
                          className="text-white hover:bg-white/10"
                        >
                          <span className="flex items-center gap-2">
                            <span className={c.color}>{c.value}</span>
                            <span className="text-white/50 text-xs">({c.network.split(' ')[0]})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className={`text-xs ${getCurrencyInfo(withdrawCurrency).networkColor}`}>
                    Network: {getCurrencyInfo(withdrawCurrency).network}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70">Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-[#121212] border-white/10 text-white font-mono"
                    data-testid="withdraw-amount-input"
                  />
                  <p className="text-white/30 text-xs">
                    Available:{" "}
                    {user?.wallet_balance?.[withdrawCurrency]?.toFixed(6) || 0}{" "}
                    {withdrawCurrency}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70">
                    Wallet Address ({getCurrencyInfo(withdrawCurrency).network.split(' ')[0]})
                  </Label>
                  <Input
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="Enter destination address"
                    className="bg-[#121212] border-white/10 text-white font-mono text-sm"
                    data-testid="withdraw-address-input"
                  />
                </div>

                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 p-3 rounded-sm">
                  <p className="text-[#FF3B30] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Double-check the address and network. Wrong address = lost funds.
                  </p>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider btn-scale"
                  data-testid="confirm-withdraw-btn"
                >
                  {withdrawing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 spinner" />
                      Processing...
                    </span>
                  ) : (
                    "Submit Withdrawal"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Deposit Addresses Quick View */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#D4AF37]" />
            Deposit Addresses
          </h2>
          <div className="space-y-4">
            {CURRENCIES.map((currency) => (
              <div key={currency.value} className="flex items-center justify-between p-3 bg-[#121212] rounded-sm">
                <div className="flex items-center gap-3">
                  <span className={`${currency.color} text-xl`}>{currency.symbol}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{currency.value}</p>
                    <p className={`text-xs ${currency.networkColor}`}>{currency.network}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-white/50 font-mono hidden md:block">
                    {DEPOSIT_ADDRESSES[currency.value].slice(0, 12)}...{DEPOSIT_ADDRESSES[currency.value].slice(-8)}
                  </code>
                  <Button
                    onClick={() => copyAddress(currency.value)}
                    variant="ghost"
                    size="sm"
                    className="text-white/50 hover:text-[#D4AF37]"
                  >
                    {copiedAddress === currency.value ? (
                      <Check className="w-4 h-4 text-[#00FF94]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-sm mb-8">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white">
              Transaction History
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 spinner" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((tx) => {
                const currencyInfo = getCurrencyInfo(tx.currency);
                const isPositive =
                  tx.tx_type === "deposit" || tx.tx_type === "win" || tx.tx_type === "refund";

                return (
                  <div
                    key={tx.tx_id}
                    className="p-4 flex items-center justify-between"
                    data-testid={`tx-${tx.tx_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#121212] rounded-sm flex items-center justify-center">
                        {getTransactionIcon(tx.tx_type)}
                      </div>
                      <div>
                        <p className="text-white capitalize">{tx.tx_type}</p>
                        <p className="text-white/30 text-sm">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-mono font-bold ${
                          isPositive ? "text-[#00FF94]" : "text-[#FF3B30]"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {Math.abs(tx.amount).toFixed(
                          tx.currency === "USDT" ? 2 : 6
                        )}{" "}
                        {tx.currency}
                      </p>
                      <p className="text-white/30 text-xs capitalize">
                        {tx.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Withdrawal Requests */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-[#D4AF37]" />
              Withdrawal Requests
            </h2>
            <Button
              onClick={fetchWithdrawals}
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white"
            >
              Refresh
            </Button>
          </div>
          {withdrawals.length === 0 ? (
            <div className="p-12 text-center">
              <ArrowUpRight className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No withdrawal requests</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {withdrawals.map((wd) => {
                const currencyInfo = getCurrencyInfo(wd.currency);
                const statusColors = {
                  pending: "text-[#D4AF37] bg-[#D4AF37]/10",
                  confirmed: "text-[#00FF94] bg-[#00FF94]/10",
                  rejected: "text-[#FF3B30] bg-[#FF3B30]/10",
                };

                return (
                  <div
                    key={wd.withdrawal_id}
                    className="p-4"
                    data-testid={`withdrawal-${wd.withdrawal_id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${currencyInfo.bgColor} rounded-sm flex items-center justify-center`}>
                          <span className={`${currencyInfo.color} text-lg`}>{currencyInfo.symbol}</span>
                        </div>
                        <div>
                          <p className="text-white font-mono font-bold">
                            {wd.amount.toFixed(wd.currency === "USDT" ? 2 : 6)} {wd.currency}
                          </p>
                          <p className="text-white/30 text-xs">
                            {new Date(wd.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-sm text-xs font-semibold uppercase ${statusColors[wd.status]}`}>
                        {wd.status}
                      </span>
                    </div>
                    <div className="ml-13 pl-[52px]">
                      <p className="text-white/50 text-xs font-mono break-all">
                        → {wd.wallet_address}
                      </p>
                      {wd.admin_note && (
                        <p className="text-white/40 text-xs mt-1">
                          Note: {wd.admin_note}
                        </p>
                      )}
                      {wd.status === "pending" && (
                        <p className="text-[#D4AF37] text-xs mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Awaiting admin confirmation
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
