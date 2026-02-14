// ===================================
// DEBUG LOGGING SYSTEM
// ===================================

class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.listeners = [];
    this.init();
  }

  init() {
    const originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      warn: console.warn.bind(console)
    };

    const levels = ['log', 'info', 'error', 'debug', 'warn'];

    levels.forEach(level => {
      console[level] = (...args) => {
        // Log to browser console as usual
        originalConsole[level](...args);

        // Save to internal log
        this.addLog(level, args);
      };
    });

    // Catch unhandled errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.addLog('error', [`Global Error: ${message} at ${source}:${lineno}:${colno}`]);
    };

    window.onunhandledrejection = (event) => {
      this.addLog('error', [`Promise Rejection: ${event.reason}`]);
    };
  }

  addLog(level, args) {
    const timestamp = new Date();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');

    const logEntry = {
      id: Date.now() + Math.random(),
      level: level === 'log' ? 'info' : level, // Normalize log to info for UI
      message,
      timestamp,
      type: this.categorizeLog(message, level)
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.notifyListeners(logEntry);
  }

  categorizeLog(message, level) {
    if (message.includes('Firestore') || message.includes('db.') || message.includes('fetching')) return 'http';
    if (level === 'error') return 'error';
    if (level === 'debug') return 'debug';
    return 'info';
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(log) {
    this.listeners.forEach(callback => callback(log));
  }

  clear() {
    this.logs = [];
    this.notifyListeners({ type: 'clear' });
  }

  getLogs(category = 'all') {
    if (category === 'all') return this.logs;
    return this.logs.filter(log => log.type === category);
  }
}

// Global logger instance
window.logger = new DebugLogger();

// ===================================
// DATA MODELS & STORAGE
// ===================================

class DataStore {
  constructor() {
    this.db = window.db; // From firebase-config.js
    this.data = {
      customers: [],
      pets: [],
      groomers: [],
      queue: [],
      serviceRecords: [],
      dailySchedules: [],
      users: [],
      settings: this.getDefaultSettings()
    };

    this.initializedCollections = new Set();
    this.initializedCollections = new Set();
    // OPTIMIZATION: Remove 'queue' and 'serviceRecords' from generic load
    this.initialCollections = ['customers', 'pets', 'groomers', 'dailySchedules', 'users'];

    // Initial data load
    this.initRealtimeListeners();
  }

  getDefaultSettings() {
    return {
      shopName: 'QueSanrue Grooming',
      queueNumberPrefix: 'Q',
      serviceTypes: [
        'อาบน้ำ',
        'อาบ Set C',
        'อาบประกวด',
        'อาบน้ำ-ตัดขน ด้วยกรรไกร',
        'อาบน้ำ-ตัดขน ด้วยปัตตาเลี่ยน',
        'อาบน้ำ พร้อมทำสปา',
        'ฝากเลี้ยง',
        'อื่นๆ'
      ],
      priceList: {
        'อาบน้ำ': 0,
        'อาบ Set C': 0,
        'อาบประกวด': 0,
        'อาบน้ำ-ตัดขน ด้วยกรรไกร': 0,
        'อาบน้ำ-ตัดขน ด้วยปัตตาเลี่ยน': 0,
        'อาบน้ำ พร้อมทำสปา': 0,
        'หมาใหญ่': 0,
        'ฝากเลี้ยง': 0,
        'อื่นๆ': 0
      },
      serviceDurations: {
        'อาบน้ำ': 60,
        'อาบ Set C': 60,
        'อาบประกวด': 60,
        'อาบน้ำ-ตัดขน ด้วยกรรไกร': 120,
        'อาบน้ำ-ตัดขน ด้วยปัตตาเลี่ยน': 120, // Formerly 90-120
        'อาบน้ำ พร้อมทำสปา': 90,
        'หมาใหญ่': 60,
        'ฝากเลี้ยง': 0,
        'อื่นๆ': 30
      },
      defaultWorkingHours: {
        start: '09:00',
        end: '18:00'
      },
      catPricing: {
        weightTiers: [
          { max: 2, short: 300, long: 400 },
          { max: 3.5, short: 350, long: 450 },
          { max: 5, short: 400, long: 500 },
          { max: 7, short: 500, long: 600 },
          { max: 10, short: 600, long: 700 },
          { max: 999, short: 700, long: 800 }
        ],
        addons: {
          'ตัดขน-ปัตตาเลี่ยน': 150,
          'ตัดขน-กรรไกร': 250,
          'ตัดเฉพาะจุด': 50,
          'แปรงฟัน': 50,
          'เชื้อรา': 80,
          'ทรีตเมนต์': 50,
          'ขจัดคราบมัน': 250, // Full body
          'หยดเห็บหมัด': 50,
          'สางสังกะตัง': 50, // Per spot
          'เครื่องเป่าขน': 50
        }
      }
    };
  }

  // Initialize listeners (Modified to use one-time get() for Safari compatibility)
  async initRealtimeListeners() {
    if (!this.db) {
      console.warn('Firestore not initialized, falling back to empty state');
      return;
    }

    const collections = this.initialCollections;

    const fetchPromises = collections.map(async (col) => {
      try {
        console.log(`[DEBUG] Fetching initial data for ${col}...`);
        const snapshot = await this.db.collection(col).get();
        this.data[col] = snapshot.docs.map(doc => {
          const data = doc.data();
          return { ...data, id: doc.id };
        });

        // Mark collection as initialized
        this.initializedCollections.add(col);
      } catch (error) {
        console.error(`Error fetching ${col}:`, error);
        if (error.code === 'permission-denied' && !window.hasShownPermissionError) {
          alert('⚠️ ไม่สามารถเข้าถึงข้อมูลได้ (Permission Denied)\nกรุณาตั้งค่า Firestore Rules ใน Firebase Console ให้เปิดใช้งาน');
          window.hasShownPermissionError = true;
        }
      }
    });

    // OPTIMIZATION: Fetch Queue specifically (Future + Last 7 Days only)
    const queuePromise = (async () => {
      try {
        console.log('[DEBUG] Fetching optimized queue data...');
        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 7); // Last 7 days
        const dateStr = pastDate.toISOString().split('T')[0];

        // Fetch queues with date >= 7 days ago
        const snapshot = await this.db.collection('queue')
          .where('date', '>=', dateStr)
          .get();

        this.data['queue'] = snapshot.docs.map(doc => {
          const data = doc.data();
          return { ...data, id: doc.id };
        });
        this.initializedCollections.add('queue');
        console.log(`[DEBUG] Loaded ${this.data.queue.length} active queue items`);
      } catch (err) {
        console.error('Error fetching optimized queue:', err);
      }
    })();

    // Wait for all fetches to complete (including queue)
    await Promise.all([...fetchPromises, queuePromise]);

    // After all fetches are done
    // Always notify app that initial data is loaded (or re-loaded/late-loaded)
    if (window.app) {
      console.log('[DEBUG] All initial collections loaded via GET');
      window.app.onInitDataLoaded();

      // OPTIMIZATION: Load Service Records in background AFTER UI render
      setTimeout(() => this.loadServiceRecordsInBackground(), 2000);
    }
  }

  async loadServiceRecordsInBackground() {
    console.log('[DEBUG] Loading service records in background...');
    try {
      const snapshot = await this.db.collection('serviceRecords')
        .orderBy('date', 'desc')
        .limit(100) // Limit to last 100 records initially
        .get();

      this.data['serviceRecords'] = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id };
      });
      this.initializedCollections.add('serviceRecords');
      console.log(`[DEBUG] Loaded ${this.data.serviceRecords.length} service records`);
    } catch (err) {
      console.warn('Background service record fetch failed:', err);
    }
  }

  // Async methods for adding data
  async addCustomer(customer) {
    const newCustomer = {
      ...customer,
      createdAt: new Date().toISOString(),
      lastVisit: new Date().toISOString()
    };

    // Add to Firestore
    try {
      const docRef = await this.db.collection('customers').add(newCustomer);
      const createdCustomer = { id: docRef.id, ...newCustomer };
      this.data.customers.push(createdCustomer);
      return createdCustomer;
    } catch (e) {
      console.error("Error adding customer: ", e);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + e.message);
      return null;
    }
  }

  async updateCustomer(id, updates) {
    try {
      await this.db.collection('customers').doc(id).update(updates);
      const index = this.data.customers.findIndex(c => c.id === id);
      if (index !== -1) {
        this.data.customers[index] = { ...this.data.customers[index], ...updates };
      }
      return { id, ...updates };
    } catch (e) {
      console.error("Error updating customer: ", e);
      alert('แก้ไขข้อมูลไม่สำเร็จ');
      return null;
    }
  }

  async deleteCustomer(id) {
    try {
      await this.db.collection('customers').doc(id).delete();
      this.data.customers = this.data.customers.filter(c => c.id !== id);
    } catch (e) {
      console.error("Error deleting customer: ", e);
      alert('ลบข้อมูลไม่สำเร็จ');
    }
  }

  // Helper for generating ID (not needed for Firestore but keeping for compat if needed elsewhere)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async syncData() {
    try {
      console.log('[DEBUG] Manual sync triggered');
      await this.store.initRealtimeListeners(); // One-time fetch for all collections
      this.renderDashboard();
      this.renderQueue();
      this.renderCustomers();
      this.renderPets();
      this.renderGroomers();
      this.renderUsers();
      this.renderServices();
      alert('ซิงค์ข้อมูลล่าสุดสำเร็จ!');
    } catch (e) {
      console.error('[DEBUG] Sync error:', e);
      alert('การซิงค์ข้อมูลล้มเหลว กรุณาลองใหม่');
    }
  }

  // Customer operations
  // Getters remain synchronous because data is synced via listeners
  getCustomers() {
    return this.data.customers;
  }

  getCustomers() {
    return this.data.customers;
  }

  getCustomerById(id) {
    return this.data.customers.find(c => c.id === id);
  }

  // Pet operations
  // Pet operations
  async addPet(pet) {
    const newPet = {
      ...pet,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await this.db.collection('pets').add(newPet);
      const createdPet = { id: docRef.id, ...newPet };
      this.data.pets.push(createdPet);
      return createdPet;
    } catch (e) {
      console.error("Error adding pet: ", e);
      alert('บันทึกข้อมูลสัตว์เลี้ยงไม่สำเร็จ');
      return null;
    }
  }

  async updatePet(id, updates) {
    try {
      await this.db.collection('pets').doc(id).update(updates);
      const index = this.data.pets.findIndex(p => p.id === id);
      if (index !== -1) {
        this.data.pets[index] = { ...this.data.pets[index], ...updates };
      }
      return { id, ...updates };
    } catch (e) {
      console.error("Error updating pet: ", e);
      alert('แก้ไขข้อมูลสัตว์เลี้ยงไม่สำเร็จ');
      return null;
    }
  }

  async deletePet(id) {
    try {
      await this.db.collection('pets').doc(id).delete();
      this.data.pets = this.data.pets.filter(p => p.id !== id);
    } catch (e) {
      console.error("Error deleting pet: ", e);
      alert('ลบข้อมูลสัตว์เลี้ยงไม่สำเร็จ');
    }
  }

  getPets() {
    return this.data.pets;
  }

  getPetById(id) {
    return this.data.pets.find(p => p.id === id);
  }

  getPetsByCustomer(customerId) {
    return this.data.pets.filter(p => p.customerId === customerId);
  }

  // Groomer operations
  // Groomer operations
  async addGroomer(groomer) {
    const newGroomer = {
      ...groomer,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await this.db.collection('groomers').add(newGroomer);
      const createdGroomer = { id: docRef.id, ...newGroomer };
      this.data.groomers.push(createdGroomer);
      return createdGroomer;
    } catch (e) {
      console.error("Error adding groomer: ", e);
      alert('บันทึกข้อมูลช่างไม่สำเร็จ');
      return null;
    }
  }

  async updateGroomer(id, updates) {
    try {
      await this.db.collection('groomers').doc(id).update(updates);
      const index = this.data.groomers.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.groomers[index] = { ...this.data.groomers[index], ...updates };
      }
      return { id, ...updates };
    } catch (e) {
      console.error("Error updating groomer: ", e);
      alert('แก้ไขข้อมูลช่างไม่สำเร็จ');
      return null;
    }
  }

  async deleteGroomer(id) {
    try {
      await this.db.collection('groomers').doc(id).delete();
      this.data.groomers = this.data.groomers.filter(g => g.id !== id);
    } catch (e) {
      console.error("Error deleting groomer: ", e);
      alert('ลบข้อมูลช่างไม่สำเร็จ');
    }
  }

  getGroomers() {
    return this.data.groomers;
  }

  getGroomerById(id) {
    return this.data.groomers.find(g => g.id === id);
  }

  getActiveGroomers() {
    return this.data.groomers.filter(g => g.isActive);
  }

  // NEW: Calculate service duration based on services selected
  calculateServiceDuration(serviceTypes) {
    console.log('[DEBUG] calculateServiceDuration called with', serviceTypes);
    if (!serviceTypes || serviceTypes.length === 0) return 60;

    // Safety check for serviceDurations
    const durations = this.data?.settings?.serviceDurations;
    if (!durations) {
      // Default durations if not found
      const defaultDurations = {
        'อาบน้ำ': 60,
        'ตัดขน': 90,
        'ตัดเล็บ': 30,
        'ทำสปา': 45,
        'ดูแลพิเศษ': 60
      };
      let total = 0;
      serviceTypes.forEach(service => {
        total += defaultDurations[service] || 60;
      });
      return total;
    }

    const servicesKey = serviceTypes.sort().join(',');

    // Check for combo override
    if (durations[servicesKey]) {
      return durations[servicesKey];
    }

    // Sum individual services
    let total = 0;
    serviceTypes.forEach(service => {
      total += durations[service] || 60;
    });

    return total;
  }

  // Queue operations
  // Queue operations
  async addQueue(queueItem) {
    console.log('[DEBUG] DataStore.addQueue started', queueItem);
    const selectedDate = queueItem.date || new Date().toISOString().split('T')[0];

    // We need to fetch current count for queue number (this might have race conditions in high concurrency but sufficient for now)
    // For better reliability, we should use a transaction, but keeping it simple for now
    const queuesOnDate = this.data.queue.filter(q => q.date === selectedDate);
    const queueNumber = queuesOnDate.length + 1;

    const duration = this.calculateServiceDuration(queueItem.serviceType);
    let estimatedEndTime = null;

    if (queueItem.appointmentTime) {
      const [hours, minutes] = queueItem.appointmentTime.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(startTime.getTime() + duration * 60000);
      estimatedEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
    }

    const newQueue = {
      queueNumber,
      date: selectedDate,
      appointmentTime: queueItem.appointmentTime || null,
      estimatedEndTime,
      duration,
      assignedGroomerId: queueItem.assignedGroomerId || null,
      status: 'booking',
      bookingAt: new Date().toISOString(),
      depositAmount: null,
      depositMethod: null,
      depositAt: null,
      checkInWeight: null,
      checkInNotes: '',
      checkInAt: null,
      completionImages: [],
      completedAt: null,
      ...queueItem,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await this.db.collection('queue').add(newQueue);
      console.log('[DEBUG] DataStore.addQueue Firestore add success', docRef.id);
      const createdQueue = { id: docRef.id, ...newQueue };
      this.data.queue.push(createdQueue);
      return createdQueue;
    } catch (e) {
      console.error("Error adding queue: ", e);
      alert('จองคิวไม่สำเร็จ');
      return null;
    }
  }

  async updateQueue(id, updates) {
    // Auto-update timestamps based on status logic (moved from original)
    const queue = this.data.queue.find(q => q.id === id);
    if (!queue) return null;

    const timestampUpdates = {};
    if (updates.status === 'deposit' && !queue.depositAt) {
      timestampUpdates.depositAt = new Date().toISOString();
    }
    if (updates.status === 'check-in' && !queue.checkInAt) {
      timestampUpdates.checkInAt = new Date().toISOString();
    }
    if (updates.status === 'completed' && !queue.completedAt) {
      timestampUpdates.completedAt = new Date().toISOString();
      // Create service record
      this.createServiceRecord({ ...queue, ...updates, ...timestampUpdates });
    }

    const finalUpdates = { ...updates, ...timestampUpdates };

    // NEW: Update pet's weight if provided during check-in
    if (updates.checkInWeight && queue.petId) {
      this.db.collection('pets').doc(queue.petId).update({
        weight: parseFloat(updates.checkInWeight)
      }).catch(e => console.error("Error updating pet weight: ", e));
    }

    try {
      await this.db.collection('queue').doc(id).update(finalUpdates);
      const index = this.data.queue.findIndex(q => q.id === id);
      if (index !== -1) {
        this.data.queue[index] = { ...this.data.queue[index], ...finalUpdates };
      }
      return { id, ...queue, ...finalUpdates };
    } catch (e) {
      console.error("Error updating queue: ", e);
      alert('อัปเดตสถานะคิวไม่สำเร็จ');
      return null;
    }
  }

  async deleteQueue(id) {
    try {
      await this.db.collection('queue').doc(id).delete();
      this.data.queue = this.data.queue.filter(q => q.id !== id);
    } catch (e) {
      console.error("Error deleting queue: ", e);
      alert('ลบคิวไม่สำเร็จ');
    }
  }

  // Get today's queue (using local date, not UTC)
  getTodayQueue() {
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
    return this.data.queue.filter(q => q.date === localDate);
  }

  // NEW: Get queue by specific date
  getQueueByDate(dateString) {
    return this.data.queue.filter(q => q.date === dateString);
  }

  getQueue() {
    return this.data.queue;
  }

  getQueueById(id) {
    return this.data.queue.find(q => q.id === id);
  }

  // NEW: Daily Schedule Management
  getDailySchedule(date) {
    return this.data.dailySchedules.find(ds => ds.date === date);
  }

  setDailySchedule(date, groomers) {
    const existingIndex = this.data.dailySchedules.findIndex(s => s.date === date);
    const existingId = existingIndex >= 0 ? this.data.dailySchedules[existingIndex].id : null;

    const schedule = {
      date,
      groomers: groomers.map(g => ({
        groomerId: g.groomerId,
        name: g.name || this.getGroomerById(g.groomerId)?.name,
        workingHours: g.workingHours || this.data.settings.defaultWorkingHours,
        status: 'available'
      })),
      totalCapacity: groomers.length
    };

    // Save to Firestore
    if (existingId) {
      this.db.collection('dailySchedules').doc(existingId).update(schedule)
        .catch(e => console.error("Error creating daily schedule: ", e));
    } else {
      this.db.collection('dailySchedules').add(schedule)
        .catch(e => console.error("Error creating daily schedule: ", e));
    }

    return schedule;
  }

  // NEW: Get available groomers for a specific date/time slot
  getAvailableGroomersForSlot(date, startTime, duration) {
    const schedule = this.getDailySchedule(date);
    if (!schedule) {
      // No schedule set, use all active groomers
      return this.getActiveGroomers();
    }

    const [startHour, startMin] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = startMinutes + duration;

    const queuesOnDate = this.getQueueByDate(date);

    // Check each groomer's availability
    return schedule.groomers.filter(groomer => {
      // Check if within working hours
      const [workStart] = groomer.workingHours.start.split(':').map(Number);
      const [workEnd] = groomer.workingHours.end.split(':').map(Number);
      const workStartMin = workStart * 60;
      const workEndMin = workEnd * 60;

      if (startMinutes < workStartMin || endMinutes > workEndMin) {
        return false; // Outside working hours
      }

      // Check for conflicts with existing appointments
      const groomerQueues = queuesOnDate.filter(q =>
        q.assignedGroomerId === groomer.groomerId &&
        q.status !== 'cancelled'
      );

      for (const queue of groomerQueues) {
        if (!queue.appointmentTime) continue;

        const [qStartHour, qStartMin] = queue.appointmentTime.split(':').map(Number);
        const qStartMinutes = qStartHour * 60 + qStartMin;
        const qEndMinutes = qStartMinutes + (queue.duration || 60);

        // Check overlap
        if (!(endMinutes <= qStartMinutes || startMinutes >= qEndMinutes)) {
          return false; // Time conflict
        }
      }

      return true; // Groomer is available
    });
  }

  // NEW: Find next available time slot
  findAvailableTimeSlots(date, serviceTypes, maxSlots = 10) {
    console.log('[DEBUG] findAvailableTimeSlots called');
    const duration = this.calculateServiceDuration(serviceTypes);
    const schedule = this.getDailySchedule(date);
    const workHours = schedule?.groomers[0]?.workingHours || this.data.settings.defaultWorkingHours;

    const [startHour] = workHours.start.split(':').map(Number);
    const [endHour] = workHours.end.split(':').map(Number);

    const slots = [];
    let currentMinutes = startHour * 60;
    const endMinutes = endHour * 60 - duration;

    // Generate slots every 30 minutes
    while (currentMinutes <= endMinutes && slots.length < maxSlots) {
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const availableGroomers = this.getAvailableGroomersForSlot(date, timeStr, duration);

      if (availableGroomers.length > 0) {
        slots.push({
          time: timeStr,
          endTime: this.calculateEndTime(timeStr, duration),
          availableGroomers: availableGroomers.length,
          groomers: availableGroomers
        });
      }

      currentMinutes += 30; // 30-minute intervals
    }

    return slots;
  }

  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;

    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  }

  // Calculate total duration for a list of services
  calculateDuration(services) {
    if (!services || !Array.isArray(services)) return 0;

    let totalDuration = 0;
    // Main services might be specific strings, add-ons are just additive
    services.forEach(service => {
      // Check exact match first
      if (this.data.settings.serviceDurations[service]) {
        totalDuration += this.data.settings.serviceDurations[service];
      }
      // Handle combined services (legacy support or if logic changes)
      else if (service.includes(',')) {
        // ... simplified for now, as we moved to single select + addons
      }
      // Fallback for unknown services
      else {
        totalDuration += 0;
      }
    });

    return totalDuration;
  }

  // Service Record operations
  createServiceRecord(queue) {
    // Calculate duration from check-in to completion
    const checkInTime = queue.checkInAt ? new Date(queue.checkInAt) : new Date();
    const endTime = queue.completedAt ? new Date(queue.completedAt) : new Date();
    const duration = Math.round((endTime - checkInTime) / 60000); // minutes

    const serviceRecord = {
      queueId: queue.id,
      customerId: queue.customerId,
      petId: queue.petId,
      groomerId: queue.groomerId || null,
      date: queue.date,
      status: 'completed',
      servicesPerformed: queue.serviceType,

      // Workflow timestamps
      bookingAt: queue.bookingAt || null,
      depositAt: queue.depositAt || null,
      checkInAt: queue.checkInAt || null,
      completedAt: queue.completedAt || new Date().toISOString(),
      completedAt: queue.completedAt || new Date().toISOString(),
      duration,

      // Appointment info
      appointmentTime: queue.appointmentTime,
      estimatedEndTime: queue.estimatedEndTime,

      // Check-in data
      checkInWeight: queue.checkInWeight,
      checkInNotes: queue.checkInNotes || '',

      // Completion data
      completionImages: queue.completionImages || [],

      price: this.calculatePrice(queue.serviceType),
      notes: queue.notes || '',
      createdAt: new Date().toISOString()
    };

    // Save to Firestore
    this.db.collection('serviceRecords').add(serviceRecord)
      .then(docRef => {
        console.log("Service record created with ID: ", docRef.id);
        const createdRecord = { id: docRef.id, ...serviceRecord };
        this.data.serviceRecords.push(createdRecord);
      })
      .catch(error => {
        console.error("Error adding service record: ", error);
        alert('บันทึกประวัติบริการไม่สำเร็จ');
      });

    return serviceRecord;
  }

  getServiceRecords() {
    return this.data.serviceRecords;
  }

  getServiceRecordsByCustomer(customerId) {
    return this.data.serviceRecords
      .filter(r => r.customerId === customerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
  }

  getServiceRecordById(id) {
    return this.data.serviceRecords.find(r => r.id === id);
  }

  // NEW: Update service record
  async updateServiceRecord(id, updates) {
    try {
      await this.db.collection('serviceRecords').doc(id).update(updates);
      const index = this.data.serviceRecords.findIndex(r => r.id === id);
      if (index !== -1) {
        this.data.serviceRecords[index] = { ...this.data.serviceRecords[index], ...updates };
      }
      return { id, ...updates };
    } catch (e) {
      console.error("Error updating service record: ", e);
      alert('แก้ไขประวัติบริการไม่สำเร็จ: ' + e.message);
      return null;
    }
  }

  calculatePrice(services) {
    let total = 0;
    services.forEach(service => {
      total += this.data.settings.priceList[service] || 0;
    });
    return total;
  }

  // NEW: Calculate Cat Price based on weight and hair type
  calculateCatPrice(services, weight, isLongHair = false) {
    let total = 0;
    const pricing = this.data.settings.catPricing;

    // 1. Calculate Bathing Price (Base)
    if (services.includes('อาบน้ำ')) {
      const tier = pricing.weightTiers.find(t => weight <= t.max) || pricing.weightTiers[pricing.weightTiers.length - 1];
      total += isLongHair ? tier.long : tier.short;
    }

    // 2. Add-ons
    services.forEach(service => {
      if (service === 'อาบน้ำ') return; // Handled above

      // Check specific cat pricing first, then fallback to general
      if (pricing.addons[service]) {
        total += pricing.addons[service];
      } else {
        total += this.data.settings.priceList[service] || 0;
      }
    });

    return total;
  }

  getServiceRecords() {
    return this.data.serviceRecords;
  }

  getServiceRecordsByCustomer(customerId) {
    return this.data.serviceRecords.filter(sr => sr.customerId === customerId);
  }

  getServiceRecordsByGroomer(groomerId) {
    return this.data.serviceRecords.filter(sr => sr.groomerId === groomerId);
  }

  // User operations
  async addUser(user) {
    const newUser = {
      ...user,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await this.db.collection('users').add(newUser);
      const createdUser = { id: docRef.id, ...newUser };
      this.data.users.push(createdUser);
      return createdUser;
    } catch (e) {
      console.error("Error adding user: ", e);
      alert('บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ');
      return null;
    }
  }

  async updateUser(id, updates) {
    try {
      await this.db.collection('users').doc(id).update(updates);
      const index = this.data.users.findIndex(u => u.id === id);
      if (index !== -1) {
        this.data.users[index] = { ...this.data.users[index], ...updates };
      }
      return { id, ...updates };
    } catch (e) {
      console.error("Error updating user: ", e);
      alert('แก้ไขข้อมูลผู้ใช้งานไม่สำเร็จ');
      return null;
    }
  }

  async deleteUser(id) {
    try {
      await this.db.collection('users').doc(id).delete();
      this.data.users = this.data.users.filter(u => u.id !== id);
    } catch (e) {
      console.error("Error deleting user: ", e);
      alert('ลบข้อมูลผู้ใช้งานไม่สำเร็จ');
    }
  }

  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }
}

// ===================================
// APPLICATION CLASS
// ===================================

class PetGroomingApp {
  constructor() {
    window.app = this; // Fix: Make app instance available globally immediately
    this.store = new DataStore();
    this.currentPage = 'dashboard';
    this.selectedDashboardDate = null; // null = today
    this.loading = true; // NEW: Loading state

    // Debug state
    this.debugClicks = 0;
    this.lastDebugClick = 0;
    this.debugCategory = 'all';
    this.isDebugModalOpen = false;

    // Register log listener
    window.logger.addListener((log) => {
      if (this.isDebugModalOpen) {
        if (log.type === 'clear') {
          document.getElementById('debug-log-container').innerHTML = '';
        } else if (this.debugCategory === 'all' || this.debugCategory === log.type) {
          this.appendLogToUI(log);
        }
      }
    });

    this.init();
  }

  init() {
    this.checkAuth();
    this.setupNavigation();
    this.setupSearchFilters();
    this.setupPetModalListeners();
    this.setupPetModalListeners();
    this.loadSampleData();
    this.renderDashboard(); // Trigger initial render (shows skeleton)

    // Safety timeout in case some collection fails to load or permissions are restricted
    setTimeout(() => {
      if (this.loading) {
        console.warn('Initialization timed out, force clearing loading state');
        this.onInitDataLoaded();
      }
    }, 15000); // Increased to 15 seconds for more reliability
  }

  // NEW: Called when initial data is loaded from Firebase
  onInitDataLoaded() {
    this.loading = false;
    this.renderDashboard();
    // Also re-render other pages if they were the initial land page
    if (this.currentPage !== 'dashboard') {
      this.navigateTo(this.currentPage);
    }
  }

  // NEW: Button Loading Helper
  setButtonLoading(btn, isLoading, loadingText = '') {
    if (isLoading) {
      btn.classList.add('btn-loading');
      btn.dataset.originalText = btn.textContent;
      if (loadingText) btn.textContent = loadingText;
    } else {
      btn.classList.remove('btn-loading');
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    }
  }

  // NEW: Render Skeleton Cards for Queue
  renderSkeletonQueue(count = 3) {
    return Array(count).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text" style="width: 70%;"></div>
      </div>
    `).join('');
  }

  // NEW: Render Skeleton Rows for Services
  renderSkeletonService(count = 5) {
    return this.renderSkeletonTable(10, count); // Updated to 10 columns: Date, Time, Status, Customer, Pet, Groomer, Services, Duration, Weight, Actions
  }

  // NEW: Generic Skeleton Table Router
  renderSkeletonTable(cols = 5, rows = 5) {
    const colHtml = '<td><div class="skeleton skeleton-text"></div></td>'.repeat(cols);
    return Array(rows).fill(0).map(() => `
      <tr class="skeleton-row">
        ${colHtml}
      </tr>
    `).join('');
  }

  // Check authentication
  checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
      window.location.href = 'index.html';
      return false;
    }
    const username = localStorage.getItem('username');
    this.currentUser = username || 'User';

    // Update UI with username
    setTimeout(() => {
      const userNameElement = document.getElementById('current-user');
      if (userNameElement) {
        userNameElement.textContent = this.currentUser;
      }
    }, 100);

    return true;
  }

  // Load sample data for demo
  async loadSampleData() {
    // Check if data is truly empty by querying Firestore directly
    try {
      const snapshot = await this.store.db.collection('customers').limit(1).get();
      if (!snapshot.empty) {
        console.log('Data exists, skipping sample data load');
        return;
      }
    } catch (e) {
      console.warn('Could not check for existing data, skipping sample load to be safe', e);
      return;
    }

    console.log('Loading sample data...');
    // For manual seeding, we can use this method.

    // Add sample customers
    const customer1 = await this.store.addCustomer({
      name: 'สมชาย ใจดี',
      phone: '081-234-5678',
      email: 'somchai@email.com',
      address: '123 ถนนสุขุมวิท กรุงเทพฯ'
    });

    const customer2 = await this.store.addCustomer({
      name: 'สมหญิง รักสัตว์',
      phone: '089-876-5432',
      email: 'somying@email.com',
      address: '456 ถนนพระราม 9 กรุงเทพฯ'
    });

    if (customer1) {
      // Add sample pets
      await this.store.addPet({
        customerId: customer1.id,
        name: 'มะลิ',
        type: 'dog',
        breed: 'ชิวาวา',
        weight: 3.5,
        color: 'ขาว',
        birthDate: '2020-05-15',
        notes: 'กลัวเสียงดัง'
      });
    }

    if (customer2) {
      await this.store.addPet({
        customerId: customer2.id,
        name: 'มีตังค์',
        type: 'cat',
        breed: 'สก็อตติช',
        weight: 5.2,
        color: 'เทา',
        birthDate: '2021-08-20',
        notes: ''
      });
    }

    // Add sample groomers
    await this.store.addGroomer({
      name: 'วิชัย ตัดขนดี',
      phone: '091-111-2222',
      email: 'vichai@grooming.com',
      specialty: ['dog', 'cat'],
      experienceLevel: 'expert',
      isActive: true,
      hireDate: '2020-01-15',
      notes: 'ผู้เชี่ยวชาญด้านสุนัขพันธุ์ใหญ่'
    });

    await this.store.addGroomer({
      name: 'สุดา อาบน้ำเก่ง',
      phone: '092-333-4444',
      email: 'suda@grooming.com',
      specialty: ['cat'],
      experienceLevel: 'senior',
      isActive: true,
      hireDate: '2021-06-01',
      notes: 'เชี่ยวชาญด้านแมว'
    });
  }

  // NEW: Add Test Data for Debugging
  async addTestData() {
    console.log('Adding test data...');
    const today = this.getTodayString();

    // Get existing customer or create one
    let customers = this.store.getCustomers();
    let customer = customers[0];

    if (!customer) {
      customer = await this.store.addCustomer({
        name: 'ลูกค้าทดสอบ',
        phone: '099-999-9999',
        email: 'test@email.com',
        address: 'ที่อยู่ทดสอบ'
      });
    }

    // Get existing pet or create one
    let pets = this.store.getPetsByCustomer(customer.id);
    let pet = pets[0];

    if (!pet) {
      pet = await this.store.addPet({
        customerId: customer.id,
        name: 'น้องทดสอบ',
        type: 'dog',
        breed: 'พุดเดิ้ล',
        weight: 8,
        color: 'ขาว',
        notes: 'ดุมาก กลัวน้ำ'
      });
    }

    // Get existing groomer
    const groomers = this.store.getGroomers();
    const groomer = groomers[0];

    // 1. Add a completed history record with all fields
    const historyRecord = {
      id: this.store.generateId(),
      queueId: 'test-queue-1',
      customerId: customer.id,
      petId: pet.id,
      groomerId: groomer?.id || null,
      date: today,
      servicesPerformed: ['อาบน้ำ', 'ตัดขน'],

      // Workflow timestamps
      bookingAt: new Date().toISOString(),
      depositAt: new Date().toISOString(),
      checkInAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 90,

      // IMPORTANT: Appointment time fields
      appointmentTime: '10:00',
      estimatedEndTime: '11:30',

      // Check-in data
      checkInWeight: 8.5,
      checkInNotes: 'ดุมาก กลัวน้ำ มีแผล',
      transport: true,

      // Completion data
      completionImages: [],

      price: 850,
      notes: 'ดุมาก กลัวน้ำ มีแผล',
      createdAt: new Date().toISOString()
    };

    // Add to local data and Firestore
    this.store.data.serviceRecords.push(historyRecord);
    try {
      await this.store.db.collection('serviceRecords').doc(historyRecord.id).set(historyRecord);
      console.log('Test history record added:', historyRecord.id);
    } catch (e) {
      console.error('Error adding test history to Firestore:', e);
    }

    // 2. Add an active queue item
    const queueItem = await this.store.addQueue({
      customerId: customer.id,
      petId: pet.id,
      groomerId: groomer?.id || null,
      assignedGroomerId: groomer?.id || null,
      serviceType: ['อาบน้ำ'],
      date: today,
      bookingAt: new Date().toISOString(),
      status: 'booking',
      queueNumber: this.generateQueueNumber(),
      priority: false,
      isTransportIncluded: true,
      marketingSource: 'ทดสอบ',
      notes: 'คิวทดสอบ',
      appointmentTime: '14:00',
      estimatedEndTime: '15:00',
      duration: 60
    });

    console.log('Test queue item added:', queueItem?.id);

    alert('เพิ่มข้อมูลทดสอบสำเร็จ! กรุณากลับไปดูหน้าลูกค้าและคลิกชื่อลูกค้าเพื่อดูประวัติ');

    this.renderDashboard();
    this.renderQueue();
  }

  // Navigation
  // Navigation
  // Old setupNavigation not needed with onclick, but keeping empty for safety
  setupNavigation() { }

  showPage(page) {
    this.navigateTo(page);
    // On mobile, close sidebar after click
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('active');
    }
  }

  navigateTo(page) {
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
      // We check if the onclick attribute contains the page name, or if we add a data-page attribute
      // But since we use onclick="app.showPage('...')" we can IDmatch if we added IDs.
      // Let's rely on the ID map I added in dashboard.html: id="nav-dashboard"
      if (item.id === `nav-${page}`) {
        item.classList.add('active');
      }
    });

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.add('hidden');
    });

    // Show selected page
    const pageElement = document.getElementById(`page-${page}`);
    if (pageElement) {
      pageElement.classList.remove('hidden');
      this.currentPage = page;

      // Render page content
      switch (page) {
        case 'dashboard':
          this.renderDashboard();
          break;
        case 'queue':
          this.renderQueue();
          break;
        case 'customers':
          this.renderCustomers();
          break;
        case 'pets':
          this.renderPets();
          break;
        case 'groomers':
          this.renderGroomers();
          break;
        case 'services':
          this.renderServices();
          break;
        case 'users':
          this.renderUsers();
          break;
      }
    }
  }

  // Search & Filter Setup
  setupSearchFilters() {
    const customerSearch = document.getElementById('customer-search');
    if (customerSearch) {
      customerSearch.addEventListener('input', () => this.renderCustomers());
    }

    const petSearch = document.getElementById('pet-search');
    if (petSearch) {
      petSearch.addEventListener('input', () => this.renderPets());
    }

    const queueSearch = document.getElementById('queue-search');
    if (queueSearch) {
      queueSearch.addEventListener('input', () => this.renderQueue());
    }

    const queueDateFilter = document.getElementById('queue-date-filter');
    if (queueDateFilter) {
      // Set default value to today
      queueDateFilter.value = this.getTodayString();
      queueDateFilter.addEventListener('change', () => this.renderQueue());
    }

    const serviceSearch = document.getElementById('service-search');
    if (serviceSearch) {
      serviceSearch.addEventListener('input', () => this.renderServices());
    }
  }

  // ===================================
  // DASHBOARD RENDERING
  // ===================================

  renderDashboard(date = null) {
    console.log('[DEBUG] renderDashboard called');
    // Use selected date or today
    const selectedDate = date || this.selectedDashboardDate || this.getTodayString();
    const queueForDate = this.store.getQueueByDate(selectedDate);
    const waitingQueue = queueForDate.filter(q => q.status === 'waiting' || q.status === 'booking' || q.status === 'deposit' || q.status === 'check-in');
    const completedQueue = queueForDate.filter(q => q.status === 'completed');
    const totalCustomers = this.store.getCustomers().length;

    // Update stats
    const statsToday = document.getElementById('stat-queue-today');
    const statsWaiting = document.getElementById('stat-queue-waiting');
    const statsCompleted = document.getElementById('stat-queue-completed');
    const statsCustomers = document.getElementById('stat-total-customers');

    if (this.loading) {
      const skeletonPulse = '<span class="skeleton-pulse">...</span>';
      if (statsToday) statsToday.innerHTML = skeletonPulse;
      if (statsWaiting) statsWaiting.innerHTML = skeletonPulse;
      if (statsCompleted) statsCompleted.innerHTML = skeletonPulse;
      if (statsCustomers) statsCustomers.innerHTML = skeletonPulse;
    } else {
      if (statsToday) statsToday.textContent = queueForDate.length;
      if (statsWaiting) statsWaiting.textContent = waitingQueue.length;
      if (statsCompleted) statsCompleted.textContent = completedQueue.length;
      if (statsCustomers) statsCustomers.textContent = totalCustomers;
    }

    // Render calendar
    this.renderCalendar();

    // Sort by time, then by queue number
    queueForDate.sort((a, b) => {
      // Sort by time first (if both have time)
      if (a.appointmentTime && b.appointmentTime) {
        return a.appointmentTime.localeCompare(b.appointmentTime);
      }
      // Put items with time before items without time
      if (a.appointmentTime) return -1;
      if (b.appointmentTime) return 1;

      // Fallback to queue number
      return a.queueNumber.localeCompare(b.queueNumber);
    });

    // Render queue for selected date
    const queueList = document.getElementById('dashboard-queue-list');

    // NEW: Skeleton Loading
    if (this.loading) {
      queueList.innerHTML = this.renderSkeletonQueue(3);
      return;
    }

    if (queueForDate.length === 0) {
      queueList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h4 class="empty-state-title">ยังไม่มีคิวในวันนี้</h4>
          <p class="empty-state-text">เริ่มเพิ่มคิวใหม่เพื่อเริ่มต้นบริการ</p>
        </div>
      `;
    } else {
      queueList.innerHTML = queueForDate.map(q => this.createQueueCard(q)).join('');
    }
  }

  // ===================================
  // QUEUE RENDERING
  // ===================================

  renderQueue() {
    console.log('[DEBUG] renderQueue called');
    const searchTerm = document.getElementById('queue-search')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('queue-date-filter');
    // Use date from filter or default to today
    let filterDate = dateFilter?.value;
    if (!filterDate) {
      filterDate = this.getTodayString();
      if (dateFilter) dateFilter.value = filterDate;
    }

    let displayQueue = this.store.getQueueByDate(filterDate);

    if (searchTerm) {
      displayQueue = displayQueue.filter(q => {
        const customer = this.store.getCustomerById(q.customerId);
        const pet = this.store.getPetById(q.petId);
        return customer?.name.toLowerCase().includes(searchTerm) ||
          pet?.name.toLowerCase().includes(searchTerm) ||
          q.queueNumber.toString().includes(searchTerm);
      });
    }

    // Sort by time, then by queue number
    displayQueue.sort((a, b) => {
      // Sort by time first (if both have time)
      if (a.appointmentTime && b.appointmentTime) {
        return a.appointmentTime.localeCompare(b.appointmentTime);
      }
      // Put items with time before items without time
      if (a.appointmentTime) return -1;
      if (b.appointmentTime) return 1;

      // Fallback to queue number
      return a.queueNumber.localeCompare(b.queueNumber);
    });

    const queueList = document.getElementById('queue-list');

    // NEW: Skeleton Loading
    if (this.loading) {
      queueList.innerHTML = this.renderSkeletonQueue(3);
      return;
    }

    if (displayQueue.length === 0) {
      queueList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h4 class="empty-state-title">ไม่พบคิว</h4>
          <p class="empty-state-text">ลองค้นหาด้วยคำอื่น หรือเพิ่มคิวใหม่</p>
        </div>
      `;
    } else {
      queueList.innerHTML = displayQueue.map(q => this.createQueueCard(q)).join('');
    }
  }

  // Helper: Get pet icon
  getPetIcon(pet) {
    if (pet?.name === 'บอนบอน') return '🐰';
    return pet?.type === 'dog' ? '🐕' : '🐱';
  }

  // Helper: Get pet badge class
  getPetBadgeClass(pet) {
    if (pet?.name === 'บอนบอน') return 'badge-other';
    return pet?.type === 'dog' ? 'badge-dog' : 'badge-cat';
  }

  // Helper: Get pet type label
  getPetLabel(pet) {
    if (pet?.name === 'บอนบอน') return 'กระต่าย';
    return pet?.type === 'dog' ? 'สุนัข' : 'แมว';
  }

  createQueueCard(queue) {
    const customer = this.store.getCustomerById(queue.customerId);
    const pet = this.store.getPetById(queue.petId);
    // NEW: Use assignedGroomerId for pre-assigned groomer
    const groomer = queue.assignedGroomerId ? this.store.getGroomerById(queue.assignedGroomerId) :
      (queue.groomerId ? this.store.getGroomerById(queue.groomerId) : null);

    // NEW: 4-stage workflow status map
    const statusMap = {
      'booking': '📝 จองคิว',
      'deposit': '💰 เก็บมัดจำแล้ว',
      'check-in': '🔍 เช็คอิน',
      'completed': '✅ เสร็จสิ้น',
      'cancelled': '❌ ยกเลิก'
    };

    // NEW: Color scheme - orange, yellow, blue
    const statusBadgeMap = {
      'booking': 'badge-booking',     // Yellow
      'deposit': 'badge-deposit',     // Orange
      'check-in': 'badge-checkin',    // Blue
      'completed': 'badge-completed', // Dark blue
      'cancelled': 'badge-cancelled'  // Gray
    };

    return `
      <div class="queue-item ${queue.status}">
        <div class="queue-number">
          #${queue.queueNumber}
          ${queue.status !== 'completed' && queue.status !== 'cancelled' ?
        `<button class="btn-edit-action" onclick="app.editQueue('${queue.id}')" title="แก้ไข">📝</button>` : ''}
        </div>
        <div class="queue-customer">${customer?.name || 'ไม่ระบุ'}</div>
        <div class="queue-pet">
        ${this.getPetIcon(pet)} ${pet?.name || 'ไม่ระบุ'} 
        <span class="badge ${this.getPetBadgeClass(pet)}">${this.getPetLabel(pet)}</span>
        ${queue.isTransportIncluded ? '<span title="บริการรับ-ส่ง" style="font-size: 1.2em; margin-left: 5px;">🚗</span>' : ''}
      </div>
        <div class="queue-details">
          ${queue.appointmentTime ? `<div>📅 ${this.formatDate(queue.date)} 🕐 ${queue.appointmentTime}${queue.estimatedEndTime ? ` - ${queue.estimatedEndTime}` : ''}</div>` : `<div>📅 ${this.formatDate(queue.date)}</div>`}
          <div>บริการ: ${queue.serviceType.join(', ')}${queue.duration ? ` (${queue.duration} นาที)` : ''}</div>
          ${groomer ? `<div>ช่าง: ${groomer.name}</div>` : ''}
          ${queue.checkInWeight ? `<div>น้ำหนัก: ${queue.checkInWeight} กก.</div>` : ''}
        ${queue.depositAmount ? `<div style="color: var(--warning); font-weight: 600;">💰 มัดจำ: ${queue.depositAmount} บาท</div>` : '<div style="color: var(--warning); font-weight: 600;">💰 มัดจำ: ไม่มี</div>'}
        ${queue.isTransportIncluded ? '<div style="color: var(--primary); font-weight: 600;">🚗 บริการรับ-ส่ง</div>' : ''}
          ${queue.priority ? '<div style="color: var(--error); font-weight: 600;">⚡ คิวด่วน</div>' : ''}
          ${queue.notes ? `<div style="color: var(--error); font-size: 0.9em;">📝 หมายเหตุ: ${queue.notes}</div>` : ''}
          <div>สถานะ: <span class="badge ${statusBadgeMap[queue.status]}">
            ${queue.status === 'deposit'
        ? (queue.depositAmount ? '💰 มัดจำ' : '💰 ไม่มัดจำ')
        : statusMap[queue.status]
      }
          </span></div>
        </div>
        <div class="queue-actions">
          ${queue.status === 'booking' ?
        `<button class="btn btn-sm btn-warning" onclick="app.showDepositModal('${queue.id}')">💰 ยืนยันมัดจำ</button>` : ''}
          ${queue.status === 'deposit' ?
        `<button class="btn btn-sm btn-info" onclick="app.showCheckInModal('${queue.id}')">🔍 เช็คอิน</button>` : ''}
          ${queue.status === 'check-in' ?
        `<button class="btn btn-sm btn-success" onclick="app.showCompletionModal('${queue.id}')">✅ ปิดงาน</button>` : ''}
          ${queue.status !== 'completed' && queue.status !== 'cancelled' ?
        `<button class="btn btn-sm btn-danger" onclick="app.cancelQueue('${queue.id}')">ยกเลิก</button>` : ''}
        </div>
      </div>
    `;
  }

  updateQueueStatus(id, status) {
    this.store.updateQueue(id, { status });
    this.renderQueue();
    this.renderDashboard();
  }

  cancelQueue(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะยกเลิกคิวนี้?')) {
      this.store.updateQueue(id, { status: 'cancelled' });
      this.renderQueue();
      this.renderDashboard();
    }
  }

  // ===================================
  // CUSTOMER RENDERING
  // ===================================

  renderCustomers() {
    const searchTerm = document.getElementById('customer-search')?.value.toLowerCase() || '';
    let customers = this.store.getCustomers();

    if (searchTerm) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm))
      );
    }

    const tbody = document.getElementById('customers-tbody');

    // NEW: Skeleton Loading
    // 5 columns: Name, Phone, Email, Pets, Actions
    if (this.loading) {
      tbody.innerHTML = this.renderSkeletonTable(5, 5);
      return;
    }

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบข้อมูลลูกค้า
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = customers.map(c => {
        const petCount = this.store.getPetsByCustomer(c.id).length;
        return `
          <tr>
            <td>
              <a href="#" onclick="app.showCustomerHistory('${c.id}'); return false;" style="font-weight: 600; text-decoration: none; color: var(--primary-color);">
                ${c.name}
              </a>
            </td>
            <td>${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td>${petCount} ตัว</td>
            <td class="table-actions">
              <button class="btn btn-sm btn-info" onclick="app.editCustomer('${c.id}')">แก้ไข</button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteCustomer('${c.id}')">ลบ</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // ===================================
  // PET RENDERING
  // ===================================

  renderPets() {
    const searchTerm = document.getElementById('pet-search')?.value.toLowerCase() || '';
    let pets = this.store.getPets();

    if (searchTerm) {
      pets = pets.filter(p => {
        const customer = this.store.getCustomerById(p.customerId);
        return p.name.toLowerCase().includes(searchTerm) ||
          (p.breed && p.breed.toLowerCase().includes(searchTerm)) ||
          customer?.name.toLowerCase().includes(searchTerm);
      });
    }

    const tbody = document.getElementById('pets-tbody');

    // NEW: Skeleton Loading
    // 6 columns: Name, Type, Breed, Owner, Weight, Actions
    if (this.loading) {
      tbody.innerHTML = this.renderSkeletonTable(6, 5);
      return;
    }

    if (pets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบข้อมูลสัตว์เลี้ยง
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pets.map(p => {
        const customer = this.store.getCustomerById(p.customerId);
        return `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge ${p.type === 'dog' ? 'badge-dog' : 'badge-cat'}">${p.type === 'dog' ? 'สุนัข' : 'แมว'}</span></td>
            <td>${p.breed || '-'}</td>
            <td>${customer?.name || 'ไม่ระบุ'}</td>
            <td>${p.weight ? p.weight + ' กก.' : '-'}</td>
            <td class="table-actions">
              <button class="btn btn-sm btn-info" onclick="app.editPet('${p.id}')">แก้ไข</button>
              <button class="btn btn-sm btn-danger" onclick="app.deletePet('${p.id}')">ลบ</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // ===================================
  // GROOMER RENDERING
  // ===================================

  renderGroomers() {
    const groomers = this.store.getGroomers();

    const tbody = document.getElementById('groomers-tbody');

    // NEW: Skeleton Loading
    // 6 columns: Name, Nickname, Phone, Position, Specialty, Actions
    if (this.loading) {
      tbody.innerHTML = this.renderSkeletonTable(6, 5);
      return;
    }

    if (groomers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบข้อมูลช่าง
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = groomers.map(g => {
        const specialtyText = g.specialty.map(s => {
          if (s === 'dog') return 'สุนัข';
          if (s === 'cat') return 'แมว';
          if (s === 'both') return 'ทั้งสองอย่าง';
          return s;
        }).join(', ');

        return `
          <tr>
            <td>
              <strong>${g.name}</strong>
              ${g.nickname ? `<br><small class="text-muted">(${g.nickname})</small>` : ''}
            </td>
            <td>${g.phone}</td>
            <td>${g.experienceLevel}</td>
            <td>${specialtyText}</td>
            <td>
              <span class="badge ${g.isActive ? 'badge-completed' : 'badge-cancelled'}">
                ${g.isActive ? 'ทำงานอยู่' : 'ไม่ทำงาน'}
              </span>
            </td>
            <td class="table-actions">
              <button class="btn btn-sm btn-info" onclick="app.editGroomer('${g.id}')">แก้ไข</button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteGroomer('${g.id}')">ลบ</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // ===================================
  // SERVICE RECORDS RENDERING
  // ===================================

  renderServices() {
    const searchTerm = document.getElementById('service-search')?.value.toLowerCase() || '';

    // Initialize Sort State if missing
    if (!this.currentSort) {
      this.currentSort = { column: 'dateTime', direction: 'desc' };
    }

    // Show ONLY Service Records (History) - NOT Queue
    let allRecords = [];

    // 1. Process Queue Items - Include COMPLETED items from Queue to backfill missing data
    this.store.getQueue().forEach(q => {
      // Only include if status is 'completed'
      if (q.status !== 'completed') return;

      // Determine time range
      let timeRange = '-';
      if (q.appointmentTime) {
        timeRange = q.appointmentTime;
        if (q.estimatedEndTime) timeRange += ` - ${q.estimatedEndTime}`;
      } else if (q.checkInAt && q.completedAt) {
        // Fallback if no appointment time
        const checkIn = new Date(q.checkInAt);
        const completed = new Date(q.completedAt);
        if (!isNaN(checkIn) && !isNaN(completed)) {
          const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          timeRange = `${formatTime(checkIn)} - ${formatTime(completed)}`;
        }
      }

      const customer = this.store.getCustomerById(q.customerId);
      const pet = this.store.getPetById(q.petId);
      const groomer = q.groomerId ? this.store.getGroomerById(q.groomerId) :
        (q.assignedGroomerId ? this.store.getGroomerById(q.assignedGroomerId) : null);

      let serviceStr = Array.isArray(q.serviceType) ? q.serviceType.join(' ') : q.serviceType;

      allRecords.push({
        type: 'queue', // Mark as from queue
        date: q.date,
        time: timeRange,
        appointmentTime: q.appointmentTime,
        dateTime: new Date(`${q.date}T${q.appointmentTime || '00:00'}`),
        status: 'completed',
        customerId: q.customerId,
        petId: q.petId,
        groomerId: q.groomerId || q.assignedGroomerId,
        services: Array.isArray(q.serviceType) ? q.serviceType : [q.serviceType],
        duration: q.duration,
        checkInAt: q.checkInAt,
        completedAt: q.completedAt,
        checkInWeight: q.checkInWeight,
        id: q.id, // Use queue ID
        queueId: q.id, // Explicit queue ID reference
        // Resolved names
        customerName: customer ? customer.name.toLowerCase() : '',
        petName: pet ? pet.name.toLowerCase() : '',
        groomerName: groomer ? groomer.name.toLowerCase() : '',
        serviceStr: serviceStr || ''
      });
    });


    // 2. Process Service Records
    this.store.getServiceRecords().forEach(s => {
      // Determine time range
      let timeRange = '-';
      if (s.checkInAt && s.completedAt) {
        const checkIn = new Date(s.checkInAt);
        const completed = new Date(s.completedAt);
        if (!isNaN(checkIn) && !isNaN(completed)) {
          const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          timeRange = `${formatTime(checkIn)} - ${formatTime(completed)}`;
        }
      }
      // Fallback
      if (timeRange === '-' && s.appointmentTime) {
        timeRange = s.appointmentTime;
        if (s.estimatedEndTime) timeRange += ` - ${s.estimatedEndTime}`;
      }

      // CHECK DUPLICATES: If this service record corresponds to a queue item we already added, skip it
      if (s.queueId && allRecords.some(r => r.queueId === s.queueId)) {
        return;
      }

      const customer = this.store.getCustomerById(s.customerId);
      const pet = this.store.getPetById(s.petId);
      const groomer = s.groomerId ? this.store.getGroomerById(s.groomerId) : null;
      let serviceStr = Array.isArray(s.servicesPerformed) ? s.servicesPerformed.join(' ') : s.servicesPerformed;

      allRecords.push({
        type: 'history',
        date: s.date,
        time: timeRange,
        appointmentTime: s.appointmentTime,
        dateTime: new Date(`${s.date}T${s.appointmentTime || '00:00'}`),
        status: 'completed',
        customerId: s.customerId,
        petId: s.petId,
        groomerId: s.groomerId,
        services: s.servicesPerformed || [],
        duration: s.duration,
        checkInAt: s.checkInAt,
        completedAt: s.completedAt,
        checkInWeight: s.checkInWeight,
        id: s.id,
        queueId: s.queueId, // Add queueId for reference
        // Resolved names
        customerName: customer ? customer.name.toLowerCase() : '',
        petName: pet ? pet.name.toLowerCase() : '',
        groomerName: groomer ? groomer.name.toLowerCase() : '',
        serviceStr: serviceStr || ''
      });
    });

    // 3. Filter
    if (searchTerm) {
      allRecords = allRecords.filter(r => {
        return r.customerName.includes(searchTerm) ||
          r.petName.includes(searchTerm) ||
          r.groomerName.includes(searchTerm);
      });
    }

    // 4. Sort
    const { column, direction } = this.currentSort;
    allRecords.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      // Handle specific columns if needed
      if (column === 'date') valA = a.dateTime; // Sort by dateTime object for date column
      if (column === 'date') valB = b.dateTime;

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    const tbody = document.getElementById('services-tbody');

    // Skeleton Loading - REMOVED: Data is already loaded from Firebase
    // if (this.loading) {
    //   tbody.innerHTML = this.renderSkeletonService(5);
    //   return;
    // }


    if (allRecords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบบันทึกบริการ
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = allRecords.map(r => {
        const customer = this.store.getCustomerById(r.customerId);
        const pet = this.store.getPetById(r.petId);
        const groomer = r.groomerId ? this.store.getGroomerById(r.groomerId) : null;

        // Status Badge
        const statusMap = {
          'booking': '📝 จองคิว',
          'deposit': '💰 เก็บมัดจำแล้ว',
          'check-in': '🔍 เช็คอิน',
          'completed': '✅ เสร็จสิ้น',
          'cancelled': '❌ ยกเลิก'
        };
        const statusBadgeMap = {
          'booking': 'badge-booking',
          'deposit': 'badge-deposit',
          'check-in': 'badge-checkin',
          'completed': 'badge-completed',
          'cancelled': 'badge-cancelled'
        };
        let statusBadge = statusMap[r.status] ?
          `<span class="badge ${statusBadgeMap[r.status]}">${statusMap[r.status]}</span>` :
          `<span class="badge">${r.status}</span>`;

        // Services
        let serviceList = Array.isArray(r.services) ? r.services.join(', ') : r.services;
        if (!serviceList && r.serviceType) serviceList = Array.isArray(r.serviceType) ? r.serviceType.join(', ') : r.serviceType;

        // Weight
        let weightDisplay = r.checkInWeight ? `${r.checkInWeight} กก.` : '-';

        return `
          <tr onclick="app.showServiceDetails('${r.id}')">
            <td>${r.date}</td>
            <td style="font-weight:600; color:var(--secondary-color);">${r.time}</td>
            <td>${statusBadge}</td>
            <td>${customer?.name || 'ไม่ระบุ'}</td>
            <td>${pet?.name || 'ไม่ระบุ'}</td>
            <td>${groomer?.name || '-'}</td>
            <td>${serviceList || '-'}</td>
            <td>${r.duration || '-'} นาที</td>
            <td><strong>${weightDisplay}</strong></td>
            <td>
               ${r.type === 'history' ?
            `<button class="btn btn-sm btn-info" onclick="event.stopPropagation(); app.showEditServiceModal('${r.id}')">✏️ แก้ไข</button>` :
            `<span class="text-muted" style="font-size:0.8rem">จัดการที่หน้าคิว</span>`
          }
            </td>
          </tr>
        `;
      }).join('');
    }

    // Update Sort Icons
    this.updateSortIcons();
  }

  showServiceDetails(recordId) {
    const record = this.store.getServiceRecordById(recordId) || this.store.data.queue.find(q => q.id === recordId);
    if (!record) return;

    const customer = this.store.getCustomerById(record.customerId);
    const pet = this.store.getPetById(record.petId);
    const groomer = record.groomerId ? this.store.getGroomerById(record.groomerId) :
      (record.assignedGroomerId ? this.store.getGroomerById(record.assignedGroomerId) : null);

    const content = document.getElementById('service-details-content');

    // Format Display Values
    let serviceList = Array.isArray(record.servicesPerformed) ? record.servicesPerformed.join(', ') : record.servicesPerformed;
    if (!serviceList && record.serviceType) serviceList = Array.isArray(record.serviceType) ? record.serviceType.join(', ') : record.serviceType;
    if (!serviceList && record.services) serviceList = Array.isArray(record.services) ? record.services.join(', ') : record.services;

    const statusMap = {
      'booking': '📝 จองคิว',
      'deposit': '💰 เก็บมัดจำแล้ว',
      'check-in': '🔍 เช็คอิน',
      'completed': '✅ เสร็จสิ้น',
      'cancelled': '❌ ยกเลิก'
    };

    const currentStatus = record.status || (this.store.getServiceRecordById(recordId) ? 'completed' : 'unknown');

    content.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">วันที่บริการ</div>
        <div class="detail-value">${record.date}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">เวลาทำงาน</div>
        <div class="detail-value">${record.appointmentTime || record.time || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">ลูกค้า</div>
        <div class="detail-value">${customer?.name || 'ไม่ระบุ'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">สัตว์เลี้ยง</div>
        <div class="detail-value">${pet?.name || 'ไม่ระบุ'} (${pet?.breed || '-'})</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">ช่างผู้ดูแล</div>
        <div class="detail-value">${groomer?.name || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">สถานะ</div>
        <div class="detail-value">${statusMap[currentStatus] || currentStatus}</div>
      </div>
      <div class="detail-item" style="grid-column: span 2;">
        <div class="detail-label">บริการที่ได้รับ</div>
        <div class="detail-value">${serviceList || '-'}</div>
      </div>
      <div class="detail-item" style="grid-column: span 2;">
        <div class="detail-label">หมายเหตุ</div>
        <div class="detail-value">${record.notes || record.completionNotes || '-'}</div>
      </div>
    `;

    // Handle Images
    const imageContainer = document.getElementById('service-details-images');
    const imageSection = document.getElementById('service-details-images-section');
    const images = record.completionImages || [];

    if (images.length > 0) {
      imageSection.style.display = 'block';
      imageContainer.innerHTML = images.map(img => `
        <div class="preview-image-container">
          <img src="${img.base64}" class="preview-image" onclick="app.openLightbox('${img.base64}')">
        </div>
      `).join('');
    } else {
      imageSection.style.display = 'none';
    }

    this.openModal('modal-service-details');
  }

  // New: Open Lightbox
  openLightbox(imageSrc) {
    const modal = document.getElementById('modal-lightbox');
    const img = document.getElementById('lightbox-image');
    if (modal && img) {
      img.src = imageSrc;
      this.openModal('modal-lightbox');
    }
  }

  sortServices(column) {
    if (!this.currentSort) this.currentSort = { column: 'dateTime', direction: 'desc' };

    if (this.currentSort.column === column) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.column = column;
      this.currentSort.direction = 'asc';
    }
    this.renderServices();
  }

  updateSortIcons() {
    // Clear all icons (if we had specific class for icons)
    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '⇅');

    // Set active icon
    const { column, direction } = this.currentSort;
    const iconId = `sort-icon-${column}`;
    const iconEl = document.getElementById(iconId);
    if (iconEl) {
      iconEl.textContent = direction === 'asc' ? '⬆️' : '⬇️';
      // Highlight header?
    }
  }

  // ===================================
  // USER RENDERING & LOGIC
  // ===================================

  renderUsers() {
    const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
    let users = this.store.getUsers();

    if (searchTerm) {
      users = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm) ||
        u.realname.toLowerCase().includes(searchTerm) ||
        (u.phone && u.phone.includes(searchTerm))
      );
    }

    const tbody = document.getElementById('users-tbody');

    // NEW: Skeleton Loading
    if (this.loading) {
      tbody.innerHTML = this.renderSkeletonTable(5, 5);
      return;
    }

    if (users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบข้อมูลผู้ใช้งาน
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${u.username}</strong></td>
          <td>${u.realname}</td>
          <td>
            <span class="badge ${u.role === 'admin' ? 'badge-cancelled' : 'badge-checkin'}">
              ${u.role === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </td>
          <td>${u.phone || '-'}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-info" onclick="app.editUser('${u.id}')">แก้ไข</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteUser('${u.id}')">ลบ</button>
          </td>
        </tr>
      `).join('');
    }
  }

  showAddUserModal() {
    document.getElementById('user-id').value = '';
    document.getElementById('modal-user-title').textContent = 'เพิ่มผู้ใช้งาน';
    document.getElementById('form-user').reset();
    document.getElementById('user-password').required = true; // Password required for new user
    document.getElementById('user-password').placeholder = 'กรอกรหัสผ่าน';
    this.openModal('modal-user');
  }

  editUser(id) {
    const user = this.store.getUserById(id);
    if (!user) return;

    document.getElementById('user-id').value = user.id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-realname').value = user.realname;
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-phone').value = user.phone || '';

    // Clear password field for edit
    const passInput = document.getElementById('user-password');
    passInput.value = '';
    passInput.required = false; // Optional for edit
    passInput.placeholder = 'ว่างไว้หากไม่ต้องการเปลี่ยน';

    document.getElementById('modal-user-title').textContent = 'แก้ไขผู้ใช้งาน';
    this.openModal('modal-user');
  }

  async saveUser() {
    const id = document.getElementById('user-id').value;
    const password = document.getElementById('user-password').value;

    const userData = {
      username: document.getElementById('user-username').value,
      realname: document.getElementById('user-realname').value,
      role: document.getElementById('user-role').value,
      phone: document.getElementById('user-phone').value
    };

    if (!userData.username || !userData.realname) {
      alert('กรุณากรอกข้อมูลที่จำเป็น (*)');
      return;
    }

    // Handle Password
    if (id) {
      // Edit mode: Update password only if provided
      if (password) {
        userData.password = password; // In real app, hash this!
      }

      const btn = document.querySelector('#modal-user .btn-primary');
      this.setButtonLoading(btn, true);

      try {
        await this.store.updateUser(id, userData);
      } finally {
        this.setButtonLoading(btn, false);
      }
    } else {
      // Add mode: Password is required
      if (!password) {
        alert('กรุณากรอกรหัสผ่าน');
        return;
      }
      userData.password = password; // In real app, hash this!

      const btn = document.querySelector('#modal-user .btn-primary');
      this.setButtonLoading(btn, true);

      try {
        await this.store.addUser(userData);
      } finally {
        this.setButtonLoading(btn, false);
      }
    }

    this.closeModal('modal-user');
    this.renderUsers();
  }

  async deleteUser(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งานนี้?')) {
      await this.store.deleteUser(id);
      this.renderUsers();
    }
  }

  // ===================================

  showAddCustomerModal() {
    document.getElementById('customer-id').value = '';
    document.getElementById('modal-customer-title').textContent = 'เพิ่มลูกค้าใหม่';
    document.getElementById('form-customer').reset();
    this.openModal('modal-customer');
  }

  showAddPetModal() {
    document.getElementById('pet-id').value = '';
    document.getElementById('modal-pet-title').textContent = 'เพิ่มสัตว์เลี้ยงใหม่';
    document.getElementById('form-pet').reset();
    this.populateCustomerDropdown();
    this.openModal('modal-pet');
  }

  showAddGroomerModal() {
    document.getElementById('groomer-id').value = '';
    document.getElementById('modal-groomer-title').textContent = 'เพิ่มช่างใหม่';
    document.getElementById('form-groomer').reset();
    this.openModal('modal-groomer');
  }



  showAddQueueModal() {
    this.editingQueueId = null;
    document.getElementById('form-queue').reset();
    this.clearCustomerSelection(); // Fix: Clear previous customer selection
    this.populateCustomerDropdown('queue-customer');
    this.populateGroomerDropdown();

    // NEW: Initialize smart scheduling
    console.log('[DEBUG] initializeQueueModal called');
    this.initializeQueueModal();

    // Setup customer search
    this.setupCustomerSearch();

    // Populate booker dropdown
    this.populateBookerDropdown();

    // Set modal title back to default
    const modalTitle = document.querySelector('#modal-queue .modal-title');
    if (modalTitle) modalTitle.textContent = 'เพิ่มคิวใหม่';

    const saveBtn = document.getElementById('queue-save-btn');
    if (saveBtn) saveBtn.textContent = 'เพิ่มคิว';

    this.openModal('modal-queue');
  }

  populateBookerDropdown() {
    const bookerSelect = document.getElementById('queue-booker');
    if (!bookerSelect) return;

    const users = this.store.getUsers();
    // Save current selection if any
    const currentValue = bookerSelect.value;

    let html = '<option value="">-- เลือกคนลงคิว --</option>';

    // Add "Admin" as default/fallback option if no users or just to have it
    // html += '<option value="Admin">Admin</option>'; 

    users.forEach(user => {
      const displayName = user.realname || user.username;
      html += `<option value="${displayName}">${displayName}</option>`;
    });

    bookerSelect.innerHTML = html;

    if (currentValue) {
      bookerSelect.value = currentValue;
    }
  }

  // Setup customer search functionality
  setupCustomerSearch() {
    const searchInput = document.getElementById('customer-search-input');
    const resultsDiv = document.getElementById('customer-search-results');

    if (!searchInput || !resultsDiv) return;

    // Clear previous value
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    resultsDiv.classList.remove('show');

    // Add input event listener
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      if (query.length < 1) {
        resultsDiv.classList.remove('show');
        // Reset dropdown to show all customers
        this.populateCustomerDropdown('queue-customer');
        return;
      }

      const results = this.searchCustomers(query);
      this.displaySearchResults(results, resultsDiv);

      // Also filter the select dropdown
      this.filterCustomerDropdown(results);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.classList.remove('show');
      }
    });
  }

  // Search customers by name or phone
  searchCustomers(query) {
    const customers = this.store.getCustomers();
    query = query.toLowerCase();

    return customers.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      (c.socialName && c.socialName.toLowerCase().includes(query))
    );
  }

  // Display search results
  displaySearchResults(results, containerEl) {
    if (results.length === 0) {
      const searchQuery = document.getElementById('customer-search-input').value.trim();
      containerEl.innerHTML = `
        <div class="search-no-results">
          <div style="margin-bottom: 0.5rem;">ไม่พบลูกค้า</div>
          <button class="btn btn-sm btn-success" onclick="app.quickAddFromSearch('${searchQuery}')" style="width: 100%;">
            ➕ เพิ่มลูกค้าใหม่
          </button>
        </div>
      `;
      containerEl.classList.add('show');
      return;
    }

    let html = '';
    results.forEach(customer => {
      html += `
        <div class="search-result-item" data-customer-id="${customer.id}">
          <div class="search-result-name">${customer.name}</div>
          <div class="search-result-phone">${customer.phone}</div>
        </div>
      `;
    });

    containerEl.innerHTML = html;
    containerEl.classList.add('show');

    // Add click listeners to results
    const items = containerEl.querySelectorAll('.search-result-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const customerId = item.dataset.customerId;
        this.selectCustomerFromSearch(customerId);
      });
    });
  }

  // Select customer from search results
  selectCustomerFromSearch(customerId) {
    const searchInput = document.getElementById('customer-search-input');
    const resultsDiv = document.getElementById('customer-search-results');
    const customerSelect = document.getElementById('queue-customer');

    // Elements for new UI
    const selectionContainer = document.getElementById('customer-selection-container');
    const selectedCard = document.getElementById('selected-customer-card');
    const nameEl = document.getElementById('selected-customer-name');
    const phoneEl = document.getElementById('selected-customer-phone');

    // Set customer dropdown value
    customerSelect.value = customerId;

    // Get customer name for display
    const customer = this.store.getCustomers().find(c => c.id === customerId);
    if (customer) {
      // Update Card UI
      nameEl.textContent = customer.name;
      phoneEl.textContent = customer.phone;

      // Switch to Selected Mode
      if (selectionContainer && selectedCard) {
        selectionContainer.style.display = 'none';
        selectedCard.style.display = 'flex';
      } else {
        // Fallback if elements missing
        searchInput.value = `${customer.name} - ${customer.phone}`;
      }
    }

    // Hide results
    resultsDiv.classList.remove('show');

    // Trigger to load pets
    this.loadPetsByCustomer();
  }

  // Clear customer selection
  clearCustomerSelection() {
    const customerSelect = document.getElementById('queue-customer');
    const searchInput = document.getElementById('customer-search-input');
    const selectionContainer = document.getElementById('customer-selection-container');
    const selectedCard = document.getElementById('selected-customer-card');
    const petSelect = document.getElementById('queue-pet');

    // Reset values
    customerSelect.value = '';
    searchInput.value = '';

    // Switch UI back to Search Mode
    if (selectionContainer && selectedCard) {
      selectionContainer.style.display = 'block';
      selectedCard.style.display = 'none';
    }

    // Clear pets
    if (petSelect) {
      petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง --</option>';
    }

    // Focus search
    searchInput.focus();
  }

  // Filter customer dropdown based on search results
  filterCustomerDropdown(filteredCustomers) {
    const customerSelect = document.getElementById('queue-customer');
    if (!customerSelect) return;

    // Clear current options except the placeholder
    customerSelect.innerHTML = '<option value="">-- เลือกลูกค้า --</option>';

    // Add filtered customers
    filteredCustomers.forEach(customer => {
      const option = document.createElement('option');
      option.value = customer.id;
      option.textContent = `${customer.name} - ${customer.phone}`;
      customerSelect.appendChild(option);
    });
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  // ===================================
  // CUSTOMER OPERATIONS
  // ===================================

  async saveCustomer() {
    const id = document.getElementById('customer-id').value;
    const customerData = {
      name: document.getElementById('customer-name').value,
      socialName: document.getElementById('customer-social-name').value,
      phone: document.getElementById('customer-phone').value,
      email: document.getElementById('customer-email').value,
      address: document.getElementById('customer-address').value
    };

    if (!customerData.name || !customerData.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }

    if (id) {
      await this.store.updateCustomer(id, customerData);
    } else {
      await this.store.addCustomer(customerData);
    }

    this.closeModal('modal-customer');
    // No need to call render manually as listener will handle it, but for safety/instant feedback:
    this.renderCustomers();
    this.renderDashboard();
  }

  showCustomerHistory(customerId) {
    // 1. Get History
    const history = this.store.getServiceRecordsByCustomer(customerId).map(s => {
      // Try to find original queue item (for immediate updates)
      const originalQueue = this.store.data.queue.find(q => q.id === s.queueId);

      // Determine time range
      let timeRange = s.time || '-'; // default fallback

      // Strategy 1: Use Appointment Time (from original queue or saved record)
      const appTime = originalQueue?.appointmentTime || s.appointmentTime;
      const appEndTime = originalQueue?.estimatedEndTime || s.estimatedEndTime;

      if (appTime) {
        timeRange = appEndTime ? `${appTime} - ${appEndTime}` : appTime;
      }
      // Strategy 2: Use Check-in/Completed time if appointment time missing
      else if (s.checkInAt && s.completedAt) {
        const checkIn = new Date(s.checkInAt);
        const completed = new Date(s.completedAt);
        const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        timeRange = `${formatTime(checkIn)} - ${formatTime(completed)}`;
      }

      return {
        type: 'history',
        date: s.date,
        time: timeRange,
        dateTime: new Date(`${s.date}T${(appTime || (s.time ? s.time.split(' - ')[0] : '00:00'))}`),
        service: s.servicesPerformed.join(', '),
        duration: s.duration,
        transport: s.transport || false,
        groomerId: s.groomerId,
        status: 'completed',
        notes: s.notes || '-',
        petId: s.petId,
        weight: s.weight // If available in history
      };
    });

    // 2. Get Active Queue (Filter out completed to avoid duplicates)
    const queue = this.store.data.queue
      .filter(q => q.customerId === customerId && q.status !== 'completed')
      .map(q => {
        // Calculate time range if available
        let timeRange = q.appointmentTime || '-';
        if (q.appointmentTime && q.estimatedEndTime) {
          timeRange = `${q.appointmentTime} - ${q.estimatedEndTime}`;
        }

        return {
          type: 'queue',
          date: q.date,
          time: timeRange,
          // FIX: Map properties for createHistoryRow
          appointmentTime: timeRange, // Used by createHistoryRow
          servicesPerformed: Array.isArray(q.serviceType) ? q.serviceType : [q.serviceType], // Used by createHistoryRow

          dateTime: new Date(`${q.date}T${q.appointmentTime || '00:00'}`),
          service: Array.isArray(q.serviceType) ? q.serviceType.join(', ') : q.serviceType,
          duration: q.duration,
          transport: q.isTransportIncluded,
          groomerId: q.assignedGroomerId || q.groomerId,
          status: q.status,
          notes: q.notes || '-',
          petId: q.petId,
          weight: q.checkInWeight // Map checkInWeight
        };
      });

    // 3. Combine and Sort (Newest First)
    const allRecords = [...queue, ...history].sort((a, b) => b.dateTime - a.dateTime);

    const tbody = document.getElementById('history-tbody');

    if (allRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">ไม่พบประวัติการใช้บริการ</td></tr>`;
    } else {
      tbody.innerHTML = allRecords.map(r => this.createHistoryRow(r)).join('');
    }

    this.openModal('modal-customer-history');
  }

  createHistoryRow(record) {
    const pet = this.store.getPetById(record.petId);
    const groomer = record.groomerId ? this.store.getGroomerById(record.groomerId) : null;

    // Status Badge
    let statusBadge = '';
    if (record.status === 'waiting') statusBadge = '<span class="badge badge-waiting">รอคิว</span>';
    else if (record.status === 'in_progress') statusBadge = '<span class="badge badge-inprogress">กำลังทำ</span>';
    else if (record.status === 'completed') statusBadge = '<span class="badge badge-completed">เสร็จสิ้น</span>';
    else if (record.status === 'cancelled') statusBadge = '<span class="badge badge-cancelled">ยกเลิก</span>';
    else statusBadge = `<span class="badge">${record.status}</span>`;

    // Time Formatting
    let timeDisplay = record.time;
    if (record.type === 'history' && !record.time) {
      timeDisplay = '-';
    }

    // Transport Badge
    const transportBadge = record.transport ? '<div style="margin-top:4px; font-size:0.8rem;">🚗 บริการรับ-ส่ง</div>' : '';

    // Duration Display
    const durationDisplay = record.duration ? ` (${record.duration} นาที)` : '';

    // Weight Display (Prefer check-in weight, then pet weight)
    const weightVal = record.weight || pet?.weight;
    const weightDisplay = weightVal ? `<div style="font-size:0.8rem; color:#666;">น้ำหนัก: ${weightVal} กก.</div>` : '';

    return `
      <tr>
        <td>
            <div>${record.date}</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">${statusBadge}</div>
        </td>
        <td>${timeDisplay}</td>
        <td>
            <div>${pet?.name || '-'} ${pet?.type ? `<span class="badge badge-${pet.type}">${pet.type === 'dog' ? 'สุนัข' : 'แมว'}</span>` : ''}</div>
            ${weightDisplay}
        </td>
        <td>
            <div>${record.service}${durationDisplay}</div>
            ${transportBadge}
        </td>
        <td>${groomer?.name || '-'}</td>
        <td class="text-danger">${record.notes}</td>
      </tr>
    `;
  }

  createHistoryRow(record) {
    const pet = this.store.getPetById(record.petId);
    const groomer = record.groomerId ? this.store.getGroomerById(record.groomerId) : null;

    // Format date and time
    const dateObj = new Date(record.date);
    const dateStr = `${dateObj.getDate()} ${this.getMonthName(dateObj.getMonth())} ${dateObj.getFullYear() + 543}`; // DD MMM YYYY (Thai)

    let timeRange = '-';
    if (record.checkInAt && record.completedAt) {
      const checkIn = new Date(record.checkInAt);
      const completed = new Date(record.completedAt);
      const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      timeRange = `${formatTime(checkIn)} - ${formatTime(completed)}`;
    } else if (record.appointmentTime) {
      timeRange = record.appointmentTime;
    }

    // Service list
    let serviceText = '-';
    if (Array.isArray(record.servicesPerformed)) {
      serviceText = record.servicesPerformed.join(', ');
    } else if (record.servicesPerformed) {
      serviceText = record.servicesPerformed;
    }

    const durationText = record.duration ? `(${record.duration} นาที)` : '';

    return `
      <tr>
        <td>${dateStr}</td>
        <td>${timeRange}</td>
        <td>
          ${pet?.name || 'ไม่ระบุ'} 
          <span class="badge ${pet?.type === 'dog' ? 'badge-dog' : 'badge-cat'}" style="font-size: 0.7em;">${pet?.type === 'dog' ? 'สุนัข' : 'แมว'}</span>
        </td>
        <td>${serviceText} ${durationText} ${record.checkInWeight ? `<br><small class="text-muted">น้ำหนัก: ${record.checkInWeight} กก.</small>` : ''}</td>
        <td>${groomer ? groomer.name : '-'}</td>
        <td style="max-width: 200px;">
          ${record.notes ? `<span style="color: var(--error);">${record.notes}</span>` : '-'}
        </td>
      </tr>
    `;
  }

  getMonthName(monthIndex) {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return months[monthIndex];
  }


  showCustomerPets(customerId) {
    // Legacy support or alternative view if needed
    this.showCustomerHistory(customerId);
  }

  editCustomer(id) {
    const customer = this.store.getCustomerById(id);
    if (!customer) return;

    document.getElementById('customer-id').value = customer.id;
    document.getElementById('customer-name').value = customer.name;
    document.getElementById('customer-phone').value = customer.phone;
    document.getElementById('customer-email').value = customer.email || '';
    document.getElementById('customer-address').value = customer.address || '';
    document.getElementById('modal-customer-title').textContent = 'แก้ไขข้อมูลลูกค้า';

    this.openModal('modal-customer');
  }

  async deleteCustomer(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบลูกค้ารายนี้?')) {
      await this.store.deleteCustomer(id);
      this.renderCustomers();
      this.renderDashboard();
    }
  }

  // ===================================
  // PET OPERATIONS
  // ===================================

  async savePet() {
    const id = document.getElementById('pet-id').value;
    const petData = {
      customerId: document.getElementById('pet-customer').value,
      name: document.getElementById('pet-name').value,
      type: document.getElementById('pet-type').value,
      breed: document.getElementById('pet-breed').value,
      weight: parseFloat(document.getElementById('pet-weight').value) || null,
      color: document.getElementById('pet-color').value,
      birthDate: document.getElementById('pet-birthdate').value,
      notes: document.getElementById('pet-notes').value
    };

    if (!petData.customerId || !petData.name || !petData.type) {
      alert('กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }

    if (id) {
      await this.store.updatePet(id, petData);
    } else {
      await this.store.addPet(petData);
    }

    this.closeModal('modal-pet');
    this.renderPets();
  }

  editPet(id) {
    const pet = this.store.getPetById(id);
    if (!pet) return;

    this.populateCustomerDropdown();

    document.getElementById('pet-id').value = pet.id;
    document.getElementById('pet-customer').value = pet.customerId;
    document.getElementById('pet-name').value = pet.name;
    document.getElementById('pet-type').value = pet.type;
    document.getElementById('pet-breed').value = pet.breed || '';
    document.getElementById('pet-weight').value = pet.weight || '';
    document.getElementById('pet-color').value = pet.color || '';
    document.getElementById('pet-birthdate').value = pet.birthDate || '';
    document.getElementById('pet-notes').value = pet.notes || '';
    document.getElementById('modal-pet-title').textContent = 'แก้ไขข้อมูลสัตว์เลี้ยง';

    this.openModal('modal-pet');
  }

  async deletePet(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบสัตว์เลี้ยงตัวนี้?')) {
      await this.store.deletePet(id);
      this.renderPets();
    }
  }

  // ===================================
  // PET MODAL HELPERS
  // ===================================

  setupPetModalListeners() {
    const searchInput = document.getElementById('pet-modal-customer-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handlePetCustomerSearch(e.target.value);
      });

      // Close search results when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#pet-modal-customer-search') && !e.target.closest('#pet-modal-search-results')) {
          const resultsDiv = document.getElementById('pet-modal-search-results');
          if (resultsDiv) resultsDiv.classList.remove('show');
        }
      });
    }
  }

  handlePetCustomerSearch(searchTerm) {
    const resultsDiv = document.getElementById('pet-modal-search-results');
    if (!resultsDiv) return;

    if (!searchTerm || searchTerm.length < 2) {
      resultsDiv.classList.remove('show');
      return;
    }

    const customers = this.store.getCustomers();
    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<div class="search-result-item" onclick="app.togglePetQuickAddCustomer(document.getElementById(\'pet-modal-customer-search\').value)">+ เพิ่มเจ้าของใหม่</div>';
      resultsDiv.classList.add('show');
      return;
    }

    resultsDiv.innerHTML = filtered.map(c => `
      <div class="search-result-item" onclick="app.selectCustomerForPet('${c.id}')">
        <div class="name">${c.name} ${c.socialName ? `(${c.socialName})` : ''}</div>
        <div class="phone">${c.phone}</div>
      </div>
    `).join('');

    resultsDiv.classList.add('show');
  }

  selectCustomerForPet(customerId) {
    const select = document.getElementById('pet-customer');
    if (select) {
      select.value = customerId;
    }

    // Clear search
    document.getElementById('pet-modal-customer-search').value = '';
    const resultsDiv = document.getElementById('pet-modal-search-results');
    if (resultsDiv) resultsDiv.classList.remove('show');
  }

  togglePetQuickAddCustomer(initialName = '') {
    const form = document.getElementById('pet-modal-quick-customer-form');
    if (form) {
      if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        if (initialName && typeof initialName === 'string') {
          // Basic check if it's phone or name like in queue modal
          if (/^\d+$/.test(initialName)) {
            document.getElementById('pet-quick-phone').value = initialName;
          } else {
            document.getElementById('pet-quick-name').value = initialName;
          }
        }
      } else {
        form.classList.add('hidden');
      }
    }
    // Hide search results
    const resultsDiv = document.getElementById('pet-modal-search-results');
    if (resultsDiv) resultsDiv.classList.remove('show');
  }

  cancelPetQuickAddCustomer() {
    document.getElementById('pet-modal-quick-customer-form').classList.add('hidden');
    document.getElementById('pet-quick-name').value = '';
    document.getElementById('pet-quick-social').value = '';
    document.getElementById('pet-quick-phone').value = '';
  }

  async savePetQuickCustomer() {
    const name = document.getElementById('pet-quick-name').value;
    const socialName = document.getElementById('pet-quick-social').value;
    const phone = document.getElementById('pet-quick-phone').value;

    if (!name || !phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }

    const customer = await this.store.addCustomer({
      name,
      socialName,
      phone,
      email: '',
      address: ''
    });

    if (!customer) return;

    // Refresh dropdowns logic
    this.populateCustomerDropdown('pet-customer');

    // Select new customer
    this.selectCustomerForPet(customer.id);
    this.cancelPetQuickAddCustomer();
  }

  // ===================================
  // GROOMER OPERATIONS
  // ===================================

  async saveGroomer() {
    const id = document.getElementById('groomer-id').value;

    const specialtySelect = document.getElementById('groomer-specialty');
    const selectedSpecialties = Array.from(specialtySelect.selectedOptions).map(opt => opt.value);

    const groomerData = {
      name: document.getElementById('groomer-name').value,
      nickname: document.getElementById('groomer-nickname').value,
      phone: document.getElementById('groomer-phone').value,
      email: document.getElementById('groomer-email').value,
      specialty: selectedSpecialties.length > 0 ? selectedSpecialties : ['both'],
      experienceLevel: document.getElementById('groomer-level').value,
      isActive: document.getElementById('groomer-active').value === 'true',
      hireDate: document.getElementById('groomer-hiredate').value,
      notes: document.getElementById('groomer-notes').value
    };

    if (!groomerData.name || !groomerData.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }

    if (id) {
      await this.store.updateGroomer(id, groomerData);
    } else {
      await this.store.addGroomer(groomerData);
    }

    this.closeModal('modal-groomer');
    this.renderGroomers();
  }

  editGroomer(id) {
    const groomer = this.store.getGroomerById(id);
    if (!groomer) return;

    document.getElementById('groomer-id').value = groomer.id;
    document.getElementById('groomer-name').value = groomer.name;
    document.getElementById('groomer-nickname').value = groomer.nickname || '';
    document.getElementById('groomer-phone').value = groomer.phone;
    document.getElementById('groomer-email').value = groomer.email || '';

    // Set specialty multi-select
    const specialtySelect = document.getElementById('groomer-specialty');
    Array.from(specialtySelect.options).forEach(option => {
      option.selected = groomer.specialty.includes(option.value);
    });

    document.getElementById('groomer-level').value = groomer.experienceLevel;
    document.getElementById('groomer-active').value = groomer.isActive.toString();
    document.getElementById('groomer-hiredate').value = groomer.hireDate || '';
    document.getElementById('groomer-notes').value = groomer.notes || '';
    document.getElementById('modal-groomer-title').textContent = 'แก้ไขข้อมูลช่าง';

    this.openModal('modal-groomer');
  }

  async deleteGroomer(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบช่างคนนี้?')) {
      await this.store.deleteGroomer(id);
      this.renderGroomers();
    }
  }

  // ===================================
  // QUEUE OPERATIONS
  // ===================================

  editQueue(id) {
    console.log('[DEBUG] editQueue called with id:', id);
    const queue = this.store.getQueue().find(q => q.id === id);
    if (!queue) {
      alert('ไม่พบข้อมูลคิว');
      return;
    }

    this.editingQueueId = id;

    // Reset and setup modal
    document.getElementById('form-queue').reset();
    this.populateCustomerDropdown('queue-customer');
    this.populateGroomerDropdown();
    this.populateBookerDropdown();
    this.initializeQueueModal();
    this.setupCustomerSearch();

    // Set modal title
    const modalTitle = document.querySelector('#modal-queue .modal-title');
    if (modalTitle) modalTitle.textContent = 'แก้ไขข้อมูลการจอง';

    // Populate fields
    const customerSelect = document.getElementById('queue-customer');
    customerSelect.value = queue.customerId;
    this.selectCustomerFromSearch(queue.customerId); // This updates the UI card

    // After loading pets for customer, set pet
    this.loadPetsByCustomer(queue.customerId);
    const petSelect = document.getElementById('queue-pet');
    petSelect.value = queue.petId;

    document.getElementById('queue-date').value = queue.date;
    document.getElementById('queue-groomer').value = queue.assignedGroomerId || '';
    document.getElementById('queue-source').value = queue.marketingSource || '';
    document.getElementById('queue-booker').value = queue.bookerName || '';
    document.getElementById('queue-health').value = queue.health || '';
    document.getElementById('queue-ticks').value = queue.ticks || '';
    document.getElementById('queue-notes').value = queue.notes || '';
    document.getElementById('queue-priority').checked = !!queue.priority;
    document.getElementById('queue-transport').checked = !!queue.isTransportIncluded;

    // Set services (checkboxes)
    const services = queue.serviceType || [];
    document.querySelectorAll('input[name="service-type"]').forEach(cb => {
      cb.checked = services.includes(cb.value);
    });
    document.querySelectorAll('input[name="service-addon"]').forEach(cb => {
      cb.checked = services.includes(cb.value);
    });

    // CRITICAL: Set the time slot value BEFORE calling updateTimeSlots
    const timeSlotInput = document.getElementById('queue-time-slot');
    timeSlotInput.value = queue.appointmentTime || '';

    // Populate time slot buttons
    this.updateTimeSlots();

    // Highlight the selected time slot button (Fixing typo from .time-slot-btn to .time-slot-button)
    setTimeout(() => {
      if (queue.appointmentTime) {
        const timeButtons = document.querySelectorAll('.time-slot-button');
        timeButtons.forEach(btn => {
          if (btn.dataset.time === queue.appointmentTime) {
            btn.classList.add('selected');
          }
        });
      }
    }, 100);

    // Update Save button text
    const saveBtn = document.getElementById('queue-save-btn');
    if (saveBtn) saveBtn.textContent = 'บันทึกการแก้ไข';

    this.openModal('modal-queue');
  }


  async saveQueue() {
    console.log('[DEBUG] saveQueue started');
    const customerId = document.getElementById('queue-customer').value;
    const petId = document.getElementById('queue-pet').value;
    const groomerId = document.getElementById('queue-groomer').value;

    const serviceCheckboxes = document.querySelectorAll('input[name="service-type"]:checked');
    const addonCheckboxes = document.querySelectorAll('input[name="service-addon"]:checked');

    let serviceTypes = Array.from(serviceCheckboxes).map(cb => cb.value);
    const addons = Array.from(addonCheckboxes).map(cb => cb.value);

    // Get date and time selection
    const selectedDate = document.getElementById('queue-date').value;
    const selectedTimeSlot = document.getElementById('queue-time-slot').value;

    const priority = document.getElementById('queue-priority').checked;
    const transportIncluded = document.getElementById('queue-transport').checked;
    const marketingSource = document.getElementById('queue-source').value;
    const bookerName = document.getElementById('queue-booker').value;
    const health = document.getElementById('queue-health').value;
    const ticks = document.getElementById('queue-ticks').value;
    const notes = document.getElementById('queue-notes').value;
    console.log('[DEBUG] saveQueue collected form data');

    // Calculate duration based ONLY on main services (as requested)
    let duration = 60;
    try {
      duration = this.store.calculateServiceDuration(serviceTypes);
    } catch (e) {
      console.error('Error calculating duration:', e);
      duration = 60; // Fallback
    }

    // Combine for storage AFTER duration calculation
    const allServices = [...serviceTypes, ...addons];
    console.log('[DEBUG] saveQueue duration calculated:', duration);

    try {
      if (!customerId || !petId || allServices.length === 0) {
        alert('กรุณากรอกข้อมูลที่จำเป็น');
        return;
      }

      if (!selectedDate) {
        alert('กรุณาเลือกวันที่นัดหมาย');
        return;
      }

      let endTime = null;
      if (selectedTimeSlot) {
        endTime = this.calculateEndTime(selectedTimeSlot, duration);
      }

      // Use manually selected groomer if any
      let assignedGroomerId = groomerId || null;

      // Construct queue data - REMOVED generateQueueNumber to let DataStore handle it
      const queueData = {
        customerId,
        petId,
        groomerId: assignedGroomerId,
        assignedGroomerId: assignedGroomerId,
        serviceType: allServices,
        date: selectedDate,
        bookingAt: new Date().toISOString(),
        status: 'booking',
        priority: !!priority, // Ensure boolean
        isTransportIncluded: !!transportIncluded, // Ensure boolean
        marketingSource: marketingSource || '',
        notes: notes || '',
        health: health || '',
        ticks: ticks || '',
        createdBy: this.currentUser,
        bookerName: bookerName || '-', // Added bookerName
        appointmentTime: selectedTimeSlot,
        estimatedEndTime: endTime,
        duration: duration
      };

      console.log('Sending to DataStore:', queueData);

      let queue;
      if (this.editingQueueId) {
        console.log('[DEBUG] saveQueue calling store.updateQueue for id:', this.editingQueueId);
        // On edit, we don't want to override bookingAt or status if they already exist
        // But we do want to update all other fields.
        const updateData = { ...queueData };
        delete updateData.bookingAt;
        delete updateData.status;

        queue = await this.store.updateQueue(this.editingQueueId, updateData);
        console.log('[DEBUG] saveQueue store.updateQueue returned', queue);
      } else {
        console.log('[DEBUG] saveQueue calling store.addQueue');
        queue = await this.store.addQueue(queueData);
        console.log('[DEBUG] saveQueue store.addQueue returned', queue);
      }

      console.log('DataStore returned:', queue);
      if (!queue) return;

      /*
      // --- Google Calendar Integration ---
      try {
        const customer = this.store.getCustomerById(customerId);
        const pet = this.store.getPetById(petId);
        const groomer = assignedGroomerId ? this.store.getGroomerById(assignedGroomerId) : null;
  
        const calendarPayload = {
          id: queue.id,
          ...queueData,
          customerName: customer ? customer.name : '-',
          customerPhone: customer ? customer.phone : '-',
          petName: pet ? pet.name : '-',
          petType: pet ? pet.type : '-',
          petBreed: pet ? pet.breed : '-',
          services: serviceTypes,
          groomerName: groomer ? groomer.name : 'Admin',
          checkInWeight: pet ? (pet.weight || '-') : '-',
          checkInNotes: pet ? (pet.notes || '-') : '-'
        };
  
        // Call Backend API
        fetch('/api/calendar/create-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calendarPayload)
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) console.log('✅ Google Calendar Event Created:', data.link);
            else console.error('❌ Failed to create calendar event:', data.error);
          })
          .catch(err => console.error('❌ Calendar API Error:', err));
  
      } catch (calError) {
        console.error('Error preparing calendar data:', calError);
      }
      // -----------------------------------
      */

      // Calculate duration display
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      const durationText = hours > 0
        ? (mins > 0 ? `${hours}:${String(mins).padStart(2, '0')} ชม.` : `${hours} ชม.`)
        : `${mins} นาที`;

      // Show confirmation with appointment details
      const groomer = assignedGroomerId ? this.store.getGroomerById(assignedGroomerId) : null;
      const servicesText = allServices.join(', ');


      // Show summary popup instead of simple alert
      this.showBookingSummary(queue, queueData);

      this.closeModal('modal-queue');
      console.log('[DEBUG] saveQueue closing modal');
      this.renderQueue();
      console.log('[DEBUG] saveQueue rendered queue');
      this.renderDashboard();
      console.log('[DEBUG] saveQueue rendered dashboard');
      console.log('[DEBUG] saveQueue finished');
    } catch (err) {
      console.error('Error saving queue:', err);
      // alert('เกิดข้อผิดพลาดในการบันทึกคิว: ' + err.message);
    }
  }

  showBookingSummary(queue, data) {
    const customer = this.store.getCustomerById(data.customerId);
    const pet = this.store.getPetById(data.petId);

    // Format date: DD-MM-YYYY (Buddhist Year)
    const dateObj = new Date(data.date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear() + 543;
    const dateStr = `${day}-${month}-${year}`;

    // Format time: Start - End
    const timeStr = data.appointmentTime && data.estimatedEndTime
      ? `${data.appointmentTime} - ${data.estimatedEndTime}`
      : (data.appointmentTime || '-');

    // Animal type mapping: dog -> สุนัข, cat -> แมว, other -> อื่นๆ
    let animalType = 'อื่นๆ';
    if (pet) {
      if (pet.type === 'dog') animalType = 'สุนัข';
      else if (pet.type === 'cat') animalType = 'แมว';
      // For all other types including 'other', use 'อื่นๆ' (Specificity is in breed field)
    }

    // Format services: Main first, then Add-ons
    const mainServicesList = this.store.data.settings.serviceTypes;
    const mainServices = data.serviceType.filter(s => mainServicesList.includes(s));
    const addons = data.serviceType.filter(s => !mainServicesList.includes(s));
    const servicesText = [...mainServices, ...addons].join(', ');

    // Merge notes logic
    const healthVal = data.health && data.health.trim() !== '' ? data.health : (pet && pet.notes ? pet.notes : 'ไม่มี');
    const ticksVal = data.ticks && data.ticks.trim() !== '' ? data.ticks : 'ไม่มี';
    const healthNotes = `${healthVal} เห็บหมัด: ${ticksVal}`;

    let summaryText = `สรุปจองคิวอาบ-ตัดขน 🐶🐱\n`;
    summaryText += `วันที่ ${dateStr}\n`;
    summaryText += ` เวลา ${timeStr}'\n\n`;

    summaryText += `ประเภทสัตว์เลี้ยง: ${animalType}\n`;
    summaryText += `สายพันธุ์: ${pet ? pet.breed || '-' : '-'}\n`;
    summaryText += `น้ำหนักโดยประมาณ: ${pet ? pet.weight || '-' : '-'}\n`;
    summaryText += `ทำอะไร: ${servicesText}\n`;
    summaryText += `ชื่อน้อง: น้อง${pet ? pet.name : '-'}\n`;
    summaryText += `โรคประจำตัวและเห็บ-หมัด: ${healthNotes}\n`;
    summaryText += `ชื่อผู้ปกครอง: คุณ${customer ? customer.name : '-'}\n`;
    summaryText += `เบอร์ติดต่อกลับ: ${customer ? customer.phone : '-'}\n\n`;

    summaryText += `รายละเอียดเพิ่มเติม: ${data.notes || '-'}\n`;
    summaryText += `ช่องทางการจอง: ${data.marketingSource || '-'}\n`;
    summaryText += `ผู้รับคิว: ${data.bookerName || '-'}`;

    document.getElementById('booking-summary-text').textContent = summaryText;
    this.openModal('modal-booking-summary');
  }

  copyBookingSummary() {
    const text = document.getElementById('booking-summary-text').textContent;
    const btn = document.getElementById('btn-copy-summary');
    const originalContent = btn.innerHTML;

    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = '<span>✅</span> คัดลอกสำเร็จ!';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-primary');

      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-success');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('ไม่สามารถคัดลอกได้: ' + err);
    });
  }

  // Calculate end time string from start time and duration
  calculateEndTime(startTime, durationMinutes) {
    if (!startTime || !durationMinutes) return null;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const totalStartMins = startHour * 60 + startMin;
    const totalEndMins = totalStartMins + durationMinutes;

    const endHour = Math.floor(totalEndMins / 60);
    const endMin = totalEndMins % 60;

    return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  }

  // Generate a queue number based on date and count
  generateQueueNumber() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // transform to YYMMDD
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `${yy}${mm}${dd}`; // e.g., 231025

    // Get today's queues to find the next number
    const todaysQueues = this.store.getQueue().filter(q => q.date === dateStr);
    const count = todaysQueues.length + 1;

    return `Q${prefix}-${String(count).padStart(3, '0')}`;
  }

  // ===================================
  // HELPER METHODS
  // ===================================

  populateCustomerDropdown(selectId = 'pet-customer') {
    const select = document.getElementById(selectId);
    const customers = this.store.getCustomers();

    select.innerHTML = '<option value="">-- เลือกเจ้าของ --</option>';
    customers.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
  }

  populateGroomerDropdown() {
    const select = document.getElementById('queue-groomer');
    const groomers = this.store.getActiveGroomers();

    select.innerHTML = '<option value="">-- เลือกช่าง (ถ้ามี) --</option>';
    groomers.forEach(g => {
      select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
  }

  loadPetsByCustomer() {
    const customerId = document.getElementById('queue-customer').value;
    const petSelect = document.getElementById('queue-pet');

    if (!customerId) {
      petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง --</option>';
      return;
    }

    const pets = this.store.getPetsByCustomer(customerId);
    petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง --</option>';
    pets.forEach(p => {
      const petIcon = this.getPetIcon(p);
      petSelect.innerHTML += `<option value="${p.id}">${petIcon} ${p.name}</option>`;
    });
  }

  // ===================================
  // CALENDAR METHODS
  // ===================================

  renderCalendar(year, month) {
    if (!this.currentDate) {
      this.currentDate = new Date();
    }

    if (year !== undefined && month !== undefined) {
      this.currentDate = new Date(year, month, 1);
    }

    const year_actual = this.currentDate.getFullYear();
    const month_actual = this.currentDate.getMonth();

    // Thai month names
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    // Update header
    document.getElementById('calendar-month-year').textContent =
      `${monthNames[month_actual]} ${year_actual + 543}`;

    // Get first day of month and number of days
    const firstDay = new Date(year_actual, month_actual, 1).getDay();
    const daysInMonth = new Date(year_actual, month_actual + 1, 0).getDate();
    const daysInPrevMonth = new Date(year_actual, month_actual, 0).getDate();

    const calendar = document.getElementById('calendar-container');
    let html = '';

    // Day headers
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    dayNames.forEach(day => {
      html += `<div class="calendar-header">${day}</div>`;
    });

    // Get queue data for the month
    const allQueue = this.store.getQueue();
    const queueByDate = {};
    allQueue.forEach(q => {
      if (q.date) {
        if (!queueByDate[q.date]) {
          queueByDate[q.date] = [];
        }
        queueByDate[q.date].push(q);
      }
    });

    // Days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      html += `<div class="calendar-day other-month">
        <div class="calendar-day-number">${day}</div>
      </div>`;
    }

    // Days of current month
    const today = new Date();
    const isToday = (d) => {
      return d === today.getDate() &&
        month_actual === today.getMonth() &&
        year_actual === today.getFullYear();
    };

    // Get currently selected date
    const selectedDate = this.selectedDashboardDate;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year_actual}-${String(month_actual + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayQueues = queueByDate[dateStr] || [];
      const todayClass = isToday(day) ? 'today' : '';
      const selectedClass = (selectedDate === dateStr) ? 'selected' : '';

      html += `<div class="calendar-day ${todayClass} ${selectedClass} clickable" data-date="${dateStr}">
        <div class="calendar-day-number">${day}</div>`;

      if (dayQueues.length > 0) {
        html += `<div class="calendar-queue-count">${dayQueues.length} คิว</div>`;
        html += '<div class="calendar-queue-indicator">';
        dayQueues.slice(0, 5).forEach(q => {
          html += `<div class="queue-dot ${q.status}"></div>`;
        });
        html += '</div>';
      }

      html += '</div>';
    }

    // Days from next month
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
      html += `<div class="calendar-day other-month">
        <div class="calendar-day-number">${day}</div>
      </div>`;
    }

    calendar.innerHTML = html;

    // Add click event listeners to calendar dates
    const clickableDays = calendar.querySelectorAll('.calendar-day.clickable');
    clickableDays.forEach(dayElement => {
      dayElement.addEventListener('click', (e) => {
        const selectedDate = dayElement.dataset.date;
        if (selectedDate) {
          // Update dashboard
          this.selectedDashboardDate = selectedDate;
          this.renderDashboard(selectedDate);
          // Re-render calendar to show selection
          this.renderCalendar();
        }
      });
    });
  }

  previousMonth() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    this.renderCalendar(year, month - 1);
  }

  nextMonth() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    this.renderCalendar(year, month + 1);
  }

  goToToday() {
    this.currentDate = new Date();
    this.renderCalendar();
  }

  // ===================================
  // QUICK ADD METHODS
  // ===================================

  // Quick add customer from search
  quickAddFromSearch(searchQuery) {
    // Hide search results
    const resultsDiv = document.getElementById('customer-search-results');
    if (resultsDiv) {
      resultsDiv.classList.remove('show');
    }

    // Show quick add form
    this.toggleQuickAddCustomer();

    // Auto-fill name if search query looks like a name
    const nameInput = document.getElementById('quick-customer-name');
    if (nameInput && searchQuery && searchQuery.length > 0) {
      //If search query is numeric, assume it's phone, otherwise name
      if (!/^\d+$/.test(searchQuery)) {
        nameInput.value = searchQuery;
      } else {
        const phoneInput = document.getElementById('quick-customer-phone');
        if (phoneInput) {
          phoneInput.value = searchQuery;
        }
      }
    }
  }

  toggleQuickAddCustomer() {
    const form = document.getElementById('quick-customer-form');
    if (form.classList.contains('hidden')) {
      form.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
    }
  }

  cancelQuickAddCustomer() {
    document.getElementById('quick-customer-form').classList.add('hidden');
    document.getElementById('quick-customer-name').value = '';
    document.getElementById('quick-customer-phone').value = '';
  }

  async saveQuickCustomer() {
    const name = document.getElementById('quick-customer-name').value;
    const socialName = document.getElementById('quick-customer-social-name').value;
    const phone = document.getElementById('quick-customer-phone').value;

    if (!name || !phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }

    const customer = await this.store.addCustomer({
      name,
      socialName,
      phone,
      email: '',
      address: ''
    });

    if (!customer) return;

    // Select the new customer using the new UI logic
    this.selectCustomerFromSearch(customer.id);

    // Hide form and clear
    this.cancelQuickAddCustomer();

    alert(`เพิ่มลูกค้า "${name}" สำเร็จ!`);
  }

  toggleQuickAddPet() {
    const customerId = document.getElementById('queue-customer').value;
    if (!customerId) {
      alert('กรุณาเลือกลูกค้าก่อน');
      return;
    }

    const form = document.getElementById('quick-pet-form');
    if (form.classList.contains('hidden')) {
      form.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
    }
  }

  cancelQuickAddPet() {
    document.getElementById('quick-pet-form').classList.add('hidden');
    document.getElementById('quick-pet-name').value = '';
    document.getElementById('quick-pet-type').value = '';
    document.getElementById('quick-pet-breed').value = '';
  }

  async saveQuickPet() {
    const customerId = document.getElementById('queue-customer').value;
    const name = document.getElementById('quick-pet-name').value;
    const type = document.getElementById('quick-pet-type').value;
    const breed = document.getElementById('quick-pet-breed').value;

    if (!name || !type) {
      alert('กรุณากรอกชื่อสัตว์เลี้ยงและเลือกประเภท');
      return;
    }

    const pet = await this.store.addPet({
      customerId,
      name,
      type,
      breed: breed || '',
      weight: null,
      color: '',
      birthDate: '',
      notes: ''
    });

    if (!pet) return;

    // Update pets dropdown
    this.loadPetsByCustomer();
    document.getElementById('queue-pet').value = pet.id;

    // Hide form and clear
    this.cancelQuickAddPet();

    const petType = type === 'dog' ? 'สุนัข' : 'แมว';
    alert(`เพิ่ม${petType} "${name}" สำเร็จ!`);
  }

  // ===================================
  // WORKFLOW STAGE METHODS
  // ===================================

  // Stage 2: Deposit Modal
  showDepositModal(queueId) {
    this.currentQueueId = queueId;
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-method').value = 'cash';
    this.openModal('modal-deposit');
  }

  async saveDeposit() {
    let amount = parseFloat(document.getElementById('deposit-amount').value);
    const method = document.getElementById('deposit-method').value;

    if (isNaN(amount) || amount < 0) {
      amount = 0;
    }

    await this.store.updateQueue(this.currentQueueId, {
      status: 'deposit',
      depositAmount: amount,
      depositMethod: amount > 0 ? method : null
    });

    this.closeModal('modal-deposit');
    this.renderQueue();
    this.renderDashboard();

    if (amount > 0) {
      alert(`บันทึกมัดจำ ${amount} บาทสำเร็จ!`);
    } else {
      alert(`บันทึกสถานะมัดจำสำเร็จ (ไม่มียอดมัดจำ)`);
    }
  }

  // NEW: Helper for prefill notes
  appendNote(elementId, text) {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    const current = textarea.value.trim();
    textarea.value = current ? current + ', ' + text : text;
  }

  // Stage 3: Check-in Modal
  showCheckInModal(queueId) {
    const queue = this.store.getQueueById(queueId);
    const pet = this.store.getPetById(queue.petId);

    this.currentQueueId = queueId;
    this.currentPet = pet;

    // Pre-fill with existing weight and notes
    document.getElementById('checkin-weight').value = pet.weight || '';
    document.getElementById('checkin-notes').value = queue.notes || '';
    document.getElementById('last-weight-display').textContent =
      pet.weight ? `${pet.weight} กก.` : 'ไม่มีข้อมูล';

    // Pre-select services and addons
    const allServices = queue.serviceType || [];
    const serviceCheckboxes = document.querySelectorAll('input[name="checkin-service-type"]');
    serviceCheckboxes.forEach(cb => {
      cb.checked = allServices.includes(cb.value);
    });

    const addonCheckboxes = document.querySelectorAll('input[name="checkin-service-addon"]');
    addonCheckboxes.forEach(cb => {
      cb.checked = allServices.includes(cb.value);
    });

    this.openModal('modal-checkin');
  }

  addQuickNote(note) {
    const textarea = document.getElementById('checkin-notes');
    const current = textarea.value.trim();
    if (current) {
      textarea.value = `${current}, ${note}`;
    } else {
      textarea.value = note;
    }
  }

  async saveCheckIn() {
    const weight = parseFloat(document.getElementById('checkin-weight').value);
    const notes = document.getElementById('checkin-notes').value;

    if (!weight || weight <= 0) {
      alert('กรุณากรอกน้ำหนักสัตว์เลี้ยง');
      return;
    }

    // Collect selected services (Main + Addons)
    const selectedServices = [];
    document.querySelectorAll('input[name="checkin-service-type"]:checked').forEach(cb => selectedServices.push(cb.value));
    document.querySelectorAll('input[name="checkin-service-addon"]:checked').forEach(cb => selectedServices.push(cb.value));

    // Recalculate duration
    let duration = 60;
    try {
      duration = this.store.calculateServiceDuration(selectedServices);
    } catch (e) {
      console.error('Error calculating duration:', e);
    }

    // Update pet weight
    await this.store.updatePet(this.currentPet.id, { weight });

    // Update queue status, services, duration, and notes
    const updateData = {
      status: 'check-in',
      checkInWeight: weight,
      notes: notes,
      serviceType: selectedServices,
      duration: duration
    };

    // Recalculate estimated end time if we have a start time (appointmentTime)
    const queue = this.store.getQueueById(this.currentQueueId);
    if (queue.appointmentTime) {
      updateData.estimatedEndTime = this.calculateEndTime(queue.appointmentTime, duration);
    }

    await this.store.updateQueue(this.currentQueueId, updateData);

    this.closeModal('modal-checkin');
    this.renderQueue();
    this.renderDashboard();
    alert('เช็คอินสำเร็จ!');
  }

  // Stage 4: Completion Modal
  showCompletionModal(queueId) {
    this.currentQueueId = queueId;
    this.completionImages = [];

    // Clear form
    document.getElementById('completion-groomer').value = '';
    document.getElementById('completion-images').value = '';

    // Pre-fill notes
    const queue = this.store.getQueueById(queueId);
    document.getElementById('completion-notes').value = queue.notes || '';

    document.getElementById('image-preview').innerHTML = '';

    // Populate groomer dropdown
    this.populateGroomerDropdown('completion-groomer');

    this.openModal('modal-completion');
  }

  previewImages(input) {
    const files = input.files;
    const preview = document.getElementById('image-preview');

    if (files.length === 0) return;

    Array.from(files).forEach((file) => {
      // Check if HEIC
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';

      if (isHeic && window.heic2any) {
        console.log('Converting HEIC file...', file.name);
        // Show a temporary loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-preview-item loading';
        loadingDiv.innerHTML = '<div class="spinner"></div><span>Converting...</span>';
        preview.appendChild(loadingDiv);

        heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.7
        })
          .then((conversionResult) => {
            // Remove loading indicator
            if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);

            // conversionResult can be a blob or array of blobs.
            const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            // Create a new File object for consistency if needed, or just pass blob
            this.readAndPreviewImage(blob, preview);
          })
          .catch((e) => {
            console.error('HEIC conversion failed', e);
            if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);

            // Fallback: Try to use the original file
            console.log('Falling back to original file:', file.name);
            alert(`ไม่สามารถแปลงไฟล์ HEIC ได้: ${file.name}\nระบบจะใช้ไฟล์ต้นฉบับแทน (อาจไม่แสดงผลในบางอุปกรณ์)`);
            this.readAndPreviewImage(file, preview);
          });
      } else {
        this.readAndPreviewImage(file, preview);
      }
    });
  }

  async readAndPreviewImage(file, preview) {
    try {
      // Compress image to JPEG (1024px max, 0.7 quality)
      const imgData = await this.resizeImage(file, 1024, 0.7);

      this.completionImages.push({
        id: this.store.generateId(),
        base64: imgData,
        timestamp: new Date().toISOString()
      });

      // Use the current length - 1 as the index, which is correct for the newly added item
      const newIndex = this.completionImages.length - 1;

      const imgDiv = document.createElement('div');
      imgDiv.className = 'image-preview-item';
      imgDiv.innerHTML = `
        <img src="${imgData}" alt="Preview">
        <button class="image-preview-remove" onclick="app.removeCompletionImage(${newIndex}); return false;">✕</button>
      `;
      preview.appendChild(imgDiv);
    } catch (e) {
      console.error('Image resize/read failed', e);
      // If it's a blob from heic2any, name might be missing
      const fileName = file.name || 'ไฟล์ที่ถูกแปลง';
      alert('ไม่สามารถประมวลผลรูปภาพได้: ' + fileName);
    }
  }

  resizeImage(file, maxWidth = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export as compressed JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => {
          console.error('Image loading error:', err);
          reject(new Error('Failed to load image into canvas'));
        };
        img.src = e.target.result;
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  removeCompletionImage(index) {
    this.completionImages.splice(index, 1);

    // Re-render preview
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';

    this.completionImages.forEach((img, idx) => {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'image-preview-item';
      imgDiv.innerHTML = `
        <img src="${img.base64}" alt="Preview ${idx + 1}">
        <button class="image-preview-remove" onclick="app.removeCompletionImage(${idx}); return false;">✕</button>
      `;
      preview.appendChild(imgDiv);
    });
  }

  async saveCompletion() {
    console.log('[DEBUG] saveCompletion started for', this.currentQueueId);
    const groomerId = document.getElementById('completion-groomer').value;
    const notes = document.getElementById('completion-notes').value;

    if (!groomerId) {
      alert('กรุณาเลือกช่างผู้ให้บริการ');
      return;
    }

    if (this.completionImages.length === 0) {
      if (!confirm('ไม่มีรูปภาพตรวจสอบความเรียบร้อย ต้องการดำเนินการต่อหรือไม่?')) {
        return;
      }
    }

    try {
      const result = await this.store.updateQueue(this.currentQueueId, {
        status: 'completed',
        groomerId,
        completionImages: this.completionImages,
        notes: notes || ''
      });

      if (result) {
        console.log('[DEBUG] saveCompletion updateQueue success');
        this.closeModal('modal-completion');
        this.renderQueue();
        this.renderDashboard();
        alert('ปิดงานสำเร็จ!');
      } else {
        console.error('[DEBUG] saveCompletion updateQueue returned null');
        alert('ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่');
      }
    } catch (e) {
      console.error('[DEBUG] saveCompletion error:', e);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + e.message);
    }
  }

  // NEW: Edit Service Modal
  showEditServiceModal(serviceId) {
    const service = this.store.getServiceRecords().find(s => s.id === serviceId);
    if (!service) return;

    this.currentServiceId = serviceId;

    // Populate Groomer Dropdown
    this.populateGroomerDropdown('edit-service-groomer');

    // Basic Fields
    document.getElementById('edit-service-id').value = serviceId;
    document.getElementById('edit-service-date').value = service.date;
    document.getElementById('edit-service-price').value = service.price;
    document.getElementById('edit-service-notes').value = service.notes || '';
    document.getElementById('edit-service-groomer').value = service.groomerId || '';

    // Services (Array to Comma-Separated String)
    let serviceText = '';
    if (Array.isArray(service.servicesPerformed)) {
      serviceText = service.servicesPerformed.join(', ');
    } else if (service.servicesPerformed) {
      serviceText = service.servicesPerformed;
    }
    document.getElementById('edit-service-services').value = serviceText;

    // Time Fields (Extract HH:mm from ISO strings)
    const formatTimeVal = (isoString) => {
      if (!isoString) return '';
      const d = new Date(isoString);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    document.getElementById('edit-service-start-time').value = formatTimeVal(service.checkInAt);
    document.getElementById('edit-service-end-time').value = formatTimeVal(service.completedAt);

    this.openModal('modal-edit-service');
  }

  async saveServiceUpdate() {
    const serviceId = this.currentServiceId;

    // Get values
    const dateVal = document.getElementById('edit-service-date').value;
    const startTimeVal = document.getElementById('edit-service-start-time').value;
    const endTimeVal = document.getElementById('edit-service-end-time').value;
    const groomerId = document.getElementById('edit-service-groomer').value;
    const servicesText = document.getElementById('edit-service-services').value;
    const priceVal = document.getElementById('edit-service-price').value;
    const price = parseFloat(priceVal);
    const notes = document.getElementById('edit-service-notes').value;

    if (!dateVal) {
      alert('กรุณาระบุวันที่');
      return;
    }

    // Reconstruct timestamps helper
    const constructDate = (dateStr, timeStr) => {
      if (!timeStr) return null;
      const d = new Date(`${dateStr}T${timeStr}:00`);
      // Validate Date
      return isNaN(d.getTime()) ? null : d;
    };

    const newCheckInAt = constructDate(dateVal, startTimeVal);
    const newCompletedAt = constructDate(dateVal, endTimeVal);

    // Calculate new duration
    let newDuration = 0;
    if (newCheckInAt && newCompletedAt) {
      const diff = newCompletedAt.getTime() - newCheckInAt.getTime();
      newDuration = Math.round(diff / 60000); // minutes
      if (isNaN(newDuration)) newDuration = 0;
    }

    // Parse services
    const newServices = servicesText.split(',').map(s => s.trim()).filter(s => s !== '');

    const updateData = {
      date: dateVal,
      checkInAt: newCheckInAt ? newCheckInAt.toISOString() : null,
      completedAt: newCompletedAt ? newCompletedAt.toISOString() : null,
      duration: newDuration,
      groomerId: groomerId || null,
      servicesPerformed: newServices,
      price: isNaN(price) ? 0 : price,
      notes: notes
    };

    const result = await this.store.updateServiceRecord(serviceId, updateData);

    if (result) {
      this.closeModal('modal-edit-service');
      // No need to manually call renderServices if listeners are working,
      // but let's keep it for immediate feedback if page match
      this.renderServices();
      alert('แก้ไขข้อมูลสำเร็จ');
    }
  }

  // NEW: Helper for prefill notes
  appendNote(elementId, text) {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    const current = textarea.value.trim();
    textarea.value = current ? current + ', ' + text : text;
  }

  populateGroomerDropdown(selectId = 'queue-groomer') {
    const select = document.getElementById(selectId);
    const groomers = this.store.getActiveGroomers();

    select.innerHTML = '<option value="">-- เลือกช่าง --</option>';
    groomers.forEach(g => {
      select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
  }

  // ===================================
  // SMART SCHEDULING HELPERS
  // ===================================

  // NEW: Update time slot dropdown when date/services change
  updateTimeSlots() {
    const timeSlotInput = document.getElementById('queue-time-slot');
    const timeSlotContainer = document.getElementById('time-slot-buttons');
    const infoText = document.getElementById('time-slot-info');

    const serviceCheckboxes = document.querySelectorAll('input[name="service-type"]:checked');
    const serviceTypes = Array.from(serviceCheckboxes).map(cb => cb.value);

    // Calculate service duration for display (if services selected)
    let durationText = '';
    if (serviceTypes.length > 0) {
      const duration = this.store.calculateServiceDuration(serviceTypes);
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      durationText = hours > 0 ? `${hours}:${String(mins).padStart(2, '0')} ชม.` : `${mins} นาที`;
    }

    // Generate time slot buttons from 9:00 to 19:00 with 30-minute intervals
    let buttonsHTML = '';
    const currentSelectedTime = timeSlotInput.value; // Store current selection

    for (let hour = 9; hour <= 19; hour++) {
      // 00 minutes
      const time00 = `${String(hour).padStart(2, '0')}:00`;
      const selected00 = time00 === currentSelectedTime ? 'selected' : '';
      buttonsHTML += `<button type="button" class="time-slot-button ${selected00}" data-time="${time00}">${time00}</button>`;

      // 30 minutes (only up to 18:30, assuming 19:00 is the last slot)
      if (hour < 19) {
        const time30 = `${String(hour).padStart(2, '0')}:30`;
        const selected30 = time30 === currentSelectedTime ? 'selected' : '';
        buttonsHTML += `<button type="button" class="time-slot-button ${selected30}" data-time="${time30}">${time30}</button>`;
      }
    }

    timeSlotContainer.innerHTML = buttonsHTML;

    // Add click event listeners to buttons
    const buttons = timeSlotContainer.querySelectorAll('.time-slot-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove selected class from all buttons
        buttons.forEach(btn => btn.classList.remove('selected'));
        // Add selected class to clicked button
        button.classList.add('selected');
        // Update hidden input value
        timeSlotInput.value = button.dataset.time;
      });
    });

    // Update info text
    if (durationText) {
      infoText.textContent = `เลือกเวลาเริ่มบริการ (ใช้เวลา ${durationText})`;
    } else {
      infoText.textContent = 'เลือกเวลาเริ่มบริการ';
    }
    infoText.style.color = 'var(--text-gray)';
  }

  // NEW: Format date to Thai format
  formatDate(dateStr) {
    if (!dateStr) return '-';

    const date = new Date(dateStr + 'T00:00:00');
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;

    return `${day} ${month} ${year}`;
  }

  // NEW: Setup event listeners for queue modal
  setupQueueModalListeners() {
    // Listen for date change
    const dateInput = document.getElementById('queue-date');
    if (dateInput) {
      dateInput.addEventListener('change', () => this.updateTimeSlots());
    }

    // Listen for service checkbox changes
    const serviceCheckboxes = document.querySelectorAll('input[name="service-type"]');
    serviceCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateTimeSlots());
    });
  }

  // Initialize modal with default values
  initializeQueueModal() {
    // Set default date to today (using local timezone)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    const dateInput = document.getElementById('queue-date');
    if (dateInput) {
      dateInput.value = todayString;
      dateInput.min = todayString; // Can't book in the past
    }

    // Clear time slots
    const timeSlotSelect = document.getElementById('queue-time-slot');
    if (timeSlotSelect) {
      timeSlotSelect.innerHTML = '<option value="">-- เลือกบริการก่อน --</option>';
    }

    // Setup listeners if not already setup
    if (!this.queueModalListenersSetup) {
      this.setupQueueModalListeners();
      this.queueModalListenersSetup = true;
    }

    // Update time slots in case services are already selected
    this.updateTimeSlots();
  }

  // Helper: Get today's date string in YYYY-MM-DD format
  getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Setup dashboard date filter
  setupDashboardDateFilter() {
    const dateFilter = document.getElementById('dashboard-date-filter');
    if (dateFilter) {
      // Set default to today
      dateFilter.value = this.getTodayString();

      // Listen for date changes
      dateFilter.addEventListener('change', (e) => {
        this.selectedDashboardDate = e.target.value;
        this.renderDashboard(this.selectedDashboardDate);
      });
    }
  }

  // Toggle sidebar for mobile
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  }

  // Logout
  logout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
  }

  // Set dashboard to today
  setDashboardToday() {
    this.selectedDashboardDate = null;
    this.renderDashboard();
    this.renderCalendar();
  }

  // ===================================
  // DEBUG MODE & LOGS
  // ===================================

  handleVersionClick() {
    const now = Date.now();
    if (now - this.lastDebugClick > 1000) {
      this.debugClicks = 0;
    }
    this.debugClicks++;
    this.lastDebugClick = now;

    if (this.debugClicks >= 5) {
      this.debugClicks = 0;
      this.openDebugModal();
    }
  }

  openDebugModal() {
    this.isDebugModalOpen = true;
    const modal = document.getElementById('modal-debug');
    if (modal) {
      modal.classList.add('active');
      this.renderLogs('all');
    }
  }

  closeDebugModal() {
    this.isDebugModalOpen = false;
    const modal = document.getElementById('modal-debug');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  filterLogs(category, element) {
    this.debugCategory = category;

    // Update active tab UI
    document.querySelectorAll('.debug-tab').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');

    this.renderLogs(category);
  }

  renderLogs(category) {
    const container = document.getElementById('debug-log-container');
    if (!container) return;

    const logs = window.logger.getLogs(category);
    container.innerHTML = logs.map(log => this.createLogHtml(log)).join('');
  }

  appendLogToUI(log) {
    const container = document.getElementById('debug-log-container');
    if (!container) return;

    const logHtml = this.createLogHtml(log);
    container.insertAdjacentHTML('afterbegin', logHtml);
  }

  createLogHtml(log) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    return `
      <div class="log-entry ${log.type}">
        <span class="log-time">[${time}]</span>
        <span class="log-message">${this.escapeHtml(log.message)}</span>
      </div>
    `;
  }

  clearLogs() {
    if (confirm('ยืนยันหน้าการล้าง Log ทั้งหมด?')) {
      window.logger.clear();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ===================================
// INITIALIZE APPLICATION
// ===================================

const app = new PetGroomingApp();
