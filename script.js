// ==========================================
// SECCIÓN 1: IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA91qTTlkWMA5H9cEvI1yja5j3WmkzEbqY",
  authDomain: "gym-app-social.firebaseapp.com",
  projectId: "gym-app-social",
  storageBucket: "gym-app-social.firebasestorage.app",
  messagingSenderId: "788607838572",
  appId: "1:788607838572:web:85ea3b15fdf467671aab49"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserSessionPersistence); 

// ==========================================
// SECCIÓN 2: ESTADO GLOBAL Y DICCIONARIOS
// ==========================================
const diasDeLaSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = {};
let estadoDias = {};
let totalEntrenamientos = 0;
let fallosHistoricos = {}; 
let pesosMaximos = {}; 
let historialGlobal = []; 
let diaActivo = null;
let startTime, elapsedTime = 0, timerInterval, isRunning = false;

// Variables de la Isla de Descanso
let tiempoDescansoGlobal = 180; // 3 minutos por defecto en segundos
let timerDescansoInterval;
let descansoRestante = 0;

// Diccionario de Técnicas (IDs de YouTube)
const infoEjercicios = {
    "Press Banca": {
        youtubeId: "TAH8RxOS0VI" // Solo pon la ID del video aquí
    },
    "Press Banca Mancuernas": {
        youtubeId: "TAH8RxOS0VI"
    },
    "Press Inclinado": {
        youtubeId: "-zbesyTNztQ"
    },
    "Press Inclinado Mancuernas": {
        youtubeId: "-zbesyTNztQ"
    },
    "Apertura Mancuernas": {
        youtubeId: "OtW0EYqBczI"
    },
    "Press Frances": {
        youtubeId: "L3bEz-vcdGU"
    },
    "Extensiones Tricep": {
        youtubeId: ""
    },
    "Dominadas": {
        youtubeId: "BT3CSQKeEww"
    },
    "Dominadas Neutras": {
        youtubeId: ""
    },
    "Dominadas Supino": {
        youtubeId: ""
    },
    "Curl Predicador Mancuernas": {
        youtubeId: ""
    },
    "Curl Predicador": {
        youtubeId: ""
    },
    "Curl 21": {
        youtubeId: ""
    },
    "Press Militar": {
        youtubeId: "DdITN8U-kFI"
    },
    "Elevaciones Laterales": {
        youtubeId: "UQkdNBpjFDo"
    },
    "Elevaciones Frontales": {
        youtubeId: "HciAFZSN2Qo"
    }
};

// ==========================================
// SECCIÓN 3: SISTEMA DE AUTENTICACIÓN
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('vista-auth').style.display = 'none';
        document.getElementById('vista-semana').style.display = 'flex';
        await cargarDatosDeNube(user.uid);
    } else {
        document.getElementById('vista-auth').style.display = 'flex';
        document.getElementById('vista-semana').style.display = 'none';
        document.getElementById('vista-dia').style.display = 'none';
        document.getElementById('vista-cuenta').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Cargando...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { errorMsg.innerText = "⚠️ Error: Verifica tu correo o contraseña."; }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errorMsg = document.getElementById('auth-error');
    if(!email || !pass) return errorMsg.innerText = "⚠️ Completa ambos campos.";
    try {
        errorMsg.innerText = "Creando cuenta...";
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        await sendEmailVerification(userCredential.user);
        alert("¡Cuenta creada exitosamente! Te hemos enviado un correo para verificar tu identidad.");
        setTimeout(() => editarNombre(), 1000); 
    } catch (error) {
        if (error.code === 'auth/weak-password') errorMsg.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
        else if (error.code === 'auth/email-already-in-use') errorMsg.innerText = "⚠️ Ese correo ya está registrado.";
        else errorMsg.innerText = "⚠️ Error: " + error.code;
    }
});

document.getElementById('btn-google').addEventListener('click', async () => {
    const errorMsg = document.getElementById('auth-error');
    try {
        errorMsg.innerText = "Abriendo ventana de Google...";
        await signInWithPopup(auth, new GoogleAuthProvider());
        if (auth.currentUser.displayName) document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName.split(" ")[0];
    } catch (error) { errorMsg.innerText = "⚠️ Error al conectar con Google."; }
});

document.getElementById('btn-cerrar-sesion-main').addEventListener('click', () => signOut(auth));

// ==========================================
// SECCIÓN 4: BASE DE DATOS Y SINCRONIZACIÓN
// ==========================================
async function guardarDatosEnNube() {
    if (!auth.currentUser) return;
    try {
        await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
            baseDeDatosLocal, estadoDias, totalEntrenamientos, fallosHistoricos, pesosMaximos, historialGlobal,
            tiempoDescansoGlobal, // Guardamos la preferencia del temporizador
            nombre: document.getElementById('nombre-usuario').innerText
        }, { merge: true });
    } catch (e) { console.warn("Modo local activo"); }
}

async function cargarDatosDeNube(uid) {
    try {
        const docSnap = await getDoc(doc(db, "usuarios", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            baseDeDatosLocal = data.baseDeDatosLocal || {}; estadoDias = data.estadoDias || {};
            totalEntrenamientos = data.totalEntrenamientos || 0; fallosHistoricos = data.fallosHistoricos || {};
            pesosMaximos = data.pesosMaximos || {}; historialGlobal = data.historialGlobal || [];
            tiempoDescansoGlobal = data.tiempoDescansoGlobal || 180; // Cargamos preferencia o 3 min default
            document.getElementById('nombre-usuario').innerText = data.nombre || "Atleta";
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre || "Atleta";
            document.getElementById('letra-avatar').innerText = (data.nombre || "A").charAt(0).toUpperCase();
        } else {
            baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
            document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName ? auth.currentUser.displayName.split(" ")[0] : "Atleta";
        }
    } catch (error) {
        alert("⚠️ Base de datos inactiva. Modo Offline.");
        baseDeDatosLocal = {}; estadoDias = {}; totalEntrenamientos = 0; fallosHistoricos = {}; pesosMaximos = {}; historialGlobal = [];
    }
    renderizarSemana();
}

function editarNombre() {
    let nuevoNombre = prompt("Ingresa tu nombre de atleta:", document.getElementById('nombre-usuario').innerText);
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        const n = nuevoNombre.trim();
        document.getElementById('nombre-usuario').innerText = n;
        document.getElementById('titulo-perfil-nombre').innerText = n;
        document.getElementById('letra-avatar').innerText = n.charAt(0).toUpperCase();
        guardarDatosEnNube();
    }
}
document.getElementById('btn-editar-nombre').addEventListener('click', editarNombre);

// ==========================================
// SECCIÓN 5: RENDERIZADO Y EVENTOS VISTA SEMANAL
// ==========================================
function renderizarSemana() {
    const contenedor = document.getElementById('contenedor-tarjetas');
    contenedor.innerHTML = diasDeLaSemana.map(dia => {
        const checkStatus = estadoDias[dia] ? 'checked' : '';
        const claseColor = estadoDias[dia] ? 'dia-verde' : '';
        return `
            <div class="tarjeta-dia ${claseColor}" data-dia="${dia}">
                <span class="nombre-dia">${dia}</span>
                <span class="subtexto" style="margin-bottom: 10px;">Entrenar ➔</span>
                <button class="btn-wsp" title="Avisarle a mi bro">
                    <svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.553 4.161 1.6 5.967L.25 23.582l5.736-1.503c1.745.966 3.711 1.474 5.762 1.474 6.645 0 12.03-5.385 12.03-12.03S18.676 0 12.031 0zm-.016 21.603c-1.782 0-3.52-.478-5.045-1.383l-.36-.214-3.75.982.998-3.655-.235-.373c-1-1.583-1.528-3.414-1.528-5.312 0-5.568 4.531-10.1 10.1-10.1 5.568 0 10.1 4.531 10.1 10.1s-4.531 10.1-10.1 10.1zm5.55-7.584c-.304-.152-1.802-.888-2.081-.992-.278-.103-.482-.152-.686.152-.204.304-.787.992-.966 1.196-.179.204-.358.228-.662.076-.304-.152-1.285-.473-2.45-1.517-.905-.812-1.516-1.815-1.695-2.119-.179-.304-.019-.469.133-.621.137-.137.304-.358.456-.538.152-.18.204-.304.304-.508.103-.204.051-.383-.025-.535-.076-.152-.686-1.65-.94-2.258-.247-.591-.497-.512-.686-.521-.179-.009-.384-.009-.588-.009-.204 0-.538.076-.821.383-.284.307-1.09 1.063-1.09 2.593 0 1.53 1.116 3.012 1.272 3.22.156.208 2.193 3.35 5.313 4.694.743.32 1.323.511 1.774.654.747.237 1.428.203 1.965.123.6-.088 1.802-.736 2.056-1.446.254-.71.254-1.319.179-1.446-.076-.127-.28-.203-.584-.355z"/></svg>
                </button>
                <input type="checkbox" class="checkbox-dia" data-checkdia="${dia}" ${checkStatus}>
            </div>
        `;
    }).join('');
    document.getElementById('contador-total').innerText = totalEntrenamientos;
}

document.getElementById('contenedor-tarjetas').addEventListener('click', (e) => {
    if (e.target.closest('.btn-wsp')) return window.open("https://chat.whatsapp.com/GPtrTGFtMhk8icwQlcMbfw", '_blank');
    if (e.target.classList.contains('checkbox-dia')) return; 
    const tarjeta = e.target.closest('.tarjeta-dia');
    if (tarjeta) abrirDia(tarjeta.getAttribute('data-dia'));
});

document.getElementById('contenedor-tarjetas').addEventListener('change', (e) => {
    if (e.target.classList.contains('checkbox-dia')) {
        const dia = e.target.getAttribute('data-checkdia');
        if (e.target.checked && !estadoDias[dia]) totalEntrenamientos++;
        estadoDias[dia] = e.target.checked; 
        guardarDatosEnNube(); renderizarSemana();
    }
});

// ==========================================
// SECCIÓN 6: VISTA DEL DÍA Y LÓGICA DE EJERCICIOS
// ==========================================
function actualizarInterfazDia() {
    if (!diaActivo) return;
    const rutinaHoy = baseDeDatosLocal[diaActivo] || [];
    
    document.getElementById('listaEjerciciosUI').innerHTML = rutinaHoy.map((ej, idx) => {
        let htmlSeries = '';
        for (let i = 0; i < ej.series; i++) {
            const r = (ej.repesRealizadas && ej.repesRealizadas[i]) || ''; 
            const p = (ej.pesosRealizados && ej.pesosRealizados[i]) || ''; 
            const isCompleted = (ej.seriesCompletadas && ej.seriesCompletadas[i]) ? 'completada' : '';

            htmlSeries += `
                <div class="serie-swipe-wrapper">
                    <div class="serie-delete-bg">
                        <button class="btn-eliminar-serie" data-ej="${idx}" data-serie="${i}" title="Eliminar Serie">🗑️</button>
                    </div>
                    <div class="caja-serie ${isCompleted}">
                        <span class="numero-serie">S${i + 1}</span>
                        <div class="inputs-fila">
                            <input type="number" class="input-datos input-repes" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${r}">
                            <span class="etiqueta-x">x</span>
                            <input type="number" class="input-datos input-peso" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${p}">
                            <span class="etiqueta-kg">kg</span>
                        </div>
                        <button class="btn-check-serie" data-ej="${idx}" data-serie="${i}">✔</button>
                    </div>
                </div>`;
        }
        
        const prReps = fallosHistoricos[ej.nombre] || '--';
        const prPeso = pesosMaximos[ej.nombre] || '--';
        const infoTecnica = infoEjercicios[ej.nombre] || {};
        
        const htmlBack = infoTecnica.youtubeId ? `
            <div class="header-back-carta">
                <h4 style="color: var(--accent-neon); margin: 0; font-size: 14px; text-transform: uppercase;">Técnica Correcta</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver">✖</button>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-top: 5px;">
                <iframe width="100%" height="200" src="https://www.youtube.com/embed/${infoTecnica.youtubeId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px; border: 1px solid var(--border-color);"></iframe>
            </div>
        ` : `
            <div class="header-back-carta">
                <h4 style="color: var(--text-muted); margin: 0; font-size: 14px; text-transform: uppercase;">Sin Información</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver">✖</button>
            </div>
            <p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Aún no has cargado un enlace de YouTube para este ejercicio.</p>
        `;

        return `
            <div class="ejercicio-flip-container">
                <div class="ejercicio-card-inner" id="card-inner-${idx}">
                    <div class="ejercicio-card-front ejercicio-item">
                        <div class="ejercicio-header-top">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="btn-info-carta btn-flip" data-ej="${idx}" title="Ver Técnica">!</button>
                                <h4 class="titulo-ejercicio">${ej.nombre}</h4>
                            </div>
                            <button class="btn-eliminar btn-borrar-ejercicio" data-ej="${idx}" title="Eliminar Ejercicio">✖</button>
                        </div>
                        <div class="badge-pr" id="pr-${idx}">🏆 Fallo: ${prPeso}kg x ${prReps} repes</div>
                        <div class="contenedor-series">${htmlSeries}</div>
                    </div>
                    <div class="ejercicio-card-back ejercicio-item">
                        ${htmlBack}
                    </div>
                </div>
            </div>`;
    }).join('');
}

const listaUI = document.getElementById('listaEjerciciosUI');

listaUI.addEventListener('click', (e) => {
    // 1. Eliminar Ejercicio Completo
    if (e.target.classList.contains('btn-borrar-ejercicio')) {
        if(confirm('¿Borrar este ejercicio del día?')) {
            baseDeDatosLocal[diaActivo].splice(e.target.getAttribute('data-ej'), 1);
            guardarDatosEnNube(); actualizarInterfazDia();
        }
    }
    
    // 2. Flip
    if (e.target.classList.contains('btn-flip')) {
        const ejIdx = e.target.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.add('flipped');
    }
    if (e.target.classList.contains('btn-flip-back')) {
        const ejIdx = e.target.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.remove('flipped');
    }
    
    // 3. Check Serie & Lanzar Isla Descanso
    const btnCheck = e.target.closest('.btn-check-serie');
    if (btnCheck) {
        const ejIdx = btnCheck.getAttribute('data-ej');
        const serieIdx = btnCheck.getAttribute('data-serie');
        
        if (!baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas) {
            baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill(false);
        }
        
        const estadoAnterior = baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx];
        const nuevoEstado = !estadoAnterior;
        baseDeDatosLocal[diaActivo][ejIdx].seriesCompletadas[serieIdx] = nuevoEstado;
        
        guardarDatosEnNube(); 
        
        const cajaSerie = btnCheck.closest('.caja-serie');
        if (nuevoEstado) {
            cajaSerie.classList.add('completada');
            iniciarRestTimer();
        } else {
            cajaSerie.classList.remove('completada');
        }
    }

    // 4. Eliminar UNA Serie (Tacho de basura)
    const btnEliminarSerie = e.target.closest('.btn-eliminar-serie');
    if (btnEliminarSerie) {
        const ejIdx = btnEliminarSerie.getAttribute('data-ej');
        const serieIdx = parseInt(btnEliminarSerie.getAttribute('data-serie'));
        
        if (confirm('¿Seguro que quieres borrar esta serie?')) {
            const ej = baseDeDatosLocal[diaActivo][ejIdx];
            if (ej.series > 1) {
                ej.series--;
                ej.repesRealizadas.splice(serieIdx, 1);
                ej.pesosRealizados.splice(serieIdx, 1);
                ej.seriesCompletadas.splice(serieIdx, 1);
            } else {
                baseDeDatosLocal[diaActivo].splice(ejIdx, 1);
            }
            guardarDatosEnNube();
            actualizarInterfazDia();
        }
    }
});

listaUI.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('input-repes') || t.classList.contains('input-peso')) {
        const ejIdx = t.getAttribute('data-ej'); const serieIdx = t.getAttribute('data-serie');
        const tipo = t.classList.contains('input-repes') ? 'repesRealizadas' : 'pesosRealizados';
        
        if (!baseDeDatosLocal[diaActivo][ejIdx][tipo]) {
            baseDeDatosLocal[diaActivo][ejIdx][tipo] = new Array(baseDeDatosLocal[diaActivo][ejIdx].series).fill('');
        }
        baseDeDatosLocal[diaActivo][ejIdx][tipo][serieIdx] = t.value;
        
        const nombreEj = baseDeDatosLocal[diaActivo][ejIdx].nombre;
        const repsStr = baseDeDatosLocal[diaActivo][ejIdx].repesRealizadas[serieIdx];
        const pesoStr = baseDeDatosLocal[diaActivo][ejIdx].pesosRealizados[serieIdx];
        
        if (repsStr !== '' && pesoStr !== '' && repsStr !== undefined && pesoStr !== undefined) {
            const currentReps = parseFloat(repsStr);
            const currentPeso = parseFloat(pesoStr);
            let maxPesoGuardado = parseFloat(pesosMaximos[nombreEj]) || 0;
            let maxRepsGuardadas = parseFloat(fallosHistoricos[nombreEj]) || 0;
            let isNewPR = false;

            if (currentPeso > maxPesoGuardado) isNewPR = true;
            else if (currentPeso === maxPesoGuardado && currentReps > maxRepsGuardadas) isNewPR = true;

            if (isNewPR) {
                pesosMaximos[nombreEj] = currentPeso;
                fallosHistoricos[nombreEj] = currentReps;
                
                const badge = document.getElementById(`pr-${ejIdx}`);
                if(badge) {
                    badge.innerText = `🏆 Fallo: ${currentPeso}kg x ${currentReps} repes`;
                    badge.style.color = "var(--success-green)";
                    setTimeout(() => { badge.style.color = "var(--text-muted)"; }, 1500);
                }
            }
        }
        guardarDatosEnNube();
    }
});

// LÓGICA DE GESTOS SWIPE FLUIDOS (CELULAR Y PC)
let swipeStartX = 0;
let swipeStartY = 0;
let currentTranslate = 0;
let swipeActiveEl = null;
let isDragging = false;

const iniciarSwipe = (e, elemento) => {
    if (e.type === 'mousedown' && e.button !== 0) return; 
    if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button') return;

    if (elemento) {
        isDragging = true;
        swipeActiveEl = elemento;
        swipeStartX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        swipeStartY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        swipeActiveEl.style.transition = 'none';
        currentTranslate = swipeActiveEl.classList.contains('swiped') ? -65 : 0;
    } else {
        document.querySelectorAll('.caja-serie.swiped').forEach(el => {
            el.style.transform = '';
            el.classList.remove('swiped');
        });
    }
};

const moverSwipe = (e) => {
    if (!isDragging || !swipeActiveEl) return;
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    const diffX = currentX - swipeStartX;
    const diffY = Math.abs(currentY - swipeStartY);
    
    if (diffY > 10 && diffY > Math.abs(diffX)) {
        isDragging = false;
        swipeActiveEl.style.transform = '';
        return; 
    }

    if (e.cancelable) e.preventDefault(); 
    
    let newTranslate = currentTranslate + diffX;
    if (newTranslate > 0) newTranslate = 0; 
    if (newTranslate < -80) newTranslate = -80; 

    swipeActiveEl.style.transform = `translateX(${newTranslate}px)`;
};

const finalizarSwipe = (e) => {
    if (!isDragging || !swipeActiveEl) return;
    isDragging = false;
    
    swipeActiveEl.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
    const diffX = currentX - swipeStartX;
    const finalPos = currentTranslate + diffX;

    swipeActiveEl.style.transform = ''; 

    if (finalPos < -35) { 
        swipeActiveEl.classList.add('swiped');
    } else { 
        swipeActiveEl.classList.remove('swiped');
    }
    swipeActiveEl = null;
};

// Eventos táctiles para celular
listaUI.addEventListener('touchstart', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')), {passive: true});
listaUI.addEventListener('touchmove', moverSwipe, {passive: false});
listaUI.addEventListener('touchend', finalizarSwipe);

// Eventos de mouse para PC
listaUI.addEventListener('mousedown', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')));
listaUI.addEventListener('mousemove', moverSwipe);
listaUI.addEventListener('mouseup', finalizarSwipe);
listaUI.addEventListener('mouseleave', finalizarSwipe);

// --- NUEVA LÓGICA: BURBUJA DE AÑADIR EJERCICIO ---
document.getElementById('btn-toggle-add').addEventListener('click', () => {
    document.getElementById('burbuja-add-ejercicio').classList.toggle('visible');
});

document.getElementById('btn-cerrar-add').addEventListener('click', () => {
    document.getElementById('burbuja-add-ejercicio').classList.remove('visible');
});

document.getElementById('btn-agregar-ejercicio').addEventListener('click', () => {
    const nombre = document.getElementById('inputEjercicio').value.trim();
    const series = parseInt(document.getElementById('inputSeries').value);
    if (!nombre || !series) return alert("¡Hey! Completá el nombre y las series.");
    if (!baseDeDatosLocal[diaActivo]) baseDeDatosLocal[diaActivo] = [];
    
    baseDeDatosLocal[diaActivo].push({ 
        nombre, series, 
        repesRealizadas: new Array(series).fill(''), 
        pesosRealizados: new Array(series).fill(''),
        seriesCompletadas: new Array(series).fill(false)
    });
    
    document.getElementById('inputEjercicio').value = ''; document.getElementById('inputSeries').value = '';
    guardarDatosEnNube(); actualizarInterfazDia();
    
    // Ocultamos la burbuja automáticamente después de añadir
    document.getElementById('burbuja-add-ejercicio').classList.remove('visible');
});

document.getElementById('btn-limpiar-checks').addEventListener('click', () => {
    const rutina = baseDeDatosLocal[diaActivo];
    if (!diaActivo || !rutina || rutina.length === 0) return;
    
    if(confirm('¿Seguro que quieres desmarcar todas las series de hoy? Tus pesos anotados no se borrarán.')) {
        rutina.forEach(ej => {
            if(ej.seriesCompletadas) ej.seriesCompletadas = new Array(ej.series).fill(false);
        });
        guardarDatosEnNube();
        actualizarInterfazDia();
    }
});

// ==========================================
// SECCIÓN 7: CRONÓMETRO E ISLA DE DESCANSO
// ==========================================
function formatTime(ms) {
    let secs = Math.floor(ms / 1000);
    return `${String(Math.floor(secs / 3600)).padStart(2,'0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;
}
function formatTimeDescanso(secs) {
    let m = Math.floor(secs / 60);
    let s = secs % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function actualizarDisplayCrono() { document.getElementById('display-cronometro').innerText = formatTime(elapsedTime + (isRunning ? Date.now() - startTime : 0)); }

document.getElementById('btn-comenzar-pausa').addEventListener('click', () => {
    const btn = document.getElementById('btn-comenzar-pausa');
    if (isRunning) { elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false; btn.innerHTML = '▶ REANUDAR'; btn.classList.remove('btn-crono-pausa');
    } else { startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true; btn.innerHTML = '⏸ PAUSAR'; btn.classList.add('btn-crono-pausa'); }
});
document.getElementById('btn-reset-crono').addEventListener('click', () => {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) { clearInterval(timerInterval); isRunning = false; elapsedTime = 0; document.getElementById('btn-comenzar-pausa').innerHTML = '▶ COMENZAR'; document.getElementById('btn-comenzar-pausa').classList.remove('btn-crono-pausa'); actualizarDisplayCrono(); }
});

// Lógica de la Isla de Descanso
function inicializarIslaDescanso() {
    const cronoContainer = document.querySelector('.cronometro-container');
    if (cronoContainer && !document.getElementById('isla-descanso')) {
        const isla = document.createElement('div');
        isla.id = 'isla-descanso';
        isla.className = 'isla-descanso';
        isla.innerHTML = `
            <span id="tiempo-descanso-display">00:00</span>
            <button id="btn-config-descanso" title="Configurar tiempo">⚙️</button>
            <button id="btn-cerrar-descanso" title="Omitir descanso">✖</button>
        `;
        cronoContainer.appendChild(isla);

        document.getElementById('btn-config-descanso').addEventListener('click', () => {
            // Mostramos el valor actual convertido a minutos (ej: 180 segs se muestra como 3)
            let minActuales = tiempoDescansoGlobal / 60;
            let input = prompt(`Configurar descanso en MINUTOS (ej: 3 para tres minutos, 1.5 para un min y medio):\n\nTiempo actual: ${formatTimeDescanso(tiempoDescansoGlobal)}`, minActuales);
            
            if (input !== null && input.trim() !== "") {
                // Reemplazamos coma por punto para evitar errores si escriben "1,5"
                let nuevosMinutos = parseFloat(input.replace(',', '.'));
                
                if (!isNaN(nuevosMinutos) && nuevosMinutos > 0) {
                    tiempoDescansoGlobal = Math.round(nuevosMinutos * 60); // Lo pasamos a segundos para el sistema
                    guardarDatosEnNube();
                    
                    if (document.getElementById('isla-descanso').classList.contains('visible')) {
                        iniciarRestTimer(); 
                    } else {
                        alert(`⏱️ Tiempo de descanso actualizado a ${formatTimeDescanso(tiempoDescansoGlobal)}.`);
                    }
                } else {
                    alert("⚠️ Por favor, ingresa un número válido mayor a 0.");
                }
            }
        });

        document.getElementById('btn-cerrar-descanso').addEventListener('click', () => {
            clearInterval(timerDescansoInterval);
            document.getElementById('isla-descanso').classList.remove('visible');
            document.getElementById('isla-descanso').classList.remove('fin-descanso');
        });
    }
}

function iniciarRestTimer() {
    const isla = document.getElementById('isla-descanso');
    if (!isla) return;
    
    clearInterval(timerDescansoInterval);
    descansoRestante = tiempoDescansoGlobal;
    document.getElementById('tiempo-descanso-display').innerText = formatTimeDescanso(descansoRestante);
    
    isla.classList.remove('fin-descanso');
    isla.classList.add('visible');
    
    timerDescansoInterval = setInterval(() => {
        descansoRestante--;
        document.getElementById('tiempo-descanso-display').innerText = formatTimeDescanso(descansoRestante);
        
        if (descansoRestante <= 0) {
            clearInterval(timerDescansoInterval);
            isla.classList.add('fin-descanso'); 
            // Ocultar automáticamente luego de 4 segundos finalizado el tiempo
            setTimeout(() => {
                isla.classList.remove('visible');
                isla.classList.remove('fin-descanso');
            }, 4000); 
        }
    }, 1000);
}

// ==========================================
// SECCIÓN 8: FLUJO DE VENTANAS E HISTORIAL
// ==========================================
function abrirDia(dia) {
    diaActivo = dia;
    document.getElementById('titulo-dia').innerText = `${dia} de Guerra`;
    document.getElementById('vista-semana').style.display = 'none';
    document.getElementById('vista-cuenta').style.display = 'none';
    document.getElementById('vista-dia').style.display = 'flex';
    document.getElementById('contenedor-motivacion').innerHTML = `<img src="motivacion/${Math.floor(Math.random() * TOTAL_IMAGENES_MOTIVACION) + 1}.jpg" alt="Motivación Gym" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; border: 2px solid var(--accent-neon);">`;
    
    inicializarIslaDescanso(); // Creamos la isla si no existe
    actualizarInterfazDia(); 
    actualizarDisplayCrono();
}

document.getElementById('btn-volver-semana').addEventListener('click', () => { diaActivo = null; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });
document.getElementById('btn-abrir-cuenta').addEventListener('click', () => { document.getElementById('vista-semana').style.display = 'none'; document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'flex'; renderizarHistorial(); });
document.getElementById('btn-volver-desde-cuenta').addEventListener('click', () => { document.getElementById('vista-dia').style.display = 'none'; document.getElementById('vista-cuenta').style.display = 'none'; document.getElementById('vista-semana').style.display = 'flex'; });

document.getElementById('btn-guardar-dia').addEventListener('click', () => {
    if (!diaActivo || !baseDeDatosLocal[diaActivo] || baseDeDatosLocal[diaActivo].length === 0) return alert("No tienes ejercicios cargados hoy para guardar.");
    historialGlobal.unshift({ fecha: new Date().toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' }), diaSemana: diaActivo, rutina: JSON.parse(JSON.stringify(baseDeDatosLocal[diaActivo])), tiempo: document.getElementById('display-cronometro').innerText });
    guardarDatosEnNube(); alert(`¡Día guardado con éxito!\nTiempo: ${document.getElementById('display-cronometro').innerText}`);
});

document.getElementById('btn-reiniciar-semana').addEventListener('click', () => { if(confirm('¿Destruir la semana? Tus récords y el historial se conservan.')) { estadoDias = {}; guardarDatosEnNube(); renderizarSemana(); } });
document.getElementById('btn-reiniciar-historico').addEventListener('click', () => { if(confirm('⚠️ ¿Reiniciar tus días totales de gloria a cero?')) { totalEntrenamientos = 0; guardarDatosEnNube(); renderizarSemana(); } });
document.getElementById('btn-borrar-todo').addEventListener('click', () => { if(confirm('⚠️ ¿Estás seguro de borrar TODO tu historial guardado? Esta acción no se puede deshacer.')) { historialGlobal = []; guardarDatosEnNube(); renderizarHistorial(); alert('Historial borrado con éxito.'); } });

function renderizarHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    if (historialGlobal.length === 0) return contenedor.innerHTML = '<p style="color: var(--text-muted);">Aún no has guardado ningún entrenamiento.</p>';
    contenedor.innerHTML = historialGlobal.map(registro => `
        <div class="tarjeta-historial">
            <div class="fecha-historial">${registro.fecha} <span class="badge-dia">${registro.diaSemana} - ⏱ ${registro.tiempo}</span></div>
            ${registro.rutina.map(ej => `
                <div class="item-historial-ejercicio"><h4>${ej.nombre}</h4><div class="resumen-series">
                    ${Array.from({length: ej.series}).map((_, i) => `<div class="mini-serie">S${i+1}: <strong>${(ej.repesRealizadas && ej.repesRealizadas[i]) || '-'}</strong>x<strong>${(ej.pesosRealizados && ej.pesosRealizados[i]) || '-'}kg</strong></div>`).join('')}
                </div></div>
            `).join('')}
        </div>`).join('');
}












