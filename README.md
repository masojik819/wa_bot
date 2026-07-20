# WhatsApp Bot API

A REST API for sending WhatsApp messages using the Baileys library. This project allows applications to send messages, send messages to groups, retrieve WhatsApp groups, and automatically reconnect when the connection is lost.

## Features

- Send WhatsApp messages
- Send messages to WhatsApp groups
- Get list of joined WhatsApp groups
- QR Code login
- Automatic reconnection
- MySQL logging
- Express REST API
- Multi-file authentication
- Heartbeat monitoring
- PM2 ready

---

## Tech Stack

- Node.js
- Express.js
- Baileys
- MySQL
- QRCode
- PM2

---

## Project Structure

```
wa_bot/
├── node_modules/  
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
│
├── auth/                 # Not uploaded
├── backup/               # Not uploaded
└── logs/
```

---

## Installation

Clone the repository

```bash
git clone https://github.com/yourusername/wa-bot.git
```

Go to project directory

```bash
cd wa-bot
```

Install dependencies

```bash
npm install
```

---

## Configuration

Create a `.env` file

```env
PORT=3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=wa_bot
```

Update your database configuration in the application if needed.

---

## Run Project

Development

```bash
node index.js
```

or

```bash
npm start
```

Using PM2

```bash
pm2 start index.js --name wa-bot
```

---

## Authentication

When the application starts for the first time, a QR Code will be generated.

Open:

```
WhatsApp
Settings
Linked Devices
Link a Device
```

Scan the QR Code.

Authentication data will be stored inside the **auth/** directory.

> **Do not upload this folder to GitHub.**

---

## API Endpoints

### Send Message

```
POST /send
```

Example Request

```json
{
    "number": "6281234567890",
    "message": "Hello World"
}
```

---

### Send Group Message

```
POST /send-group
```

Example Request

```json
{
    "groupId": "120xxxxxxxx@g.us",
    "message": "Hello Group"
}
```

---

### Get Groups

```
GET /groups
```

---

## Logging

Every outgoing message can be stored in MySQL for monitoring and history.

---

## Security

The following files should never be committed:

```
auth/
backup/
node_modules/
.env
```

Example `.gitignore`

```gitignore
node_modules/
auth/
backup/
.env
.env.*
```

---

## Future Improvements

- Message scheduling
- Media upload
- Image sending
- Document sending
- Contact sending
- Location sending
- Web Dashboard
- User Authentication
- Message Queue

---

## License

This project is for learning and internal development purposes.

---

## Author

**Ahmad Fauzi**

Software Developer

- GitHub: https://github.com/masojik819
- LinkedIn: https://linkedin.id/in/ahmadfauzi819
