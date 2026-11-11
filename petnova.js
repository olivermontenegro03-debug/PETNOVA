/* ===== MENÚ MÓVIL ===== */
const menuBoton = document.getElementById('menuBoton');
const menuNav = document.getElementById('menuNav');
menuBoton.addEventListener('click', () => {
    const abierto = menuNav.classList.toggle('abierto');
    menuBoton.setAttribute('aria-expanded', abierto);
});
menuNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menuNav.classList.remove('abierto')));

/* ===== APARECER AL HACER SCROLL ===== */
const observador = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observador.observe(el));

/* ===== ACORDEÓN ===== */
const paneles = document.querySelectorAll('.panel');
function activar(panel) {
    paneles.forEach(p => p.classList.toggle('active', p === panel));
}
paneles.forEach(p => {
    p.addEventListener('mouseenter', () => activar(p)); // computador
    p.addEventListener('click', () => activar(p));      // celular
    p.addEventListener('focus', () => activar(p));      // teclado
});

/* ===== MAPA INTERACTIVO (OpenStreetMap + Leaflet) ===== */
const CENTRO = [8.8803, -79.7833]; // La Chorrera, Panamá
const TIPOS = {
    vet: { emoji: '🩺', nombre: 'Veterinarian' },
    tienda: { emoji: '🛍️', nombre: 'Pet store' },
    peluqueria: { emoji: '✂️', nombre: 'Pet grooming' },
    parque: { emoji: '🌳', nombre: 'Dog park' }
};

const mapa = L.map('map').setView(CENTRO, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mapa);

const capa = L.layerGroup().addTo(mapa);
const estado = document.getElementById('mapaEstado');
const lista = document.getElementById('listaLugares');
let lugares = [];
let filtroActual = 'todos';
let marcadorYo = null;

function icono(tipo) {
    return L.divIcon({
        className: '',
        html: `<div class="pin pin-${tipo}"><span>${TIPOS[tipo].emoji}</span></div>`,
        iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -34]
    });
}

function clasificar(tags) {
    if (tags.amenity === 'veterinary') return 'vet';
    if (tags.shop === 'pet') return 'tienda';
    if (tags.shop === 'pet_grooming') return 'peluqueria';
    if (tags.leisure === 'dog_park') return 'parque';
    return null;
}

function dibujar() {
    capa.clearLayers();
    lista.innerHTML = '';
    const visibles = lugares.filter(l => filtroActual === 'todos' || l.tipo === filtroActual);
    visibles.forEach(l => {
        const direccion = `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}`;
        const marcador = L.marker([l.lat, l.lon], { icon: icono(l.tipo) }).addTo(capa);
        marcador.bindPopup(`<strong>${l.nombre}</strong><br>${TIPOS[l.tipo].nombre}` +
            (l.telefono ? `<br>📞 ${l.telefono}` : '') +
            `<br><a href="${direccion}" target="_blank" rel="noopener">How to get there</a>`);
        const li = document.createElement('li');
        li.innerHTML = `<span>${TIPOS[l.tipo].emoji}</span><div><strong>${l.nombre}</strong><small>${TIPOS[l.tipo].nombre}</small></div>`;
        li.addEventListener('click', () => {
            mapa.setView([l.lat, l.lon], 17);
            marcador.openPopup();
            document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        lista.appendChild(li);
    });
    estado.textContent = visibles.length
        ? `${visibles.length} places found. Tap a pin for details.`
        : 'No places found in this area. Zoom out or move the map and press "Search this area".';
}

async function buscarZona() {
    const c = mapa.getCenter();
    const radio = Math.min(8000, Math.max(1500, Math.round(c.distanceTo(mapa.getBounds().getNorthEast()))));
    estado.textContent = 'Searching places near this area…';
    const filtros = ['["amenity"="veterinary"]', '["shop"="pet"]', '["shop"="pet_grooming"]', '["leisure"="dog_park"]'];
    const consulta = `[out:json][timeout:25];(` +
        filtros.map(f => `nwr${f}(around:${radio},${c.lat},${c.lng});`).join('') +
        `);out center 120;`;
    try {
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(consulta)
        });
        if (!resp.ok) throw new Error('Respuesta ' + resp.status);
        const datos = await resp.json();
        lugares = datos.elements.map(e => {
            const tipo = clasificar(e.tags || {});
            const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
            if (!tipo || lat == null) return null;
            return { tipo, lat, lon, nombre: e.tags.name || TIPOS[tipo].nombre, telefono: e.tags.phone || e.tags['contact:phone'] || '' };
        }).filter(Boolean);
        dibujar();
    } catch (err) {
        console.error(err);
        estado.textContent = 'Could not load places right now. Check your connection and press "Search this area" to try again.';
    }
}

document.getElementById('btnZona').addEventListener('click', buscarZona);

document.getElementById('filtros').addEventListener('click', e => {
    const btn = e.target.closest('.filtro');
    if (!btn) return;
    document.querySelectorAll('.filtro').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    filtroActual = btn.dataset.tipo;
    dibujar();
});

document.getElementById('btnUbicacion').addEventListener('click', () => {
    if (!navigator.geolocation) { estado.textContent = 'Your browser does not support location.'; return; }
    estado.textContent = 'Getting your location…';
    navigator.geolocation.getCurrentPosition(pos => {
        const punto = [pos.coords.latitude, pos.coords.longitude];
        if (marcadorYo) mapa.removeLayer(marcadorYo);
        marcadorYo = L.marker(punto, {
            icon: L.divIcon({ className: '', html: '<div class="pin pin-yo"><span>🐶</span></div>', iconSize: [36, 36], iconAnchor: [18, 36] })
        }).addTo(mapa).bindPopup('You are here').openPopup();
        mapa.setView(punto, 15);
        buscarZona();
    }, () => {
        estado.textContent = 'Location blocked. Allow location access in your browser to use this button.';
    });
});

buscarZona();

/* ===== CARRUSEL PET MOMENTS ===== */
// Guarda tus fotos en la carpeta img/ con estos nombres (pet1.jpg ... pet7.jpg)
const fotos = [
    { archivo: 'perrochoco.jpg', fondo: '#523f7a', giro: -6, alt: 'Corgi sobre fondo naranja' },
    { archivo: 'ftgato2.jpg', fondo: '#ffffff', giro: 4, alt: 'Perro con un peluche' },
    { archivo: 'perrosdueño.jpg', fondo: '#0cbddc', giro: -3, alt: 'Perro feliz sobre el pasto' },
    { archivo: 'gatos.jpg', fondo: '#523f7a', giro: 5, alt: 'Bulldog con sudadera amarilla' },
    { archivo: 'perroplaya.jpg', fondo: '#ffffff', giro: -5, alt: 'Gatito levantando la pata' },
    { archivo: 'gatonaranja.jpg', fondo: '#0cbddc', giro: 3, alt: 'Corgi cachorro' },
    { archivo: 'cachorros.jpg', fondo: '#523f7a', giro: -4, alt: 'Samoyedo sonriendo' }
];
const pista = document.getElementById('pista');
// Se duplican las fotos para que el movimiento sea infinito y sin saltos
[...fotos, ...fotos].forEach(f => {
    const tarjeta = document.createElement('figure');
    tarjeta.className = 'polaroid';
    tarjeta.style.setProperty('--fondo', f.fondo);
    tarjeta.style.setProperty('--giro', f.giro + 'deg');
    tarjeta.innerHTML = `<img src="${f.archivo}" alt="${f.alt}" loading="lazy">`;
    pista.appendChild(tarjeta);
});
