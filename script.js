/**
 * TaskFlow - Aplikasi Manajemen Tugas
 * JavaScript utama dengan fitur lengkap:
 * - CRUD Tugas
 * - Subtasks & Progress
 * - Deadline & Notifikasi
 * - Kalender Interaktif
 * - Filter & Sorting
 * - LocalStorage
 */

// ==========================================
// DATA & STATE MANAGEMENT
// ==========================================

// Data hari libur nasional Indonesia 2025 (statis)
const INDONESIAN_HOLIDAYS_2025 = [
    '2025-01-01', // Tahun Baru
    '2025-01-27', // Isra Mi'raj
    '2025-01-29', // Imlek
    '2025-03-29', // Nyepi
    '2025-03-31', // Idul Fitri
    '2025-04-01', // Idul Fitri
    '2025-04-18', // Wafat Isa Almasih
    '2025-04-20', // Paskah
    '2025-05-01', // Hari Buruh
    '2025-05-12', // Waisak
    '2025-05-29', // Kenaikan Isa Almasih
    '2025-06-01', // Hari Pancasila
    '2025-06-06', // Idul Adha
    '2025-06-27', // Tahun Baru Islam
    '2025-08-17', // Hari Kemerdekaan
    '2025-09-05', // Maulid Nabi
    '2025-12-25', // Natal
];

// State aplikasi
let tasks = [];
let currentFilter = 'all';
let currentPriorityFilter = 'all';
let currentDate = new Date();
let selectedDate = null;
let editingTaskId = null;
let notificationPermission = false;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Generate ID unik
 */
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/**
 * Format tanggal untuk display
 */
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('id-ID', options);
};

/**
 * Format tanggal untuk input datetime-local
 */
const formatDateTimeLocal = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

/**
 * Cek apakah tanggal adalah hari libur
 */
const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return INDONESIAN_HOLIDAYS_2025.includes(dateStr);
};

/**
 * Cek apakah tanggal adalah akhir pekan
 */
const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Minggu = 0, Sabtu = 6
};

/**
 * Cek status deadline
 * @returns {string} 'normal', 'urgent' (< 24 jam), 'overdue'
 */
const getDeadlineStatus = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'overdue';
    if (diffHours < 24) return 'urgent';
    return 'normal';
};

/**
 * Hitung progress subtasks
 */
const calculateProgress = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return 0;
    const completed = subtasks.filter(st => st.completed).length;
    return Math.round((completed / subtasks.length) * 100);
};

// ==========================================
// LOCAL STORAGE
// ==========================================

const saveTasks = () => {
    localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
};

const loadTasks = () => {
    const saved = localStorage.getItem('taskflow_tasks');
    if (saved) {
        tasks = JSON.parse(saved);
    }
};

// ==========================================
// NOTIFICATION API
// ==========================================

/**
 * Minta izin notifikasi
 */
const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        showToast('Browser tidak mendukung notifikasi');
        return false;
    }
    
    try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
        
        if (notificationPermission) {
            showToast('Notifikasi diaktifkan!');
            document.getElementById('notificationBadge').classList.add('active');
        } else {
            showToast('Izin notifikasi ditolak');
        }
        
        return notificationPermission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
};

/**
 * Kirim notifikasi
 */
const sendNotification = (title, body) => {
    if (notificationPermission && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/2098/2098402.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/2098/2098402.png',
            tag: 'taskflow-notification'
        });
    }
};

/**
 * Cek dan kirim notifikasi deadline
 */
const checkDeadlineNotifications = () => {
    const now = new Date();
    
    tasks.forEach(task => {
        if (task.completed) return;
        
        const deadline = new Date(task.deadline);
        const diffHours = (deadline - now) / (1000 * 60 * 60);
        const diffMinutes = (deadline - now) / (1000 * 60);
        
        // Notifikasi 1 jam sebelum deadline
        if (diffHours <= 1 && diffHours > 0 && !task.notifiedOneHour) {
            sendNotification(
                '⏰ Deadline Mendekat!',
                `Tugas "${task.title}" akan berakhir dalam 1 jam`
            );
            task.notifiedOneHour = true;
            saveTasks();
        }
        
        // Notifikasi saat deadline terlewat
        if (diffMinutes <= 0 && diffMinutes > -5 && !task.notifiedOverdue) {
            sendNotification(
                '⚠️ Deadline Terlewat!',
                `Tugas "${task.title}" sudah melewati deadline`
            );
            task.notifiedOverdue = true;
            saveTasks();
        }
    });
};

// ==========================================
// UI RENDERING
// ==========================================

/**
 * Render statistik
 */
const renderStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => {
        if (t.completed) return false;
        return getDeadlineStatus(t.deadline) === 'overdue';
    }).length;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('overdueTasks').textContent = overdue;
};

/**
 * Render kalender
 */
const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update header
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // Header hari
    const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Hitung hari
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const totalDaysPrevMonth = prevLastDay.getDate();
    
    // Hari bulan sebelumnya
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="calendar-day-number">${totalDaysPrevMonth - i}</span>`;
        grid.appendChild(dayDiv);
    }
    
    // Hari bulan ini
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        // Cek weekend
        if (isWeekend(date)) {
            dayDiv.classList.add('weekend');
        }
        
        // Cek hari libur
        if (isHoliday(date)) {
            dayDiv.classList.add('holiday');
        }
        
        // Cek hari ini
        if (date.toDateString() === today.toDateString()) {
            dayDiv.classList.add('today');
        }
        
        // Cek ada tugas
        const hasTask = tasks.some(task => {
            const taskDate = new Date(task.deadline).toISOString().split('T')[0];
            return taskDate === dateStr;
        });
        
        if (hasTask) {
            dayDiv.classList.add('has-task');
        }
        
        // Cek selected
        if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
            dayDiv.classList.add('selected');
        }
        
        dayDiv.innerHTML = `<span class="calendar-day-number">${day}</span>`;
        
        // Click handler
        dayDiv.addEventListener('click', () => {
            selectedDate = date;
            renderCalendar();
            showDayTasks(date);
        });
        
        grid.appendChild(dayDiv);
    }
    
    // Hari bulan berikutnya
    const remainingCells = 42 - (startDayOfWeek + totalDays);
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="calendar-day-number">${i}</span>`;
        grid.appendChild(dayDiv);
    }
};

/**
 * Render daftar tugas
 */
const renderTasks = () => {
    const container = document.getElementById('tasksContainer');
    const emptyState = document.getElementById('emptyState');
    
    // Filter tasks
    let filteredTasks = tasks.filter(task => {
        // Filter status
        if (currentFilter === 'completed' && !task.completed) return false;
        if (currentFilter === 'pending' && task.completed) return false;
        
        // Filter prioritas
        if (currentPriorityFilter !== 'all' && task.priority !== currentPriorityFilter) return false;
        
        return true;
    });
    
    // Sort by priority (High -> Medium -> Low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => {
        // Completed tasks di akhir
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        // Sort by priority
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    container.innerHTML = '';
    
    if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    filteredTasks.forEach(task => {
        const taskCard = createTaskCard(task);
        container.appendChild(taskCard);
    });
};

/**
 * Create task card element
 */
const createTaskCard = (task) => {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    card.dataset.id = task.id;
    
    const deadlineStatus = getDeadlineStatus(task.deadline);
    const progress = calculateProgress(task.subtasks);
    
    let deadlineClass = 'task-deadline';
    let deadlineIcon = 'fa-clock';
    
    if (deadlineStatus === 'urgent') {
        deadlineClass += ' urgent';
        deadlineIcon = 'fa-exclamation-circle';
    } else if (deadlineStatus === 'overdue') {
        deadlineClass += ' overdue';
        deadlineIcon = 'fa-exclamation-triangle';
    }
    
    const categoryLabels = {
        work: 'Pekerjaan',
        personal: 'Pribadi',
        study: 'Belajar',
        other: 'Lainnya'
    };
    
    card.innerHTML = `
        <div class="task-header">
            <div class="task-main">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task.id}')">
                    ${task.completed ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        <span class="task-badge priority-${task.priority}">${task.priority}</span>
                        <span class="task-badge category">${categoryLabels[task.category]}</span>
                        <span class="${deadlineClass}">
                            <i class="fas ${deadlineIcon}"></i>
                            ${formatDate(task.deadline)}
                        </span>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button class="task-btn" onclick="editTask('${task.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="task-btn delete" onclick="deleteTask('${task.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        
        ${task.subtasks && task.subtasks.length > 0 ? `
            <div class="task-progress">
                <div class="progress-header">
                    <span class="progress-label">Progress Subtasks</span>
                    <span class="progress-value">${progress}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="subtasks-list">
                    ${task.subtasks.map((st, idx) => `
                        <div class="subtask-item ${st.completed ? 'completed' : ''}">
                            <div class="subtask-checkbox ${st.completed ? 'checked' : ''}" 
                                 onclick="toggleSubtask('${task.id}', ${idx})">
                                ${st.completed ? '<i class="fas fa-check"></i>' : ''}
                            </div>
                            <span>${escapeHtml(st.title)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
    
    return card;
};

/**
 * Escape HTML untuk keamanan
 */
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Show tasks for specific day
 */
const showDayTasks = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayTasks = tasks.filter(task => {
        const taskDate = new Date(task.deadline).toISOString().split('T')[0];
        return taskDate === dateStr;
    });
    
    const modal = document.getElementById('dayTasksModal');
    const title = document.getElementById('dayTasksTitle');
    const list = document.getElementById('dayTasksList');
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    title.textContent = `Tugas - ${date.toLocaleDateString('id-ID', options)}`;
    
    if (dayTasks.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada tugas di hari ini</p>';
    } else {
        list.innerHTML = dayTasks.map(task => `
            <div class="day-task-item">
                <div class="day-task-priority ${task.priority}"></div>
                <div>
                    <div style="font-weight: 600; ${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                        ${escapeHtml(task.title)}
                    </div>
                    <small style="color: var(--text-muted);">
                        ${formatDate(task.deadline)}
                    </small>
                </div>
            </div>
        `).join('');
    }
    
    modal.classList.add('active');
};

/**
 * Show toast notification
 */
const showToast = (message) => {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
};

// ==========================================
// TASK CRUD OPERATIONS
// ==========================================

/**
 * Tambah tugas baru
 */
const addTask = (e) => {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    const category = document.getElementById('taskCategory').value;
    
    // Ambil subtasks
    const subtaskInputs = document.querySelectorAll('.subtask-input');
    const subtasks = Array.from(subtaskInputs)
        .map(input => input.value.trim())
        .filter(value => value !== '')
        .map(title => ({ title, completed: false }));
    
    const newTask = {
        id: generateId(),
        title,
        priority,
        deadline,
        category,
        completed: false,
        subtasks,
        createdAt: new Date().toISOString(),
        notifiedOneHour: false,
        notifiedOverdue: false
    };
    
    tasks.push(newTask);
    saveTasks();
    
    // Reset form
    document.getElementById('taskForm').reset();
    document.getElementById('subtaskContainer').innerHTML = `
        <div class="subtask-input-group">
            <input type="text" class="subtask-input" placeholder="Subtask 1">
            <button type="button" class="btn-remove-subtask"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Set default deadline (24 jam dari sekarang)
    setDefaultDeadline();
    
    renderTasks();
    renderCalendar();
    renderStats();
    showToast('Tugas berhasil ditambahkan!');
};

/**
 * Toggle task completion
 */
const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        renderStats();
        
        if (task.completed) {
            showToast('Tugas selesai! 🎉');
        }
    }
};

/**
 * Toggle subtask completion
 */
const toggleSubtask = (taskId, subtaskIndex) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.subtasks[subtaskIndex]) {
        task.subtasks[subtaskIndex].completed = !task.subtasks[subtaskIndex].completed;
        saveTasks();
        renderTasks();
    }
};

/**
 * Delete task
 */
const deleteTask = (id) => {
    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    if (card) {
        card.classList.add('deleting');
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
            renderCalendar();
            renderStats();
            showToast('Tugas dihapus');
        }, 300);
    }
};

/**
 * Edit task
 */
const editTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    editingTaskId = id;
    
    document.getElementById('editTaskId').value = id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskDeadline').value = formatDateTimeLocal(task.deadline);
    
    // Render subtasks di modal
    const container = document.getElementById('editSubtaskContainer');
    container.innerHTML = task.subtasks.map((st, idx) => `
        <div class="subtask-input-group">
            <input type="text" class="subtask-input" value="${escapeHtml(st.title)}" placeholder="Subtask ${idx + 1}">
            <button type="button" class="btn-remove-subtask"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    
    document.getElementById('editModal').classList.add('active');
};

/**
 * Update task
 */
const updateTask = (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editTaskId').value;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    task.title = document.getElementById('editTaskTitle').value.trim();
    task.priority = document.getElementById('editTaskPriority').value;
    task.deadline = document.getElementById('editTaskDeadline').value;
    
    // Update subtasks
    const subtaskInputs = document.querySelectorAll('#editSubtaskContainer .subtask-input');
    const newSubtasks = Array.from(subtaskInputs)
        .map(input => input.value.trim())
        .filter(value => value !== '');
    
    // Pertahankan status completed untuk subtasks yang sudah ada
    task.subtasks = newSubtasks.map((title, idx) => ({
        title,
        completed: task.subtasks[idx] ? task.subtasks[idx].completed : false
    }));
    
    saveTasks();
    renderTasks();
    renderCalendar();
    closeEditModal();
    showToast('Tugas diperbarui!');
};

/**
 * Close edit modal
 */
const closeEditModal = () => {
    document.getElementById('editModal').classList.remove('active');
    editingTaskId = null;
};

// ==========================================
// EVENT HANDLERS
// ==========================================

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
    // Form submit
    document.getElementById('taskForm').addEventListener('submit', addTask);
    document.getElementById('editForm').addEventListener('submit', updateTask);
    
    // Add subtask buttons
    document.getElementById('addSubtaskBtn').addEventListener('click', () => {
        const container = document.getElementById('subtaskContainer');
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'subtask-input-group';
        div.innerHTML = `
            <input type="text" class="subtask-input" placeholder="Subtask ${count}">
            <button type="button" class="btn-remove-subtask"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('editAddSubtaskBtn').addEventListener('click', () => {
        const container = document.getElementById('editSubtaskContainer');
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'subtask-input-group';
        div.innerHTML = `
            <input type="text" class="subtask-input" placeholder="Subtask ${count}">
            <button type="button" class="btn-remove-subtask"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    });
    
    // Remove subtask buttons (event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-subtask')) {
            const group = e.target.closest('.subtask-input-group');
            const container = group.parentElement;
            if (container.children.length > 1) {
                group.remove();
            }
        }
    });
    
    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });
    
    document.querySelectorAll('[data-priority]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPriorityFilter = btn.dataset.priority;
            renderTasks();
        });
    });
    
    // Sort button
    document.getElementById('sortBtn').addEventListener('click', () => {
        renderTasks(); // Sudah di-sort by default
        showToast('Diurutkan berdasarkan prioritas');
    });
    
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Modal close buttons
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('closeDayTasksModal').addEventListener('click', () => {
        document.getElementById('dayTasksModal').classList.remove('active');
    });
    
    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Notification button
    document.getElementById('notificationBtn').addEventListener('click', requestNotificationPermission);
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('taskflow_theme', newTheme);
        
        const icon = document.querySelector('#themeToggle i');
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
};

/**
 * Set default deadline (24 jam dari sekarang)
 */
const setDefaultDeadline = () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    document.getElementById('taskDeadline').value = formatDateTimeLocal(tomorrow);
};

/**
 * Load theme preference
 */
const loadTheme = () => {
    const savedTheme = localStorage.getItem('taskflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const icon = document.querySelector('#themeToggle i');
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
};

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize application
 */
const init = () => {
    loadTasks();
    loadTheme();
    setupEventListeners();
    setDefaultDeadline();
    
    renderStats();
    renderCalendar();
    renderTasks();
    
    // Cek izin notifikasi yang sudah ada
    if ('Notification' in window && Notification.permission === 'granted') {
        notificationPermission = true;
        document.getElementById('notificationBadge').classList.add('active');
    }
    
    // Jalankan pengecekan notifikasi setiap menit
    setInterval(checkDeadlineNotifications, 60000);
    checkDeadlineNotifications(); // Cek segera
    
    console.log('🚀 TaskFlow initialized!');
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', init);
