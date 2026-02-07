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
      settings: this.getDefaultSettings()
    };

    // Initial data load
    this.initRealtimeListeners();
  }

  getDefaultSettings() {
    return {
      shopName: 'QueSanrue Grooming',
      queueNumberPrefix: 'Q',
      serviceTypes: ['อาบน้ำ', 'ตัดขน', 'ตัดเล็บ', 'ทำสปา', 'ดูแลพิเศษ'],
      priceList: {
        'อาบน้ำ': 200,
        'ตัดขน': 300,
        'ตัดเล็บ': 100,
        'ทำสปา': 500,
        'ดูแลพิเศษ': 400
      },
      serviceDurations: {
        'อาบน้ำ': 60,
        'ตัดขน': 90,
        'ตัดเล็บ': 30,
        'ทำสปา': 45,
        'ดูแลพิเศษ': 60,
        'อาบน้ำ,ตัดขน': 120,
        'อาบน้ำ,ตัดขน,ตัดเล็บ': 150,
        'อาบน้ำ,ทำสปา': 120,
        'อาบน้ำ,ตัดขน,ทำสปา': 180
      },
      defaultWorkingHours: {
        start: '09:00',
        end: '18:00'
      }
    };
  }

  // Initialize real-time listeners
  initRealtimeListeners() {
    if (!this.db) {
      console.warn('Firestore not initialized, falling back to empty state');
      return;
    }

    const collections = ['customers', 'pets', 'groomers', 'queue', 'serviceRecords', 'dailySchedules'];

    collections.forEach(col => {
      this.db.collection(col).onSnapshot(snapshot => {
        this.data[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Trigger UI update if app is initialized
        if (window.app) {
          // We need to debounce or selectively update to avoid loops
          // For simplicity, we just trigger render if appropriate
          if (window.app.currentPage === 'dashboard') window.app.renderDashboard();
          if (window.app.currentPage === 'queue') window.app.renderQueue();
          if (window.app.currentPage === 'customers') window.app.renderCustomers();
          if (window.app.currentPage === 'pets') window.app.renderPets();
          if (window.app.currentPage === 'groomers') window.app.renderGroomers();
        }
      }, error => {
        console.error(`Error listening to ${col}:`, error);
        if (error.code === 'permission-denied' && !window.hasShownPermissionError) {
          alert('⚠️ ไม่สามารถเข้าถึงข้อมูลได้ (Permission Denied)\nกรุณาตั้งค่า Firestore Rules ใน Firebase Console ให้เปิดใช้งาน (Allow read/write)');
          window.hasShownPermissionError = true;
        }
      });
    });
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
      return { id: docRef.id, ...newCustomer };
    } catch (e) {
      console.error("Error adding customer: ", e);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + e.message);
      return null;
    }
  }

  async updateCustomer(id, updates) {
    try {
      await this.db.collection('customers').doc(id).update(updates);
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
    } catch (e) {
      console.error("Error deleting customer: ", e);
      alert('ลบข้อมูลไม่สำเร็จ');
    }
  }

  // Helper for generating ID (not needed for Firestore but keeping for compat if needed elsewhere)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
      return { id: docRef.id, ...newPet };
    } catch (e) {
      console.error("Error adding pet: ", e);
      alert('บันทึกข้อมูลสัตว์เลี้ยงไม่สำเร็จ');
      return null;
    }
  }

  async updatePet(id, updates) {
    try {
      await this.db.collection('pets').doc(id).update(updates);
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
      return { id: docRef.id, ...newGroomer };
    } catch (e) {
      console.error("Error adding groomer: ", e);
      alert('บันทึกข้อมูลช่างไม่สำเร็จ');
      return null;
    }
  }

  async updateGroomer(id, updates) {
    try {
      await this.db.collection('groomers').doc(id).update(updates);
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
      return { id: docRef.id, ...newQueue };
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

    try {
      await this.db.collection('queue').doc(id).update(finalUpdates);
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

  // Service Record operations
  createServiceRecord(queue) {
    // Calculate duration from check-in to completion
    const checkInTime = queue.checkInAt ? new Date(queue.checkInAt) : new Date();
    const endTime = queue.completedAt ? new Date(queue.completedAt) : new Date();
    const duration = Math.round((endTime - checkInTime) / 60000); // minutes

    const serviceRecord = {
      id: this.generateId(),
      queueId: queue.id,
      customerId: queue.customerId,
      petId: queue.petId,
      groomerId: queue.groomerId || null,
      date: queue.date,
      servicesPerformed: queue.serviceType,

      // Workflow timestamps
      bookingAt: queue.bookingAt,
      depositAt: queue.depositAt,
      checkInAt: queue.checkInAt,
      completedAt: queue.completedAt,
      duration,

      // Check-in data
      checkInWeight: queue.checkInWeight,
      checkInNotes: queue.checkInNotes || '',

      // Completion data
      completionImages: queue.completionImages || [],

      price: this.calculatePrice(queue.serviceType),
      notes: queue.notes || '',
      createdAt: new Date().toISOString()
    };

    this.data.serviceRecords.push(serviceRecord);
    this.saveData();
    return serviceRecord;
  }

  calculatePrice(services) {
    let total = 0;
    services.forEach(service => {
      total += this.data.settings.priceList[service] || 0;
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
}

// ===================================
// APPLICATION CLASS
// ===================================

class PetGroomingApp {
  constructor() {
    this.store = new DataStore();
    this.currentPage = 'dashboard';
    this.selectedDashboardDate = null; // null = today
    this.init();
  }

  init() {
    this.checkAuth();
    this.setupNavigation();
    this.setupSearchFilters();
    this.setupPetModalListeners();
    this.renderDashboard();
    this.renderDashboard();
    this.renderDashboard();
    // Auto-load sample data if empty (with safety check inside)
    this.loadSampleData();
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

  // Navigation
  setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page === page) {
        link.classList.add('active');
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
    // Use selected date or today
    const selectedDate = date || this.selectedDashboardDate || this.getTodayString();
    const queueForDate = this.store.getQueueByDate(selectedDate);
    const waitingQueue = queueForDate.filter(q => q.status === 'waiting' || q.status === 'booking' || q.status === 'deposit' || q.status === 'check-in');
    const completedQueue = queueForDate.filter(q => q.status === 'completed');
    const totalCustomers = this.store.getCustomers().length;

    // Update stats
    document.getElementById('stat-queue-today').textContent = queueForDate.length;
    document.getElementById('stat-queue-waiting').textContent = waitingQueue.length;
    document.getElementById('stat-queue-completed').textContent = completedQueue.length;
    document.getElementById('stat-total-customers').textContent = totalCustomers;

    // Render calendar
    this.renderCalendar();

    // Render queue for selected date
    const queueList = document.getElementById('dashboard-queue-list');
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

    const queueList = document.getElementById('queue-list');
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

  createQueueCard(queue) {
    const customer = this.store.getCustomerById(queue.customerId);
    const pet = this.store.getPetById(queue.petId);
    // NEW: Use assignedGroomerId for pre-assigned groomer
    const groomer = queue.assignedGroomerId ? this.store.getGroomerById(queue.assignedGroomerId) :
      (queue.groomerId ? this.store.getGroomerById(queue.groomerId) : null);

    // NEW: 4-stage workflow status map
    const statusMap = {
      'booking': '📝 จองคิว',
      'deposit': '💰 มัดจำ',
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
        <div class="queue-number">#${queue.queueNumber}</div>
        <div class="queue-customer">${customer?.name || 'ไม่ระบุ'}</div>
        <div class="queue-pet">
          🐾 ${pet?.name || 'ไม่ระบุ'} 
          <span class="badge ${pet?.type === 'dog' ? 'badge-dog' : 'badge-cat'}">${pet?.type === 'dog' ? 'สุนัข' : 'แมว'}</span>
        </div>
        <div class="queue-details">
          ${queue.appointmentTime ? `<div>📅 ${this.formatDate(queue.date)} 🕐 ${queue.appointmentTime}${queue.estimatedEndTime ? ` - ${queue.estimatedEndTime}` : ''}</div>` : `<div>📅 ${this.formatDate(queue.date)}</div>`}
          <div>บริการ: ${queue.serviceType.join(', ')}${queue.duration ? ` (${queue.duration} นาที)` : ''}</div>
          ${groomer ? `<div>ช่าง: ${groomer.name}</div>` : ''}
          ${queue.checkInWeight ? `<div>น้ำหนัก: ${queue.checkInWeight} กก.</div>` : ''}
          ${queue.priority ? '<div style="color: var(--error); font-weight: 600;">⚡ คิวด่วน</div>' : ''}
          <div>สถานะ: <span class="badge ${statusBadgeMap[queue.status]}">${statusMap[queue.status]}</span></div>
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
        const pets = this.store.getPetsByCustomer(c.id);
        return `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td>${pets.length} ตัว</td>
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
        const experienceMap = {
          'junior': 'มือใหม่',
          'senior': 'มีประสบการณ์',
          'expert': 'ผู้เชี่ยวชาญ'
        };

        const specialtyText = g.specialty.map(s => {
          if (s === 'dog') return 'สุนัข';
          if (s === 'cat') return 'แมว';
          if (s === 'both') return 'ทั้งสองอย่าง';
          return s;
        }).join(', ');

        return `
          <tr>
            <td><strong>${g.name}</strong></td>
            <td>${g.phone}</td>
            <td>${specialtyText}</td>
            <td>${experienceMap[g.experienceLevel] || g.experienceLevel}</td>
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
    let services = this.store.getServiceRecords();

    if (searchTerm) {
      services = services.filter(s => {
        const customer = this.store.getCustomerById(s.customerId);
        const pet = this.store.getPetById(s.petId);
        const groomer = s.groomerId ? this.store.getGroomerById(s.groomerId) : null;
        return customer?.name.toLowerCase().includes(searchTerm) ||
          pet?.name.toLowerCase().includes(searchTerm) ||
          groomer?.name.toLowerCase().includes(searchTerm);
      });
    }

    const tbody = document.getElementById('services-tbody');
    if (services.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-gray);">
            ไม่พบบันทึกบริการ
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = services.map(s => {
        const customer = this.store.getCustomerById(s.customerId);
        const pet = this.store.getPetById(s.petId);
        const groomer = s.groomerId ? this.store.getGroomerById(s.groomerId) : null;

        return `
          <tr>
            <td>${s.date}</td>
            <td>${customer?.name || 'ไม่ระบุ'}</td>
            <td>${pet?.name || 'ไม่ระบุ'}</td>
            <td>${groomer?.name || '-'}</td>
            <td>${s.servicesPerformed.join(', ')}</td>
            <td>${s.duration} นาที</td>
            <td><strong>${s.price} บาท</strong></td>
          </tr>
        `;
      }).join('');
    }
  }

  // ===================================
  // MODAL OPERATIONS
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
    document.getElementById('form-queue').reset();
    this.populateCustomerDropdown('queue-customer');
    this.populateGroomerDropdown();

    // NEW: Initialize smart scheduling
    this.initializeQueueModal();

    // Setup customer search
    this.setupCustomerSearch();

    this.openModal('modal-queue');
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

    // Set customer dropdown value
    customerSelect.value = customerId;

    // Trigger change event to load pets
    customerSelect.dispatchEvent(new Event('change'));

    // Get customer name for display
    const customer = this.store.getCustomers().find(c => c.id === customerId);
    if (customer) {
      searchInput.value = `${customer.name} - ${customer.phone}`;
    }

    // Hide results
    resultsDiv.classList.remove('show');
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
      phone: document.getElementById('groomer-phone').value,
      email: document.getElementById('groomer-email').value,
      specialty: selectedSpecialties.length > 0 ? selectedSpecialties : ['both'],
      experienceLevel: document.getElementById('groomer-experience').value,
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
    document.getElementById('groomer-phone').value = groomer.phone;
    document.getElementById('groomer-email').value = groomer.email || '';

    // Set specialty multi-select
    const specialtySelect = document.getElementById('groomer-specialty');
    Array.from(specialtySelect.options).forEach(option => {
      option.selected = groomer.specialty.includes(option.value);
    });

    document.getElementById('groomer-experience').value = groomer.experienceLevel;
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

  async saveQueue() {
    const customerId = document.getElementById('queue-customer').value;
    const petId = document.getElementById('queue-pet').value;
    const groomerId = document.getElementById('queue-groomer').value;

    const serviceCheckboxes = document.querySelectorAll('input[name="service-type"]:checked');
    const serviceTypes = Array.from(serviceCheckboxes).map(cb => cb.value);

    // NEW: Get date and time selection
    const selectedDate = document.getElementById('queue-date').value;
    const selectedTimeSlot = document.getElementById('queue-time-slot').value;

    // Use manually selected groomer if any
    let assignedGroomerId = groomerId || null;

    const queueData = {
      customerId,
      petId,
      date: selectedDate,
      appointmentTime: selectedTimeSlot,
      assignedGroomerId,
      serviceType: serviceTypes,
      priority: document.getElementById('queue-priority').checked,
      notes: document.getElementById('queue-notes').value
    };

    if (!customerId || !petId || serviceTypes.length === 0) {
      alert('กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }

    if (!selectedDate) {
      alert('กรุณาเลือกวันที่นัดหมาย');
      return;
    }

    const queue = await this.store.addQueue(queueData);
    if (!queue) return;

    // Calculate duration display
    const duration = queue.duration;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationText = hours > 0
      ? (mins > 0 ? `${hours}:${String(mins).padStart(2, '0')} ชม.` : `${hours} ชม.`)
      : `${mins} นาที`;

    // Show confirmation with appointment details
    const groomer = assignedGroomerId ? this.store.getGroomerById(assignedGroomerId) : null;
    const servicesText = serviceTypes.join(', ');

    let confirmMsg = `เพิ่มคิว #${queue.queueNumber} สำเร็จ!\n`;
    confirmMsg += `วันที่: ${this.formatDate(selectedDate)}\n`;
    if (selectedTimeSlot && queue.estimatedEndTime) {
      confirmMsg += `${servicesText} ${durationText}\n`;
      confirmMsg += `คิว ${selectedTimeSlot}-${queue.estimatedEndTime}\n`;
    } else {
      confirmMsg += `บริการ: ${servicesText}\n`;
    }
    if (groomer) {
      confirmMsg += `ช่าง: ${groomer.name}`;
    }

    alert(confirmMsg);

    this.closeModal('modal-queue');
    this.renderQueue();
    this.renderDashboard();
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
      const petType = p.type === 'dog' ? '🐕' : '🐱';
      petSelect.innerHTML += `<option value="${p.id}">${petType} ${p.name}</option>`;
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

    // Update dropdown
    this.populateCustomerDropdown('queue-customer');
    document.getElementById('queue-customer').value = customer.id;

    // Clear pets dropdown since new customer selected
    this.loadPetsByCustomer();

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
  }

  async saveQuickPet() {
    const customerId = document.getElementById('queue-customer').value;
    const name = document.getElementById('quick-pet-name').value;
    const type = document.getElementById('quick-pet-type').value;

    if (!name || !type) {
      alert('กรุณากรอกชื่อสัตว์เลี้ยงและเลือกประเภท');
      return;
    }

    const pet = await this.store.addPet({
      customerId,
      name,
      type,
      breed: '',
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
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const method = document.getElementById('deposit-method').value;

    if (!amount || amount <= 0) {
      alert('กรุณากรอกยอดมัดจำ');
      return;
    }

    await this.store.updateQueue(this.currentQueueId, {
      status: 'deposit',
      depositAmount: amount,
      depositMethod: method
    });

    this.closeModal('modal-deposit');
    this.renderQueue();
    this.renderDashboard();
    alert(`บันทึกมัดจำ ${amount} บาทสำเร็จ!`);
  }

  // Stage 3: Check-in Modal
  showCheckInModal(queueId) {
    const queue = this.store.getQueueById(queueId);
    const pet = this.store.getPetById(queue.petId);

    this.currentQueueId = queueId;
    this.currentPet = pet;

    // Pre-fill with existing weight
    document.getElementById('checkin-weight').value = pet.weight || '';
    document.getElementById('checkin-notes').value = '';
    document.getElementById('last-weight-display').textContent =
      pet.weight ? `${pet.weight} กก.` : 'ไม่มีข้อมูล';

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

    // Update pet weight
    await this.store.updatePet(this.currentPet.id, { weight });

    // Update queue status
    await this.store.updateQueue(this.currentQueueId, {
      status: 'check-in',
      checkInWeight: weight,
      checkInNotes: notes
    });

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
    document.getElementById('completion-notes').value = '';
    document.getElementById('image-preview').innerHTML = '';

    // Populate groomer dropdown
    this.populateGroomerDropdown('completion-groomer');

    this.openModal('modal-completion');
  }

  previewImages(input) {
    const files = input.files;
    const preview = document.getElementById('image-preview');

    if (files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgData = e.target.result;
        this.completionImages.push({
          id: this.store.generateId(),
          base64: imgData,
          timestamp: new Date().toISOString()
        });

        const imgDiv = document.createElement('div');
        imgDiv.className = 'image-preview-item';
        imgDiv.innerHTML = `
          <img src="${imgData}" alt="Preview ${index + 1}">
          <button class="image-preview-remove" onclick="app.removeCompletionImage(${this.completionImages.length - 1}); return false;">✕</button>
        `;
        preview.appendChild(imgDiv);
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

    await this.store.updateQueue(this.currentQueueId, {
      status: 'completed',
      groomerId,
      completionImages: this.completionImages,
      notes: notes || ''
    });

    this.closeModal('modal-completion');
    this.renderQueue();
    this.renderDashboard();
    alert('ปิดงานสำเร็จ!');
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

    // Generate time slot buttons from 9:00 to 19:00 (always show)
    let buttonsHTML = '';
    for (let hour = 9; hour <= 19; hour++) {
      const time = `${String(hour).padStart(2, '0')}:00`;
      buttonsHTML += `<button type="button" class="time-slot-button" data-time="${time}">${time}</button>`;
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
}

// ===================================
// INITIALIZE APPLICATION
// ===================================

const app = new PetGroomingApp();
