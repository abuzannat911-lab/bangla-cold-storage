const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const DB_FILE = 'storage.json';

// Default seed data
const DEFAULT_DATA = {
    users: [
        { username: "admin", password: "shebacold" }
    ],
    bookings: [
        { srCode: "SR-2026-001", farmerName: "Md. Rafiqul Islam (রফিকুল ইসলাম)", phone: "01712345678", nid: "1985269123456", address: "Joypurhat Sadar, Joypurhat", crop: "Cardinal Potato", totalBags: 150, storedBags: 100, chamber: "Chamber-01", rack: "R-01", rentRate: 250, advance: 2000, date: "2026-03-12", status: "Loan Pledged" },
        { srCode: "SR-2026-002", farmerName: "Alhaj Mokbul Hossain (মকবুল হোসেন)", phone: "01819876543", nid: "1972569789123", address: "Kalai, Joypurhat", crop: "Diamant Potato", totalBags: 300, storedBags: 300, chamber: "Chamber-02", rack: "R-02", rentRate: 250, advance: 5000, date: "2026-03-15", status: "Stored" },
        { srCode: "SR-2026-003", farmerName: "Sree Niren Chandra (নীরেন চন্দ্র)", phone: "01911223344", nid: "1988269112233", address: "Panchbibi, Joypurhat", crop: "Granola Potato", totalBags: 80, storedBags: 0, chamber: "Chamber-03", rack: "R-04", rentRate: 240, advance: 0, date: "2026-03-18", status: "Released" },
        { srCode: "SR-2026-004", farmerName: "Md. Anisur Rahman (আনিসুর রহমান)", phone: "01552345678", nid: "1980269324512", address: "Khetlal, Joypurhat", crop: "Onion", totalBags: 120, storedBags: 120, chamber: "Chamber-01", rack: "R-03", rentRate: 260, advance: 1000, date: "2026-03-20", status: "Stored" }
    ],
    loans: [
        { id: 1, srCode: "SR-2026-001", farmerName: "Md. Rafiqul Islam (রফিকুল ইসলাম)", phone: "01712345678", pledgedBags: 150, principal: 30000, interestRate: 12, disbursementDate: "2026-03-20", status: "Active" }
    ],
    chalans: [
        { id: "CH-2026-001", type: "IN", date: "2026-03-12 09:30 AM", srCode: "SR-2026-001", farmerName: "Md. Rafiqul Islam", bags: 150, truckNo: "Bogura Metro-Ta 11-4567", laborCharge: 1200, operator: "Abu Zannat" },
        { id: "CH-2026-002", type: "IN", date: "2026-03-15 11:15 AM", srCode: "SR-2026-002", farmerName: "Alhaj Mokbul Hossain", bags: 300, truckNo: "Dhaka Metro-Ta 13-9876", laborCharge: 2400, operator: "Abu Zannat" },
        { id: "CH-2026-003", type: "IN", date: "2026-03-18 02:40 PM", srCode: "SR-2026-003", farmerName: "Sree Niren Chandra", bags: 80, truckNo: "Kariman Local V-12", laborCharge: 640, operator: "Abu Zannat" },
        { id: "CH-2026-004", type: "OUT", date: "2026-06-10 10:00 AM", srCode: "SR-2026-001", farmerName: "Md. Rafiqul Islam", bags: 50, truckNo: "Naseemon V-44", laborCharge: 400, operator: "Abu Zannat" },
        { id: "CH-2026-005", type: "OUT", date: "2026-06-15 04:30 PM", srCode: "SR-2026-003", farmerName: "Sree Niren Chandra", bags: 80, truckNo: "Pick-up Dhaka Metro-Na 21-3456", laborCharge: 640, operator: "Abu Zannat" }
    ],
    chambers: [
        { id: "Chamber-01", name: "Chamber 01 (Cardinal Potato)", temp: 2.4, humidity: 88, capacity: 15000 },
        { id: "Chamber-02", name: "Chamber 02 (White Potato)", temp: 3.1, humidity: 87, capacity: 15000 },
        { id: "Chamber-03", name: "Chamber 03 (Seed Potato & Onion)", temp: 4.2, humidity: 90, capacity: 20000 }
    ],
    chamber_racks: [
        { chamberId: "Chamber-01", rackId: "R-01", name: "Rack 01", stored: 8500, capacity: 10000 },
        { chamberId: "Chamber-01", rackId: "R-02", name: "Rack 02", stored: 4200, capacity: 5000 },
        { chamberId: "Chamber-01", rackId: "R-03", name: "Rack 03", stored: 1100, capacity: 5000 },
        { chamberId: "Chamber-01", rackId: "R-04", name: "Rack 04", stored: 300, capacity: 5000 },
        
        { chamberId: "Chamber-02", rackId: "R-01", name: "Rack 01", stored: 9800, capacity: 10000 },
        { chamberId: "Chamber-02", rackId: "R-02", name: "Rack 02", stored: 4900, capacity: 5000 },
        { chamberId: "Chamber-02", rackId: "R-03", name: "Rack 03", stored: 4600, capacity: 5000 },
        { chamberId: "Chamber-02", rackId: "R-04", name: "Rack 04", stored: 1200, capacity: 5000 },
        
        { chamberId: "Chamber-03", rackId: "R-01", name: "Rack 01", stored: 10000, capacity: 10000 },
        { chamberId: "Chamber-03", rackId: "R-02", name: "Rack 02", stored: 4000, capacity: 5000 },
        { chamberId: "Chamber-03", rackId: "R-03", name: "Rack 03", stored: 1000, capacity: 5000 },
        { chamberId: "Chamber-03", rackId: "R-04", name: "Rack 04", stored: 4800, capacity: 5000 }
    ]
};

// Database helper functions
function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Create Express app
const app = express();
app.use(express.json());

// GET State
app.get('/api/state', (req, res) => {
    try {
        const data = loadData();
        const chambers = data.chambers.map(ch => {
            const racks = data.chamber_racks
                .filter(r => r.chamberId === ch.id)
                .map(r => ({
                    id: r.rackId,
                    name: r.name,
                    stored: r.stored,
                    capacity: r.capacity
                }));
            return {
                ...ch,
                racks
            };
        });
        res.json({
            bookings: data.bookings,
            loans: data.loans,
            chalans: data.chalans,
            chambers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Login
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const data = loadData();
        const user = data.users.find(u => u.username === username && u.password === password);
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
app.post('/api/bookings', (req, res) => {
    try {
        const booking = req.body;
        const data = loadData();

        // Save booking
        data.bookings.push(booking);

        // Add matching intake chalan
        const chalanId = `CH-2026-${String(data.chalans.length + 1).padStart(3, '0')}`;
        data.chalans.push({
            id: chalanId,
            type: "IN",
            date: `${booking.date} 09:00 AM`,
            srCode: booking.srCode,
            farmerName: booking.farmerName,
            bags: booking.totalBags,
            truckNo: "Farmer Delivery Cart",
            laborCharge: booking.totalBags * 8,
            operator: "Abu Zannat"
        });

        // Update Rack
        const rack = data.chamber_racks.find(r => r.chamberId === booking.chamber && r.rackId === booking.rack);
        if (rack) {
            rack.stored += booking.totalBags;
        }

        saveData(data);
        res.json({ success: true, srCode: booking.srCode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Loans
app.post('/api/loans', (req, res) => {
    try {
        const loan = req.body;
        const data = loadData();

        // Increment loan ID
        const nextId = data.loans.reduce((max, l) => l.id > max ? l.id : max, 0) + 1;
        loan.id = nextId;

        // Save loan
        data.loans.push(loan);

        // Update Booking status
        const booking = data.bookings.find(b => b.srCode === loan.srCode);
        if (booking) {
            booking.status = 'Loan Pledged';
        }

        saveData(data);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Chalans
app.post('/api/chalans', (req, res) => {
    try {
        const chalanInput = req.body;
        const data = loadData();

        const chalanId = `CH-2026-${String(data.chalans.length + 1).padStart(3, '0')}`;
        const newChalan = {
            id: chalanId,
            ...chalanInput
        };

        data.chalans.push(newChalan);

        // Update Booking stock & status
        const booking = data.bookings.find(b => b.srCode === newChalan.srCode);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const rack = data.chamber_racks.find(r => r.chamberId === booking.chamber && r.rackId === booking.rack);

        if (newChalan.type === "IN") {
            booking.storedBags += newChalan.bags;
            booking.totalBags += newChalan.bags;
            booking.status = 'Stored';
            if (rack) {
                rack.stored += newChalan.bags;
            }
        } else {
            booking.storedBags = Math.max(0, booking.storedBags - newChalan.bags);
            booking.status = booking.storedBags === 0 ? 'Released' : 'Stored';
            if (rack) {
                rack.stored = Math.max(0, rack.stored - newChalan.bags);
            }
        }

        saveData(data);
        res.json({ success: true, chalanId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Settle
app.post('/api/settle', (req, res) => {
    try {
        const { srCode } = req.body;
        const data = loadData();

        const booking = data.bookings.find(b => b.srCode === srCode);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const remainingBags = booking.storedBags;

        // Add Gate Out Challan if stock remaining
        if (remainingBags > 0) {
            const chalanId = `CH-2026-${String(data.chalans.length + 1).padStart(3, '0')}`;
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            data.chalans.push({
                id: chalanId,
                type: "OUT",
                date: `${dateStr} 03:00 PM`,
                srCode,
                farmerName: booking.farmerName,
                bags: remainingBags,
                truckNo: "Settle & Settle Release Cart",
                laborCharge: remainingBags * 8,
                operator: "Abu Zannat"
            });

            // Update rack stock
            const rack = data.chamber_racks.find(r => r.chamberId === booking.chamber && r.rackId === booking.rack);
            if (rack) {
                rack.stored = Math.max(0, rack.stored - remainingBags);
            }
        }

        // Set Booking status and stored bags to 0
        booking.storedBags = 0;
        booking.status = 'Released';

        // Set Loan status to Settle Cleared
        const activeLoan = data.loans.find(l => l.srCode === srCode && l.status === 'Active');
        if (activeLoan) {
            activeLoan.status = 'Settle Cleared';
        }

        saveData(data);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Ventilation
app.post('/api/ventilation', (req, res) => {
    try {
        const { temp, humidity, chamberId } = req.body;
        const data = loadData();

        const chamber = data.chambers.find(c => c.id === chamberId);
        if (chamber) {
            chamber.temp = temp;
            chamber.humidity = humidity;
        }

        saveData(data);
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
        
        res.attachment(`sheba_backup_${timestamp}.json`);
        res.sendFile(path.resolve(DB_FILE), { dotfiles: 'allow' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Restore
app.post('/api/restore', express.raw({ type: 'application/octet-stream', limit: '50mb' }), (req, res) => {
    try {
        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ error: "Empty restore body" });
        }

        // Write content
        fs.writeFileSync(DB_FILE, req.body);
        
        // Re-read data to verify valid JSON structure
        const testData = loadData();
        if (!testData.users || !testData.bookings) {
            throw new Error("Invalid schema");
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Reset
app.post('/api/reset', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            fs.unlinkSync(DB_FILE);
        }
        loadData(); // Re-creates and seeds DB_FILE
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend static files
app.use(express.static(__dirname));

// Initialize and Start Server
loadData();
app.listen(PORT, () => {
    console.log(`Sheba Cold Storage Server running on port ${PORT}`);
});
