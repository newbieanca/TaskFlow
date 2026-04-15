// === STATE & DATA ===
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter = 'all';
let selectedDate = new Date();

// Hari Libur Nasional Indonesia (Contoh Statis)
const holidays = {
    '1-1': 'Tahun Baru',
    '17-8': 'HUT RI',
    '25-12': 'Natal'
    // Tambahkan hari libur lainnya sesuai kebutuhan
};

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();
    renderCalendar();
    renderTasks();
    setupEventListeners();
    checkDeadlines();
});

function setupEventListeners() {
    document.getElementById('addBtn').addEventListener('click', addTask);
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') addTask();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelector('.filter-btn.active').classList.remove('active');
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // Sort
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        renderTasks(e.target.value);
    });

    // Calendar nav
    document.getElementById('prevMonth').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() + 1);
        renderCalendar();
    });
}

// === LOCAL STORAGE ===
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// === TASK MANAGEMENT ===
function addTask() {
    const title = document.getElementById('taskInput').value.trim();
    const deadline = document.getElementById('deadlineInput').value;
    const priority = document.getElementById('priorityInput').value;

    if(!title) return;

    const newTask = {
        id: Date.now(),
        title: title,
        completed: false,
        deadline: deadline,
        priority: priority,
        subtasks: [],
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    renderCalendar();

    // Clear input
    document.getElementById('taskInput').value = '';
    document.getElementById('deadlineInput').value = '';
}

function deleteTask(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    element.classList.add('deleting');
    
    setTimeout(() => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        renderCalendar();
    }, 300);
}

function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if(task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
}

function addSubtask(taskId, inputElement) {
    const text = inputElement.value.trim();
    if(!text) return;

    const task = tasks.find(t => t.id === taskId);
    task.subtasks.push({ id: Date.now(), text, completed: false });
    
    saveTasks();
    renderTasks();
}

function toggleSubtask(taskId, subId) {
    const task = tasks.find(t => t.id === taskId);
    const sub = task.subtasks.find(s => s.id === subId);
    sub.completed = !sub.completed;
    saveTasks();
    renderTasks();
}

// === RENDER TASKS ===
function renderTasks(sortBy = 'default') {
    const listEl = document.getElementById('taskList');
    listEl.innerHTML = '';

    let filteredTasks = [...tasks];

    // Filter Logic
    if(currentFilter === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.completed);
    } else if(currentFilter === 'pending') {
        filteredTasks = filteredTasks.filter(t => !t.completed);
    }

    // Sort Logic
    if(sortBy === 'priority') {
        const order = { high: 1, medium: 2, low: 3 };
        filteredTasks.sort((a,b) => order[a.priority] - order[b.priority]);
    } else if(sortBy === 'date') {
        filteredTasks.sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
    }

    filteredTasks.forEach(task => {
        const el = createTaskElement(task);
        listEl.appendChild(el);
    });
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-card';
    div.setAttribute('data-id', task.id);

    // Hitung Progress
    const totalSub = task.subtasks.length;
    const doneSub = task.subtasks.filter(s => s.completed).length;
    const progressPercent = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;

    // Status Deadline
    let deadlineClass = '';
    if(task.deadline) {
        const now = new Date();
        const dl = new Date(task.deadline);
        const diff = dl - now;
        
        if(diff < 0) deadlineClass = 'over'; // Lewat
        else if(diff < 24 * 60 * 60 * 1000) deadlineClass = 'soon'; // Kurang 24 jam
    }

    div.innerHTML = `
        <div class="task-header">
            <input type="checkbox" class="
