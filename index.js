// ===============================
// WHATSAPP BOT STABLE 2026
// ===============================

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import express from "express";
import cors from "cors";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { Boom } from "@hapi/boom";

// ===============================
// CONFIG
// ===============================
const PORT = 3000;
const AUTH_DIR = "./auth";
const QR_DIR = "./qrcodes";
const RECONNECT_DELAY = 5000;
const HEARTBEAT_INTERVAL = 60_000;
const DB_PING_INTERVAL = 60_000;

// ===============================
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

// ===============================
// MYSQL
// ===============================
const db = mysql.createPool({
  host: "localhost",
  user: "",
  password: "",
  database: "",
  waitForConnections: true,
  connectionLimit: 10
});

async function saveLog(event, message) {
  try {
    await db.query(
      "INSERT INTO logs (event, message, created_at) VALUES (?, ?, NOW())",
      [event, message]
    );
  } catch (e) {
    console.error("LOG ERROR:", e.message);
  }
}

// ===============================
// EXPRESS
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// GLOBAL STATE
// ===============================
let sock;
let starting = false;
let heartbeat;

// ===============================
// UTILS
// ===============================
function clearQR() {
  if (!fs.existsSync(QR_DIR)) return;
  fs.readdirSync(QR_DIR).forEach(f => {
    try { fs.unlinkSync(path.join(QR_DIR, f)); } catch {}
  });
}

function removeAuth() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log("🗑️ auth deleted");
  }
}

// ===============================
// START BOT
// ===============================
async function startBot() {
  if (starting) return;
  starting = true;

  try {
    console.log("🔁 Starting WhatsApp...");
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try { sock.ws.close(); } catch {}
      try { sock.ev.removeAllListeners(); } catch {}
    }

    sock = makeWASocket({
      version,
      auth: state,
      browser: ["Windows", "Chrome", "10"],
      printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
      const { connection, qr, lastDisconnect } = u;

      if (qr && !state.creds.registered) {
        clearQR();
        const file = path.join(QR_DIR, `qr-${Date.now()}.png`);
        await qrcode.toFile(file, qr);
        console.log("📸 QR saved:", file);
        await saveLog("qr", "QR generated");
      }

      if (connection === "open") {
        console.log("✅ CONNECTED");
        clearQR();
        await saveLog("connected", "WhatsApp connected");
        starting = false;
        startHeartbeat();
      }

      if (connection === "close") {
        stopHeartbeat();

        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log("❌ DISCONNECTED:", reason);
        await saveLog("disconnect", String(reason));

        if (
          reason === DisconnectReason.loggedOut ||
          reason === DisconnectReason.conflict ||
          reason === 401
        ) {
          console.log("🚪 Permanent logout / conflict");
          removeAuth();
          process.exit(1);
        }

        setTimeout(startBot, RECONNECT_DELAY);
      }
    });

    starting = false;
  } catch (e) {
    console.error("startBot error:", e);
    await saveLog("fatal", e.message);
    process.exit(1);
  }
}

// ===============================
// HEARTBEAT
// ===============================
function startHeartbeat() {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    if (!sock?.user) {
      console.log("⚠️ Heartbeat lost");
      process.exit(1);
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
}

// ===============================
// DB PING
// ===============================
setInterval(async () => {
  try {
    const c = await db.getConnection();
    await c.ping();
    c.release();
  } catch (e) {
    console.error("DB ping error:", e.message);
    await saveLog("db_error", e.message);
  }
}, DB_PING_INTERVAL);

// ===============================
// API
// ===============================
app.post("/send", async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) return res.status(400).json({ error: "Invalid payload" });

  try {
    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
    const r = await sock.sendMessage(jid, { text: message });
    await saveLog("send", number);
    res.json({ success: true, id: r.key.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/send-group", async (req, res) => {
  const { group_id, message } = req.body;
  if (!group_id || !message) return res.status(400).json({ error: "Invalid payload" });

  try {
    const gid = group_id.includes("@") ? group_id : group_id + "@g.us";
    const r = await sock.sendMessage(gid, { text: message });
    await saveLog("send_group", gid);
    res.json({ success: true, id: r.key.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/groups", async (req, res) => {
  const groups = await sock.groupFetchAllParticipating();
  res.json(Object.values(groups).map(g => ({
    id: g.id,
    name: g.subject,
    members: g.participants.length
  })));
});

app.post("/group-info", async (req, res) => {
  const { invite_link } = req.body;

  if (!invite_link) {
    return res.status(400).json({
      success: false,
      message: "invite_link wajib diisi"
    });
  }

  try {

    const inviteCode = invite_link.split("/").pop().trim();

    const info = await sock.groupGetInviteInfo(inviteCode);

    res.json({
      success: true,
      group_id: info.id,
      group_name: info.subject,
      size: info.size
    });

  } catch (e) {

    res.status(500).json({
      success: false,
      error: e.message
    });

  }
});

app.get("/status", (req, res) => {
  res.json({ connected: !!sock?.user, user: sock?.user || null });
});

app.get("/logs", async (req, res) => {
  try {
    // sanitize limit
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 500) limit = 500; // safety cap

    const [rows] = await db.query(
      "SELECT * FROM logs ORDER BY created_at DESC LIMIT " + limit
    );

    res.json({
      status: "success",
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error("❌ /logs error:", err?.message || err);

    // ⚠️ jangan bikin infinite loop kalau DB error
    try {
      await saveLog("logs_error", err?.message || String(err));
    } catch (_) {}

    res.status(500).json({
      status: "error",
      error: err?.message || String(err)
    });
  }
});


// ===============================
app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
startBot();
