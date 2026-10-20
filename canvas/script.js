// === Состояние приложения ===
let cards = [];
let cardIdCounter = 1;

// === Координаты холста (Панорамирование) ===
let panX = 0;
let panY = 0;

// === Drag-and-Drop карточек ===
let isDragging = false;
let currentDragCard = null;
let startX, startY, initialCardX, initialCardY;
let rafId = null;

let potentialDragCard = null;
let potentialStartX = 0;
let potentialStartY = 0;
const DRAG_THRESHOLD = 5;

// === Panning холста ===
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// === Resize карточек ===
let isResizing = false;
let resizeCard = null;
let resizeHandle = null;
let resizeStartX = 0;
let resizeStartY = 0;
let initialWidth = 0;
let initialHeight = 0;
let initialCardXResize = 0;
let initialCardYResize = 0;

// === DOM-элементы ===
const addCardBtn = document.getElementById('addCardBtn');
const saveCanvasBtn = document.getElementById('saveCanvasBtn');
const cardsContainer = document.getElementById('cardsContainer');
let canvasWorld;

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
    canvasWorld = document.createElement('div');
    canvasWorld.className = 'canvas-world';
    canvasWorld.id = 'canvasWorld';
    cardsContainer.appendChild(canvasWorld);

    addCardBtn.addEventListener('click', addCard);
    saveCanvasBtn.addEventListener('click', saveCanvas);
    updateEmptyState();
    
    cardsContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Клик по пустому месту снимает выделение
    cardsContainer.addEventListener('click', (e) => {
        if (e.target === cardsContainer || e.target === canvasWorld) {
            deselectAllCards();
        }
    });
});

// === Глобальные обработчики мыши ===
function handleMouseDown(e) {
    // 1. Панорамирование (ПКМ)
    if (e.button === 2) {
        const isBackground = e.target === cardsContainer || e.target === canvasWorld || e.target.classList.contains('empty-state');
        if (isBackground) {
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            cardsContainer.classList.add('panning');
            e.preventDefault();
        }
    }
    
    // 2. Resize (ЛКМ по ручке)
    if (e.button === 0 && e.target.classList.contains('resize-handle')) {
        const cardEl = e.target.closest('.card');
        const id = cardEl.dataset.id;
        const data = cards.find(c => c.id === id);

        if (data) {
            isResizing = true;
            resizeCard = cardEl;
            resizeHandle = e.target;

            resizeStartX = e.clientX;
            resizeStartY = e.clientY;

            initialWidth = data.width;
            initialHeight = data.height;
            initialCardXResize = data.x;
            initialCardYResize = data.y;

            cardEl.classList.add('resizing');
            cardEl.classList.add('selected');

            // Убираем фокус с текста, чтобы не мигал курсор/выделение
        if (document.activeElement && document.activeElement.isContentEditable) {
            document.activeElement.blur();
        }

        e.preventDefault();
        e.stopPropagation();
        }
    }
    
    // 3. Потенциальный драг карточки (ЛКМ)
    if (e.button === 0 && !isResizing) {
        const cardEl = e.target.closest('.card');
        if (cardEl) {
            const isEditable = e.target.classList.contains('card-content') || e.target.isContentEditable;
            const isButton = e.target.closest('.btn');
            const isHandle = e.target.classList.contains('resize-handle');
            
            if (!isEditable && !isButton && !isHandle) {
                const id = cardEl.dataset.id;
                const data = cards.find(c => c.id === id);
                if (data) {
                    potentialDragCard = cardEl;
                    potentialStartX = e.clientX;
                    potentialStartY = e.clientY;
                    initialCardX = data.x;
                    initialCardY = data.y;
                    
                    // Активируем карточку
                    selectCard(cardEl);
                }
            }
        }
    }
}

function handleMouseMove(e) {
    // Если тянем холст
    if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        
        panX += dx;
        panY += dy;
        
        canvasWorld.style.transform = `translate(${panX}px, ${panY}px)`;
        
        panStartX = e.clientX;
        panStartY = e.clientY;
        return; 
    }

    // Если изменяем размер
    if (isResizing && resizeCard) {
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        
        const id = resizeCard.dataset.id;
        const cardData = cards.find(c => c.id === id);
        
        if (cardData) {
            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newX = initialCardXResize;
            let newY = initialCardYResize;
            
            // Определяем, какой угол тянем
            const isLeft = resizeHandle.classList.contains('top-left') || resizeHandle.classList.contains('bottom-left');
            const isTop = resizeHandle.classList.contains('top-left') || resizeHandle.classList.contains('top-right');
            const isRight = resizeHandle.classList.contains('top-right') || resizeHandle.classList.contains('bottom-right');
            const isBottom = resizeHandle.classList.contains('bottom-left') || resizeHandle.classList.contains('bottom-right');
            
            if (isRight) {
                newWidth = Math.max(150, initialWidth + dx);
            }
            if (isLeft) {
                newWidth = Math.max(150, initialWidth - dx);
                newX = initialCardXResize + (initialWidth - newWidth);
            }
            if (isBottom) {
                newHeight = Math.max(100, initialHeight + dy);
            }
            if (isTop) {
                newHeight = Math.max(100, initialHeight - dy);
                newY = initialCardYResize + (initialHeight - newHeight);
            }
            
            cardData.width = newWidth;
            cardData.height = newHeight;
            cardData.x = newX;
            cardData.y = newY;
            
            resizeCard.style.width = `${newWidth}px`;
            resizeCard.style.height = `${newHeight}px`;
            resizeCard.style.transform = `translate(${newX}px, ${newY}px)`;
        }
        return;
    }

    // Проверка порога для потенциального драга
    if (potentialDragCard && !isDragging) {
        const dx = e.clientX - potentialStartX;
        const dy = e.clientY - potentialStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > DRAG_THRESHOLD) {
            isDragging = true;
            currentDragCard = potentialDragCard;
            startX = potentialStartX;
            startY = potentialStartY;
            
            if (document.activeElement && document.activeElement.isContentEditable) {
                document.activeElement.blur();
            }
            
            currentDragCard.classList.add('dragging');
            e.preventDefault();
        }
    }

    // Если тянем карточку
    if (isDragging && currentDragCard) {
        if (rafId) cancelAnimationFrame(rafId);
        
        rafId = requestAnimationFrame(() => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const id = currentDragCard.dataset.id;
            const cardData = cards.find(c => c.id === id);
            
            if (cardData) {
                cardData.x = initialCardX + dx;
                cardData.y = initialCardY + dy;
                currentDragCard.style.transform = `translate(${cardData.x}px, ${cardData.y}px)`;
            }
        });
    }
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        cardsContainer.classList.remove('panning');
    }
    
    if (isResizing) {
        if (resizeCard) {
            resizeCard.classList.remove('resizing');
        }

        isResizing = false;
        resizeCard = null;
        resizeHandle = null;
    }
    
    if (potentialDragCard) {
        potentialDragCard = null;
    }
    
    if (isDragging && currentDragCard) {
        currentDragCard.classList.remove('dragging');
        isDragging = false;
        currentDragCard = null;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }
}

// === Управление выделением ===
function selectCard(cardEl) {
    deselectAllCards();
    cardEl.classList.add('selected');
}

function deselectAllCards() {
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
    });
}

// === Добавление карточки ===
function addCard() {
    const id = String(cardIdCounter++);
    
    const rect = cardsContainer.getBoundingClientRect();
    const viewCenterX = rect.width / 2;
    const viewCenterY = rect.height / 2;
    
    const worldX = viewCenterX - panX;
    const worldY = viewCenterY - panY;

    const offset = (cards.length % 5) * 30; 

    const cardData = {
        id: id,
        x: worldX - 125 + offset,
        y: worldY - 100 + offset,
        width: 250,
        height: 200,
        text: ''
    };
    
    cards.push(cardData);
    renderCard(cardData);
    updateEmptyState();
}

// === Отрисовка карточки ===
function renderCard(data) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = data.id;
    
    cardEl.style.transform = `translate(${data.x}px, ${data.y}px)`;
    cardEl.style.width = `${data.width}px`;
    cardEl.style.height = `${data.height}px`;

    cardEl.innerHTML = `
        <div class="card-content" contenteditable="true"></div>
        <div class="card-actions">
            <button class="btn btn-small btn-danger delete-btn">Удалить</button>
        </div>
        <div class="resize-handle top-left"></div>
        <div class="resize-handle top-right"></div>
        <div class="resize-handle bottom-left"></div>
        <div class="resize-handle bottom-right"></div>
    `;

    cardEl.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(data.id);
    });

    const contentEl = cardEl.querySelector('.card-content');
    contentEl.addEventListener('input', (e) => {
        data.text = e.target.innerText;
    });

    canvasWorld.appendChild(cardEl);
}

// === Удаление карточки ===
function deleteCard(id) {
    cards = cards.filter(c => c.id !== id);
    const cardEl = canvasWorld.querySelector(`.card[data-id="${id}"]`);
    if (cardEl) cardEl.remove();
    updateEmptyState();
}

// === Пустое состояние ===
function updateEmptyState() {
    let emptyEl = cardsContainer.querySelector('.empty-state');
    
    if (cards.length === 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = 'Холст пуст. Нажмите «Добавить карточку».';
            cardsContainer.appendChild(emptyEl);
        }
    } else {
        if (emptyEl) emptyEl.remove();
    }
}

// === Экспорт в Obsidian Canvas ===
function saveCanvas() {
    if (cards.length === 0) {
        alert('Добавьте хотя бы одну карточку!');
        return;
    }

    const canvasData = {
        nodes: cards.map(card => ({
            id: card.id,
            x: card.x,
            y: card.y,
            width: card.width,
            height: card.height,
            type: 'text',
            text: card.text
        })),
        edges: []
    };

    const jsonStr = JSON.stringify(canvasData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_canvas.canvas';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}