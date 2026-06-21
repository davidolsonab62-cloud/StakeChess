# StakeChess - Product Requirements Document

## Project Overview
StakeChess is a real-time online chess platform where players can play chess against each other and optionally stake cryptocurrency on matches.

## Architecture
- **Frontend**: React 19 with TailwindCSS
- **Backend**: FastAPI with Python 3.11
- **Database**: MongoDB
- **Real-time**: Socket.IO with polling fallback

## What's Implemented (March 2025)

### Core Gameplay ✅
- Real-time multiplayer chess with WebSockets/polling
- Multiple move methods: Drag-and-drop + Click-to-move
- Improved board colors for piece visibility
- Board flipping for black player
- Smooth 150ms animations
- Threefold repetition tracking

### User System ✅
- JWT-based email/password authentication
- Google OAuth via Emergent Auth
- ELO rating system
- User profiles with stats

### Withdrawal Management System ✅ (NEW)
- **Withdrawal Request Creation**:
  - Users can submit withdrawal requests
  - Fields: userId, username, amount, currency, walletAddress, withdrawalMethod, status
  - Balance deducted immediately (pending refund on rejection)
- **Admin Notification**:
  - Real-time WebSocket notifications to admin_room
  - Red badge shows pending count on Withdrawals tab
- **Admin Withdrawal Panel**:
  - Table showing all withdrawal requests
  - Shows: user, amount, method, wallet address, status, date, admin note
- **Admin Confirmation Controls**:
  - "Confirm Withdrawal" button - updates status to confirmed
  - "Reject Withdrawal" button - refunds balance, updates status to rejected
  - Dialog for adding admin notes
- **Status Updates**:
  - Confirmed: stores confirmation timestamp and admin note
  - Rejected: refunds balance, creates refund transaction, stores rejection note
- **Real-Time Updates**:
  - Users see status changes via WebSocket (withdrawal_status_update event)
  - Admin dashboard updates when new requests arrive

### Staking System ✅ (SIMULATED)
- Crypto wallet (USDT, BTC, ETH)
- Escrow system for locked funds
- 2% arbiter fee (configurable)
- Real wallet addresses for deposits

### Admin Panel ✅
- Platform statistics dashboard
- User management (view, ban/unban)
- **Withdrawal Management** (NEW)
- Balance adjustment controls
- Anti-cheat flagged players
- Tournament management
- Settings management

## API Endpoints

### Withdrawal Management
- POST `/api/wallet/withdraw` - Submit withdrawal request
- GET `/api/wallet/withdrawals` - User's withdrawal history
- GET `/api/admin/withdrawals` - All withdrawals (admin)
- GET `/api/admin/withdrawals/pending` - Pending withdrawals (admin)
- PUT `/api/admin/withdrawals/{id}/confirm` - Confirm withdrawal (admin)
- PUT `/api/admin/withdrawals/{id}/reject` - Reject & refund (admin)

### Socket.IO Events
- `new_withdrawal` - Sent to admin_room when user submits withdrawal
- `withdrawal_status_update` - Sent to user when admin confirms/rejects
- `join_admin_room` - Admin joins notification room
- `join_user_room` - User joins personal notification room

## Database Schema

### withdrawals Collection
```javascript
{
  withdrawal_id: "wd_xxx",
  tx_id: "tx_xxx",
  user_id: "user_xxx",
  username: "testplayer",
  amount: 15.0,
  currency: "USDT",
  withdrawal_method: "crypto",
  wallet_address: "TLo5r4kXq...",
  status: "pending" | "confirmed" | "rejected",
  created_at: "2025-03-13T...",
  updated_at: "2025-03-13T...",
  confirmed_at: "2025-03-13T...",
  confirmed_by: "user_xxx",
  rejected_by: "user_xxx",
  admin_note: "Sent to wallet, tx: 0x..."
}
```

## Demo Credentials
- **Admin**: admin@stakechess.com / admin123
- **Test Player**: test@test.com / test123

## Notes
- **MOCKED**: All crypto functionality is SIMULATED
- Withdrawals require manual admin confirmation
- Rejected withdrawals are automatically refunded
