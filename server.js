const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const PORT = 8080;
const DB_FILE = 'storage.db';

let db;

// Helper to open DB
function dbOpen() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Helper to close DB
function dbClose() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Database helper functions
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Initialize DB schema
async function initDbTables() {
    // Create tables
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL
        );
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS bookings (
            srCode TEXT PRIMARY KEY,
            farmerName TEXT NOT NULL,
            phone TEXT NOT NULL,
            nid TEXT,
            address TEXT,
            crop TEXT NOT NULL,
            totalBags INTEGER NOT NULL,
            storedBags INTEGER NOT NULL,
            chamber TEXT NOT NULL,
            rack TEXT NOT NULL,
            rentRate INTEGER NOT NULL,
            advance INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL
        );
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            srCode TEXT NOT NULL,
            farmerName TEXT NOT NULL,
            phone TEXT NOT NULL,
            pledgedBags INTEGER NOT NULL,
            principal INTEGER NOT NULL,
            interestRate INTEGER NOT NULL,
            disbursementDate TEXT NOT NULL,
            status TEXT NOT NULL
        );
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS chalans (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            srCode TEXT NOT NULL,
            farmerName TEXT NOT NULL,
            bags INTEGER NOT NULL,
            truckNo TEXT,
            laborCharge INTEGER NOT NULL,
            operator TEXT NOT NULL
        );
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS chambers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            temp REAL NOT NULL,
            humidity REAL NOT NULL,
            capacity INTEGER NOT NULL
        );
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS chamber_racks (
            chamberId TEXT NOT NULL,
            rackId TEXT NOT NULL,
            name TEXT NOT NULL,
            stored INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            PRIMARY KEY (chamberId, rackId)
        );
    `);

    // Seed if users is empty
    const userCount = await dbGet("SELECT COUNT(*) as count FROM users");
    if (userCount.count === 0) {
        await seedData();
    }
}

// Seed initial data
async function seedData() {
    console.log("Seeding initial database values...");

    // 1. Seed user
    await dbRun("INSERT OR REPLACE INTO users (username, password) VALUES (?, ?)", ['admin', 'shebacold']);

    // 2. Seed bookings
    const bookings = [
        ["SR-2026-001", "Md. Rafiqul Islam (রফিকুল ইসলাম)", "01712345678", "1985269123456", "Joypurhat Sadar, Joypurhat", "Cardinal Potato", 150, 100, "Chamber-01", "R-01", 250, 2000, "2026-03-12", "Loan Pledged"],
        ["SR-2026-002", "Alhaj Mokbul Hossain (মকবুল হোসেন)", "01819876543", "1972569789123", "Kalai, Joypurhat", "Diamant Potato", 300, 300, "Chamber-02", "R-02", 250, 5000, "2026-03-15", "Stored"],
        ["SR-2026-003", "Sree Niren Chandra (নীরেন চন্দ্র)", "01911223344", "1988269112233", "Panchbibi, Joypurhat", "Granola Potato", 80, 0, "Chamber-03", "R-04", 240, 0, "2026-03-18", "Released"],
        ["SR-2026-004", "Md. Anisur Rahman (আনিসুর রহমান)", "01552345678", "1980269324512", "Khetlal, Joypurhat", "Onion", 120, 120, "Chamber-01", "R-03", 260, 1000, "2026-03-20", "Stored"]
    ];
    for (const b of bookings) {
        await dbRun("INSERT OR REPLACE INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", b);
    }

    // 3. Seed loan
    await dbRun("INSERT OR REPLACE INTO loans (srCode, farmerName, phone, pledgedBags, principal, interestRate, disbursementDate, status) VALUES (?,?,?,?,?,?,?,?)",
        ["SR-2026-001", "Md. Rafiqul Islam (রফিকুল ইসলাম)", "01712345678", 150, 30000, 12, "2026-03-20", "Active"]
    );

    // 4. Seed chalans
    const chalans = [
        ["CH-2026-001", "IN", "2026-03-12 09:30 AM", "SR-2026-001", "Md. Rafiqul Islam", 150, "Bogura Metro-Ta 11-4567", 1200, "Abu Zannat"],
        ["CH-2026-002", "IN", "2026-03-15 11:15 AM", "SR-2026-002", "Alhaj Mokbul Hossain", 300, "Dhaka Metro-Ta 13-9876", 2400, "Abu Zannat"],
        ["CH-2026-003", "IN", "2026-03-18 02:40 PM", "SR-2026-003", "Sree Niren Chandra", 80, "Kariman Local V-12", 640, "Abu Zannat"],
        ["CH-2026-004", "OUT", "2026-06-10 10:00 AM", "SR-2026-001", "Md. Rafiqul Islam", 50, "Naseemon V-44", 400, "Abu Zannat"],
        ["CH-2026-005", "OUT", "2026-06-15 04:30 PM", "SR-2026-003", "Sree Niren Chandra", 80, "Pick-up Dhaka Metro-Na 21-3456", 640, "Abu Zannat"]
    ];
    for (const c of chalans) {
        await dbRun("INSERT OR REPLACE INTO chalans VALUES (?,?,?,?,?,?,?,?,?)", c);
    }

    // 5. Seed chambers
    const chambers = [
        ["Chamber-01", "Chamber 01 (Cardinal Potato)", 2.4, 88, 15000],
        ["Chamber-02", "Chamber 02 (White Potato)", 3.1, 87, 15000],
        ["Chamber-03", "Chamber 03 (Seed Potato & Onion)", 4.2, 90, 20000]
    ];
    for (const ch of chambers) {
        await dbRun("INSERT OR REPLACE INTO chambers VALUES (?,?,?,?,?)", ch);
    }

    // 6. Seed chamber racks
    const racks = [
        ["Chamber-01", "R-01", "Rack 01", 8500, 10000],
        ["Chamber-01", "R-02", "Rack 02", 4200, 5000],
        ["Chamber-01", "R-03", "Rack 03", 1100, 5000],
        ["Chamber-01", "R-04", "Rack 04", 300, 5000],
        
        ["Chamber-02", "R-01", "Rack 01", 9800, 10000],
        ["Chamber-02", "R-02", "Rack 02", 4900, 5000],
        ["Chamber-02", "R-03", "Rack 03", 4600, 5000],
        ["Chamber-02", "R-04", "Rack 04", 1200, 5000],
        
        ["Chamber-03", "R-01", "Rack 01", 10000, 10000],
        ["Chamber-03", "R-02", "Rack 02", 4000, 5000],
        ["Chamber-03", "R-03", "Rack 03", 1000, 5000],
        ["Chamber-03", "R-04", "Rack 04", 4800, 5000]
    ];
    for (const r of racks) {
        await dbRun("INSERT OR REPLACE INTO chamber_racks VALUES (?,?,?,?,?)", r);
    }

    console.log("Database seeded successfully.");
}

// Create Express Server
const app = express();
app.use(express.json());

// Routes

// GET State
app.get('/api/state', async (req, res) => {
    try {
        const bookings = await dbAll("SELECT * FROM bookings");
        const loans = await dbAll("SELECT * FROM loans");
        const chalans = await dbAll("SELECT * FROM chalans");
        
        const chambersRaw = await dbAll("SELECT * FROM chambers");
        const chambers = [];
        for (const ch of chambersRaw) {
            const racks = await dbAll("SELECT rackId as id, name, stored, capacity FROM chamber_racks WHERE chamberId=?", [ch.id]);
            chambers.push({
                ...ch,
                racks
            });
        }

        res.json({ bookings, loans, chalans, chambers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await dbGet("SELECT * FROM users WHERE username=? AND password=?", [username, password]);
        if (user) {
            res.json({ success: true, token: "sheba_session_token_xyz" });
        } else {
            res.status(401).json({ success: false, message: "Invalid username or password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Bookings
app.post('/api/bookings', async (req, res) => {
    try {
        const data = req.body;
        
        // Insert Booking
        await dbRun(`
            INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            data.srCode, data.farmerName, data.phone, data.nid,
            data.address, data.crop, data.totalBags, data.storedBags,
            data.chamber, data.rack, data.rentRate, data.advance,
            data.date, data.status
        ]);

        // Insert matching intake chalan
        const allChalans = await dbAll("SELECT id FROM chalans");
        const chalanId = `CH-2026-${String(allChalans.length + 1).padStart(3, '0')}`;
        await dbRun(`
            INSERT INTO chalans VALUES (?,?,?,?,?,?,?,?,?)
        `, [
            chalanId, "IN", `${data.date} 09:00 AM`, data.srCode,
            data.farmerName, data.totalBags, "Farmer Delivery Cart",
            data.totalBags * 8, "Abu Zannat"
        ]);

        // Update Rack
        await dbRun(`
            UPDATE chamber_racks SET stored = stored + ? WHERE chamberId=? AND rackId=?
        `, [data.totalBags, data.chamber, data.rack]);

        res.json({ success: true, srCode: data.srCode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Loans
app.post('/api/loans', async (req, res) => {
    try {
        const data = req.body;
        
        // Insert Loan
        await dbRun(`
            INSERT INTO loans (srCode, farmerName, phone, pledgedBags, principal, interestRate, disbursementDate, status)
            VALUES (?,?,?,?,?,?,?,?)
        `, [
            data.srCode, data.farmerName, data.phone, data.pledgedBags,
            data.principal, data.interestRate, data.disbursementDate, data.status
        ]);

        // Update Booking status
        await dbRun("UPDATE bookings SET status='Loan Pledged' WHERE srCode=?", [data.srCode]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Chalans
app.post('/api/chalans', async (req, res) => {
    try {
        const data = req.body;
        const allChalans = await dbAll("SELECT id FROM chalans");
        const chalanId = `CH-2026-${String(allChalans.length + 1).padStart(3, '0')}`;

        await dbRun(`
            INSERT INTO chalans VALUES (?,?,?,?,?,?,?,?,?)
        `, [
            chalanId, data.type, data.date, data.srCode,
            data.farmerName, data.bags, data.truckNo,
            data.laborCharge, data.operator
        ]);

        // Update Booking stock & status
        const booking = await dbGet("SELECT storedBags, totalBags, chamber, rack FROM bookings WHERE srCode=?", [data.srCode]);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const { storedBags, totalBags, chamber, rack } = booking;
        if (data.type === "IN") {
            const newStored = storedBags + data.bags;
            const newTotal = totalBags + data.bags;
            await dbRun("UPDATE bookings SET storedBags=?, totalBags=?, status='Stored' WHERE srCode=?",
                [newStored, newTotal, data.srCode]);
            await dbRun("UPDATE chamber_racks SET stored=stored+? WHERE chamberId=? AND rackId=?",
                [data.bags, chamber, rack]);
        } else {
            const newStored = Math.max(0, storedBags - data.bags);
            const newStatus = newStored === 0 ? 'Released' : 'Stored';
            await dbRun("UPDATE bookings SET storedBags=?, status=? WHERE srCode=?",
                [newStored, newStatus, data.srCode]);
            await dbRun("UPDATE chamber_racks SET stored=MAX(0, stored-?) WHERE chamberId=? AND rackId=?",
                [data.bags, chamber, rack]);
        }

        res.json({ success: true, chalanId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Settle
app.post('/api/settle', async (req, res) => {
    try {
        const { srCode } = req.body;
        const booking = await dbGet("SELECT storedBags, farmerName, chamber, rack FROM bookings WHERE srCode=?", [srCode]);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const { storedBags, farmerName, chamber, rack } = booking;

        // Add Gate Out Challan if stock remaining
        if (storedBags > 0) {
            const allChalans = await dbAll("SELECT id FROM chalans");
            const chalanId = `CH-2026-${String(allChalans.length + 1).padStart(3, '0')}`;
            
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
            await dbRun(`
                INSERT INTO chalans VALUES (?,?,?,?,?,?,?,?,?)
            `, [
                chalanId, "OUT", `${dateStr} 03:00 PM`,
                srCode, farmerName, storedBags, "Settle & Settle Release Cart",
                storedBags * 8, "Abu Zannat"
            ]);

            // Update rack stock
            await dbRun("UPDATE chamber_racks SET stored=MAX(0, stored-?) WHERE chamberId=? AND rackId=?",
                [storedBags, chamber, rack]);
        }

        // Set Booking status and stored bags to 0
        await dbRun("UPDATE bookings SET storedBags=0, status='Released' WHERE srCode=?", [srCode]);

        // Set Loan status to Settle Cleared
        await dbRun("UPDATE loans SET status='Settle Cleared' WHERE srCode=? AND status='Active'", [srCode]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Ventilation
app.post('/api/ventilation', async (req, res) => {
    try {
        const { temp, humidity, chamberId } = req.body;
        await dbRun("UPDATE chambers SET temp=?, humidity=? WHERE id=?", [temp, humidity, chamberId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Backup
app.get('/api/backup', (req, res) => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return res.status(404).json({ error: "No database file to backup" });
        }
        
        const now = new Date();
        const format2 = n => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${format2(now.getMonth()+1)}${format2(now.getDate())}_${format2(now.getHours())}${format2(now.getMinutes())}${format2(now.getSeconds())}`;
        
        res.attachment(`sheba_backup_${timestamp}.db`);
        res.sendFile(path.resolve(DB_FILE), { dotfiles: 'allow' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Restore
app.post('/api/restore', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
    try {
        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ error: "Empty restore body" });
        }

        await dbClose();
        fs.writeFileSync(DB_FILE, req.body);
        await dbOpen();
        await initDbTables();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Reset
app.post('/api/reset', async (req, res) => {
    try {
        await dbClose();
        if (fs.existsSync(DB_FILE)) {
            fs.unlinkSync(DB_FILE);
        }
        await dbOpen();
        await initDbTables();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend static files
app.use(express.static(__dirname));

// Start server
async function start() {
    await dbOpen();
    await initDbTables();
    console.log("Initiated SQLite Database Schema & Seed Data.");
    
    app.listen(PORT, () => {
        console.log(`Sheba Cold Storage Server running at http://localhost:${PORT}/`);
    });
}

start().catch(err => {
    console.error("Failed to start server:", err);
});
