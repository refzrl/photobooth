// --- DEKLARASI ELEMEN ---
const video = document.getElementById('camera-stream');
const canvas = document.getElementById('photo-canvas');
const ctx = canvas.getContext('2d');
const frameOverlay = document.getElementById('frame-overlay');

const cameraSection = document.getElementById('camera-section');
const previewSection = document.getElementById('preview-section');

const btnCapture = document.getElementById('btn-capture');
const btnRetake = document.getElementById('btn-retake');
const btnConfirmSave = document.getElementById('btn-confirm-save');
const btnMirror = document.getElementById('btn-mirror');
const btnTimer = document.getElementById('btn-timer');
const btnFlash = document.getElementById('btn-flash');

// Elemen Checklist Simpan (Preview)
const chkSaveDraft = document.getElementById('chk-save-draft');
const chkSaveDevice = document.getElementById('chk-save-device');

// Elemen Galeri Draft
const draftsContainer = document.getElementById('drafts-container');
const draftList = document.getElementById('draft-list');
const draftCount = document.getElementById('draft-count');
const chkSelectAllDrafts = document.getElementById('chk-select-all-drafts');
const btnDownloadSelected = document.getElementById('btn-download-selected');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const selectedCount = document.getElementById('selected-count');

const frameThumbs = document.querySelectorAll('.frame-thumb');
const countdownDisplay = document.getElementById('countdown-display');
const flashEffect = document.getElementById('flash-effect');

let isMirrored = true;
let useTimer = false;
let useFlash = true;
let selectedDraftIds = new Set();

// --- DATABASE INDEXEDDB UNTUK DRAFT (KAPASITAS BESAR) ---
const DB_NAME = 'PhotoMbutDB';
const STORE_NAME = 'drafts';

function openDraftDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addDraftToDB(dataUrl) {
    const db = await openDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: Date.now(), image: dataUrl });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllDraftsFromDB() {
    const db = await openDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.reverse());
        request.onerror = () => reject(request.error);
    });
}

async function deleteDraftsFromDB(ids) {
    const db = await openDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// --- 1. MEMULAI KAMERA ---
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false 
        });
        video.srcObject = stream;
        updateMirror();
    } catch (err) {
        console.error("Gagal mengakses kamera:", err);
        alert("Kamera kamu gak bisa diakses. Coba kasih izin duu, kak.");
    }
}

// --- 2. FUNGSI TOMBOL TOGGLE ---
btnMirror.addEventListener('click', () => {
    isMirrored = !isMirrored;
    btnMirror.classList.toggle('active', isMirrored);
    updateMirror();
});

function updateMirror() {
    video.classList.toggle('mirrored', isMirrored);
}

btnTimer.addEventListener('click', () => {
    useTimer = !useTimer;
    btnTimer.classList.toggle('active', useTimer);
});

btnFlash.addEventListener('click', () => {
    useFlash = !useFlash;
    btnFlash.classList.toggle('active', useFlash);
});

// --- 3. KLIK FRAME DARI SIDEBAR KIRI (EFEK FADE) ---
frameThumbs.forEach(thumb => {
    thumb.addEventListener('click', function() {
        if (this.classList.contains('active')) return;

        frameThumbs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        frameOverlay.classList.remove('fade-in');
        frameOverlay.classList.add('fade-out');

        setTimeout(() => {
            frameOverlay.src = this.getAttribute('data-src');
            frameOverlay.onload = () => {
                frameOverlay.classList.remove('fade-out');
                frameOverlay.classList.add('fade-in');
            };
        }, 200);
    });
});

// --- 4. PROSES CAPTURE ---
btnCapture.addEventListener('click', () => {
    btnCapture.disabled = true;

    if (useTimer) {
        let timeLeft = 3;
        countdownDisplay.textContent = timeLeft;
        countdownDisplay.classList.remove('hidden');
        
        const timerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                countdownDisplay.textContent = timeLeft;
            } else {
                clearInterval(timerInterval);
                countdownDisplay.classList.add('hidden');
                takePhoto();
                btnCapture.disabled = false;
            }
        }, 1000);
    } else {
        takePhoto();
        btnCapture.disabled = false;
    }
});

function takePhoto() {
    if (useFlash) {
        flashEffect.classList.remove('flash-active');
        void flashEffect.offsetWidth; 
        flashEffect.classList.add('flash-active');
    }

    setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoRatio > canvasRatio) {
            drawWidth = canvas.height * videoRatio;
            offsetX = (canvas.width - drawWidth) / 2;
        } else {
            drawHeight = canvas.width / videoRatio;
            offsetY = (canvas.height - drawHeight) / 2;
        }

        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore(); 
        ctx.drawImage(frameOverlay, 0, 0, canvas.width, canvas.height);
        
        cameraSection.classList.remove('active');
        previewSection.classList.remove('hidden'); 
        previewSection.classList.add('active');
        
    }, useFlash ? 220 : 0);
}

// --- 5. TOMBOL RETAKE ---
btnRetake.addEventListener('click', () => {
    previewSection.classList.remove('active');
    previewSection.classList.add('hidden');
    cameraSection.classList.add('active');
});

// --- 6. FUNGSI DOWNLOAD KE DEVICE ---
function triggerDownload(dataUrl) {
    const link = document.createElement('a');
    link.download = `PhotoMbut_${Math.floor(100 + Math.random() * 2500)}.png`;
    link.href = dataUrl;
    link.click();
}

// --- 7. EKSEKUSI CHECKLIST SIMPAN DI PREVIEW ---
btnConfirmSave.addEventListener('click', async () => {
    const toDraft = chkSaveDraft.checked;
    const toDevice = chkSaveDevice.checked;

    if (!toDraft && !toDevice) {
        alert("Centang minimal satu pilihan: 'Masuk ke Draft' atau 'Simpan ke Device'.");
        return;
    }

    try {
        const dataUrl = canvas.toDataURL('image/png');

        if (toDraft) {
            await addDraftToDB(dataUrl);
            await renderDrafts();
        }

        if (toDevice) {
            triggerDownload(dataUrl);
        }

        const originalHTML = btnConfirmSave.innerHTML;
        btnConfirmSave.innerHTML = '<i class="fas fa-check"></i> Berhasil!';
        btnConfirmSave.disabled = true;

        setTimeout(() => {
            btnConfirmSave.innerHTML = originalHTML;
            btnConfirmSave.disabled = false;
        }, 1200);
    } catch (err) {
        console.error("Error saat menyimpan:", err);
        alert("Gagal menyimpan foto. Pastikan aplikasi berjalan melalui Local Server (http://).");
    }
});

// --- 8. KELOLA GALERI & CHECKLIST DRAFT ---
function updateBulkActionState(totalDrafts) {
    const count = selectedDraftIds.size;
    selectedCount.textContent = count;
    btnDownloadSelected.disabled = count === 0;
    btnDeleteSelected.disabled = count === 0;
    chkSelectAllDrafts.checked = totalDrafts > 0 && count === totalDrafts;
}

async function renderDrafts() {
    const drafts = await getAllDraftsFromDB();
    draftCount.textContent = drafts.length;

    // Bersihkan ID terpilih yang sudah tidak ada
    const validIds = new Set(drafts.map(d => d.id));
    selectedDraftIds.forEach(id => {
        if (!validIds.has(id)) selectedDraftIds.delete(id);
    });

    if (drafts.length === 0) {
        draftsContainer.classList.add('hidden');
        draftList.innerHTML = '';
        updateBulkActionState(0);
        return;
    }

    draftsContainer.classList.remove('hidden');
    draftList.innerHTML = '';

    drafts.forEach(draft => {
        const item = document.createElement('div');
        item.className = 'draft-item';
        if (selectedDraftIds.has(draft.id)) item.classList.add('checked');

        // Checkbox pada masing-masing draft
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'draft-item-checkbox';
        checkbox.checked = selectedDraftIds.has(draft.id);
        checkbox.title = 'Centang untuk disimpan ke device';

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedDraftIds.add(draft.id);
                item.classList.add('checked');
            } else {
                selectedDraftIds.delete(draft.id);
                item.classList.remove('checked');
            }
            updateBulkActionState(drafts.length);
        });

        const img = document.createElement('img');
        img.src = draft.image;
        img.title = 'Klik foto untuk preview ulang';

        // Klik gambar untuk membuka kembali di layar preview
        img.addEventListener('click', () => {
            const draftImg = new Image();
            draftImg.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(draftImg, 0, 0, canvas.width, canvas.height);

                cameraSection.classList.remove('active');
                previewSection.classList.remove('hidden');
                previewSection.classList.add('active');
            };
            draftImg.src = draft.image;
        });

        item.appendChild(checkbox);
        item.appendChild(img);
        draftList.appendChild(item);
    });

    updateBulkActionState(drafts.length);
}

// Pilih Semua Draft
chkSelectAllDrafts.addEventListener('change', async () => {
    const drafts = await getAllDraftsFromDB();
    if (chkSelectAllDrafts.checked) {
        drafts.forEach(d => selectedDraftIds.add(d.id));
    } else {
        selectedDraftIds.clear();
    }
    renderDrafts();
});

// Simpan Semua Draft yang Dicentang ke Device
btnDownloadSelected.addEventListener('click', async () => {
    const drafts = await getAllDraftsFromDB();
    const toDownload = drafts.filter(d => selectedDraftIds.has(d.id));

    toDownload.forEach((draft, index) => {
        setTimeout(() => {
            triggerDownload(draft.image);
        }, index * 350); // Jeda 250ms agar browser tidak memblokir multiple download
    });
});

// --- POP-UP KONFIRMASI HAPUS DRAFT ---
const deleteModal = document.getElementById('delete-modal');
const deleteModalCount = document.getElementById('delete-modal-count');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

// Munculkan pop-up saat ikon tempat sampah diklik
btnDeleteSelected.addEventListener('click', () => {
    if (selectedDraftIds.size === 0) return;
    deleteModalCount.textContent = selectedDraftIds.size;
    deleteModal.classList.remove('hidden');
});

// Tutup pop-up saat tombol "Batal" diklik
btnCancelDelete.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
});

// Tutup pop-up jika area gelap di luar kotak diklik
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.add('hidden');
    }
});

// Eksekusi hapus dari IndexedDB saat tombol "Ya, Hapus" diklik
btnConfirmDelete.addEventListener('click', async () => {
    await deleteDraftsFromDB(Array.from(selectedDraftIds));
    selectedDraftIds.clear();
    deleteModal.classList.add('hidden');
    renderDrafts();
});

// --- INISIALISASI ---
startCamera();
renderDrafts();