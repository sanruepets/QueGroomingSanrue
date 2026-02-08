const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Configuration
const KEY_FILE = path.join(__dirname, 'service_account.json');
const CALENDAR_ID = 'primary';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (frontend)

// Explicit route for dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Helper: Format Date for Description
function formatDateTimeForDesc(dateObj) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year}\n เวลา ${hours}:${minutes}`;
}

// Helper: Create Event Payload (Same logic as test script)
function createEventPayload(queue) {
    const petTypeTH = (queue.petType === 'dog' || queue.petType === 'สุนัข') ? 'หมา' : 'แมว';
    const serviceStr = Array.isArray(queue.services) ? queue.services.join(', ') : (queue.services || '-');

    // Delivery Logic
    let deliveryDesc = "";
    let deliveryTitle = "";
    if (queue.transport) {
        const transportDetails = queue.transportDetails || "";
        deliveryDesc = "\n" + "บริการรับ-ส่ง " + transportDetails;
        deliveryTitle = "บริการรับ-ส่ง " + transportDetails;
    }

    // Construct Date Objects
    // queue.date is YYYY-MM-DD, queue.appointmentTime is HH:mm
    const startDate = new Date(`${queue.date}T${queue.appointmentTime}`);
    const endDate = new Date(startDate.getTime() + (queue.duration || 90) * 60000);

    // Message Description
    let message = "\n สรุปจองคิวอาบ-ตัดขน 🐶🐱"
        + "\n" + "วันที่ " + formatDateTimeForDesc(startDate) + deliveryDesc
        + "\n" + "_________________________"
        + "\n" + "สัตว์อะไร: " + petTypeTH
        + "\n" + "พันธุ์อะไร: " + (queue.petBreed || '-')
        + "\n" + "น้ำหนักโดยประมาณ: " + (queue.checkInWeight || '-')
        + "\n" + "ทำอะไร: " + serviceStr
        + "\n" + "ชื่อน้อง: " + queue.petName
        + "\n" + "โรคประจำตัวและเห็บ-หมัด: " + (queue.checkInNotes || '-')
        + "\n" + "ชื่อผู้ปกครอง: " + queue.customerName
        + "\n" + "เบอร์ติดต่อกลับ: " + queue.customerPhone
        + "\n" + "_________________________"
        + "\n" + "รายละเอียดเพิ่มเติม: " + (queue.specialRequests || '-')
        + "\n" + "ชำระมัดจำ: " + (queue.depositAmount || '-')
        + "\n" + "ช่องทางการจอง: " + (queue.marketingSource || '-')
        + "\n" + "ผู้รับคิว: " + (queue.groomerName || 'Admin') + " ";

    // Color Logic
    let colorId = "4";
    const isBathOnly = serviceStr.includes('อาบน้ำ') && !serviceStr.includes('ตัดขน') && !serviceStr.includes('ไถ');

    if (petTypeTH === 'หมา' && !isBathOnly) {
        colorId = "3"; // Grape
    } else if (petTypeTH === 'แมว' && !isBathOnly) {
        colorId = "1"; // Lavender
    } else if (petTypeTH === 'หมา' && isBathOnly) {
        colorId = "6"; // Tangerine
    } else if (petTypeTH === 'แมว' && isBathOnly) {
        colorId = "5"; // Banana
    }

    // Title
    const title = `${petTypeTH} ${queue.petName} ${serviceStr} ${deliveryTitle}`;

    return {
        summary: title,
        description: message,
        location: 'Que Sanrue Grooming',
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        colorId: colorId
    };
}

// API Endpoint to Create Event
app.post('/api/calendar/create-event', async (req, res) => {
    try {
        if (!fs.existsSync(KEY_FILE)) {
            throw new Error('service_account.json not found');
        }

        const queueData = req.body;
        console.log('Received queue data for calendar:', queueData.id);

        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const calendar = google.calendar({ version: 'v3', auth });
        const eventPayload = createEventPayload(queueData);

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: eventPayload,
        });

        console.log('✅ Calendar Event Created:', response.data.htmlLink);
        res.json({ success: true, link: response.data.htmlLink });

    } catch (error) {
        console.error('❌ Calendar Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📅 Calendar API ready at http://localhost:${PORT}/api/calendar/create-event`);
});
