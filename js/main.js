// Darling Editor - Motor Estable V3
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const wrapper = document.getElementById('canvas-wrapper');
const dropZone = document.getElementById('drop-zone');
const toggleBgBtn = document.getElementById('toggle-bg');
const addTextBtn = document.getElementById('add-text-btn');
const exportBtn = document.getElementById('export-btn');

let isBgVisible = true;

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
});

async function processFile(file) {
    try {
        dropZone.style.display = 'none';
        wrapper.innerHTML = '<div style="color:white; padding:20px;">Cargando documento...</div>';

        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            wrapper.innerHTML = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                await renderProfessionalPage(page);
            }
        } else if (file.type.startsWith('image/')) {
            await renderImagePage(file);
        }
        initInteractions();
    } catch (err) {
        console.error(err);
        wrapper.innerHTML = '<div style="color:red; padding:20px;">Error al cargar. Prueba un archivo más pequeño.</div>';
    }
}

async function renderProfessionalPage(page) {
    // Escala moderada para evitar errores en móvil
    const scale = window.innerWidth < 600 ? 1.0 : 1.5;
    const viewport = page.getViewport({ scale });
    
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;
    pageContainer.style.background = 'white';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ canvasContext: context, viewport }).promise;

    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';
    const textContent = await page.getTextContent();

    textContent.items.forEach(item => {
        const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
        );

        const x = tx[4];
        const y = tx[5] - (item.height * 0.8);
        const w = item.width * scale;
        const h = item.height * scale;

        // TÉCNICA DE MÁSCARA: Limpiamos el texto original del fondo
        context.fillStyle = 'white'; // Aquí podrías detectar el color del fondo si no es blanco
        context.fillRect(x - 1, y - h + 1, w + 2, h + 2);

        const block = document.createElement('div');
        block.className = 'editable-block draggable';
        block.contentEditable = true;
        block.innerText = item.str;
        block.style.transform = `translate(${x}px, ${y}px)`;
        block.setAttribute('data-x', x);
        block.setAttribute('data-y', y);
        block.style.fontSize = `${h}px`;
        block.style.color = 'black';
        
        textLayer.appendChild(block);
    });

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayer);
    wrapper.appendChild(pageContainer);
}

async function renderImagePage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const width = Math.min(window.innerWidth - 40, 800);
                const scale = width / img.width;
                const height = img.height * scale;
                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                pageContainer.style.width = `${width}px`;
                pageContainer.style.height = `${height}px`;
                pageContainer.style.backgroundImage = `url(${e.target.result})`;
                pageContainer.style.backgroundSize = 'contain';
                
                const textLayer = document.createElement('div');
                textLayer.className = 'text-layer';
                pageContainer.appendChild(textLayer);
                wrapper.appendChild(pageContainer);
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function initInteractions() {
    interact('.draggable').draggable({
        listeners: {
            move(event) {
                const target = event.target;
                const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                target.style.transform = `translate(${x}px, ${y}px)`;
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            }
        }
    });
}

toggleBgBtn.addEventListener('click', () => {
    isBgVisible = !isBgVisible;
    document.querySelectorAll('canvas').forEach(c => c.style.visibility = isBgVisible ? 'visible' : 'hidden');
});

addTextBtn.addEventListener('click', () => {
    const layer = document.querySelector('.text-layer');
    if(layer) {
        const b = document.createElement('div');
        b.className = 'editable-block draggable';
        b.contentEditable = true;
        b.innerText = 'Nuevo Texto';
        b.style.transform = 'translate(100px, 100px)';
        b.setAttribute('data-x', 100);
        b.setAttribute('data-y', 100);
        b.style.fontSize = '20px';
        layer.appendChild(b);
        b.focus();
    }
});

exportBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pages = document.querySelectorAll('.page-container');
    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2 });
        if (i > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 595, 842);
    }
    doc.save('Darling_Final.pdf');
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});
