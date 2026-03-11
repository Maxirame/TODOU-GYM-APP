// ==========================================
// SECCIÓN 1: IMPORTACIONES DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
// SECCIÓN 2: ESTADO GLOBAL Y SEGURIDAD
// ==========================================
// SANITIZADOR DE SEGURIDAD (Evita hackeos XSS)
function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag])) : '';
}

const diasDeLaSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TOTAL_IMAGENES_MOTIVACION = 8; 

let baseDeDatosLocal = {};
let estadoDias = {};
let totalEntrenamientos = 0;
let fallosHistoricos = {}; 
let pesosMaximos = {}; 
let historialGlobal = []; 

// VARIABLES SOCIALES REAL-TIME
let miTag = ""; 
let misAmigos = []; 
let solicitudesPendientes = [];
let unsubscribeMisDatos = null; 
let listenersAmigos = {}; 
let datosAmigosEnVivo = {}; 

let diaActivo = null;
let startTime, elapsedTime = 0, timerInterval, isRunning = false;
let tiempoDescansoGlobal = 180; 
let timerDescansoInterval;
let descansoRestante = 0;

const infoEjercicios = {
    "Press Banca": { youtubeId: "TAH8RxOS0VI" },
    "Press Banca Mancuernas": { youtubeId: "TAH8RxOS0VI" },
    "Press Inclinado": { youtubeId: "-zbesyTNztQ" },
    "Press Inclinado Mancuernas": { youtubeId: "-zbesyTNztQ" },
    "Apertura Mancuernas": { youtubeId: "OtW0EYqBczI" },
    "Press Frances": { youtubeId: "L3bEz-vcdGU" },
    "Extensiones Tricep": { youtubeId: "" },
    "Dominadas": { youtubeId: "BT3CSQKeEww" },
    "Dominadas Neutras": { youtubeId: "" },
    "Dominadas Supino": { youtubeId: "" },
    "Curl Predicador Mancuernas": { youtubeId: "" },
    "Curl Predicador": { youtubeId: "" },
    "Curl 21": { youtubeId: "" },
    "Press Militar": { youtubeId: "DdITN8U-kFI" },
    "Elevaciones Laterales": { youtubeId: "UQkdNBpjFDo" },
    "Elevaciones Frontales": { youtubeId: "HciAFZSN2Qo" }
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
            tiempoDescansoGlobal,
            nombre: document.getElementById('nombre-usuario').innerText,
            tag: miTag,
            misAmigos
        }, { merge: true });
    } catch (e) { console.warn("Modo local activo"); }
}

async function cargarDatosDeNube(uid) {
    const docRef = doc(db, "usuarios", uid);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        miTag = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('nombre-usuario').innerText = auth.currentUser.displayName ? auth.currentUser.displayName.split(" ")[0] : "Atleta";
        document.getElementById('tag-usuario').innerText = `#${miTag}`;
        await guardarDatosEnNube();
    }

    if(unsubscribeMisDatos) unsubscribeMisDatos();
    unsubscribeMisDatos = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            baseDeDatosLocal = data.baseDeDatosLocal || {}; estadoDias = data.estadoDias || {};
            totalEntrenamientos = data.totalEntrenamientos || 0; fallosHistoricos = data.fallosHistoricos || {};
            pesosMaximos = data.pesosMaximos || {}; historialGlobal = data.historialGlobal || [];
            tiempoDescansoGlobal = data.tiempoDescansoGlobal || 180; 
            
            misAmigos = data.misAmigos || [];
            solicitudesPendientes = data.solicitudesPendientes || [];
            miTag = data.tag || "0000";
            
            document.getElementById('nombre-usuario').innerText = data.nombre || "Atleta";
            document.getElementById('tag-usuario').innerText = `#${miTag}`;
            document.getElementById('titulo-perfil-nombre').innerText = data.nombre || "Atleta";
            document.getElementById('letra-avatar').innerText = (data.nombre || "A").charAt(0).toUpperCase();

            renderizarSemana();
            if(typeof renderizarSolicitudes === 'function') renderizarSolicitudes();
            if(typeof escucharAmigos === 'function') escucharAmigos();
        }
    });

    updateDoc(docRef, { estadoSocial: 'online', ultimaConexion: Date.now() }).catch(e=>console.log(e));
    
    if(typeof activarEscuchaDeLlamadas === 'function') activarEscuchaDeLlamadas();
}

window.addEventListener('beforeunload', () => {
    if(auth.currentUser) {
        updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'offline', ultimaConexion: Date.now() });
    }
});

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
                        <button class="btn-eliminar-serie" data-ej="${idx}" data-serie="${i}" title="Eliminar Serie"><i class="ph ph-trash"></i></button>
                    </div>
                    <div class="caja-serie ${isCompleted}">
                        <span class="numero-serie">S${i + 1}</span>
                        <div class="inputs-fila">
                            <input type="number" class="input-datos input-repes" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${escapeHTML(r)}">
                            <span class="etiqueta-x">x</span>
                            <input type="number" class="input-datos input-peso" data-ej="${idx}" data-serie="${i}" placeholder="-" value="${escapeHTML(p)}">
                            <span class="etiqueta-kg">kg</span>
                        </div>
                        <button class="btn-check-serie" data-ej="${idx}" data-serie="${i}"><i class="ph ph-check"></i></button>
                    </div>
                </div>`;
        }
        
        htmlSeries += `
            <button class="btn-add-serie" data-ej="${idx}"><i class="ph ph-plus"></i> Agregar Serie</button>
        `;
        
        const prReps = fallosHistoricos[ej.nombre] || '--';
        const prPeso = pesosMaximos[ej.nombre] || '--';
        const infoTecnica = infoEjercicios[ej.nombre] || {};
        
        const htmlBack = infoTecnica.youtubeId ? `
            <div class="header-back-carta">
                <h4 style="color: var(--accent-neon); margin: 0; font-size: 14px; text-transform: uppercase;">Técnica Correcta</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver"><i class="ph ph-x"></i></button>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-top: 5px;">
                <iframe width="100%" height="200" src="https://www.youtube.com/embed/${escapeHTML(infoTecnica.youtubeId)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px; border: 1px solid var(--border-color);"></iframe>
            </div>
        ` : `
            <div class="header-back-carta">
                <h4 style="color: var(--text-muted); margin: 0; font-size: 14px; text-transform: uppercase;">Sin Información</h4>
                <button class="btn-cerrar-back btn-flip-back" data-ej="${idx}" title="Volver"><i class="ph ph-x"></i></button>
            </div>
            <p style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">Aún no has cargado un enlace de YouTube para este ejercicio.</p>
        `;

        return `
            <div class="ejercicio-flip-container">
                <div class="ejercicio-card-inner" id="card-inner-${idx}">
                    <div class="ejercicio-card-front ejercicio-item">
                        <div class="ejercicio-header-top">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h4 class="titulo-ejercicio">${escapeHTML(ej.nombre)}</h4>
                                <button class="btn-info-carta btn-flip" data-ej="${idx}" title="Ver Técnica"><i class="ph ph-info"></i></button>
                            </div>
                            <button class="btn-eliminar btn-borrar-ejercicio" data-ej="${idx}" title="Eliminar Ejercicio"><i class="ph ph-x"></i></button>
                        </div>
                        <div class="badge-pr" id="pr-${idx}"><i class="ph-fill ph-trophy"></i> Fallo: ${prPeso}kg x ${prReps} repes</div>
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
    if (e.target.classList.contains('btn-borrar-ejercicio') || e.target.closest('.btn-borrar-ejercicio')) {
        const btn = e.target.classList.contains('btn-borrar-ejercicio') ? e.target : e.target.closest('.btn-borrar-ejercicio');
        if(confirm('¿Borrar este ejercicio del día?')) {
            baseDeDatosLocal[diaActivo].splice(btn.getAttribute('data-ej'), 1);
            guardarDatosEnNube(); actualizarInterfazDia();
        }
    }
    
    if (e.target.classList.contains('btn-flip') || e.target.closest('.btn-flip')) {
        const btn = e.target.classList.contains('btn-flip') ? e.target : e.target.closest('.btn-flip');
        const ejIdx = btn.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.add('flipped');
    }
    if (e.target.classList.contains('btn-flip-back') || e.target.closest('.btn-flip-back')) {
        const btn = e.target.classList.contains('btn-flip-back') ? e.target : e.target.closest('.btn-flip-back');
        const ejIdx = btn.getAttribute('data-ej');
        document.getElementById(`card-inner-${ejIdx}`).classList.remove('flipped');
    }
    
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

    if (e.target.classList.contains('btn-add-serie') || e.target.closest('.btn-add-serie')) {
        const btn = e.target.classList.contains('btn-add-serie') ? e.target : e.target.closest('.btn-add-serie');
        const ejIdx = btn.getAttribute('data-ej');
        const ej = baseDeDatosLocal[diaActivo][ejIdx];
        
        ej.series++;
        if (!ej.repesRealizadas) ej.repesRealizadas = [];
        if (!ej.pesosRealizados) ej.pesosRealizados = [];
        if (!ej.seriesCompletadas) ej.seriesCompletadas = [];
        
        ej.repesRealizadas.push('');
        ej.pesosRealizados.push('');
        ej.seriesCompletadas.push(false);
        
        guardarDatosEnNube();
        actualizarInterfazDia();
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
                    badge.innerHTML = `<i class="ph-fill ph-trophy"></i> Fallo: ${currentPeso}kg x ${currentReps} repes`;
                    badge.style.color = "var(--success-green)";
                    setTimeout(() => { badge.style.color = "var(--text-muted)"; }, 1500);
                }
            }
        }
        guardarDatosEnNube();
    }
});

// LÓGICA DE GESTOS SWIPE FLUIDOS
let swipeStartX = 0;
let swipeStartY = 0;
let currentTranslate = 0;
let swipeActiveEl = null;
let isDragging = false;

const iniciarSwipe = (e, elemento) => {
    if (e.type === 'mousedown' && e.button !== 0) return; 
    if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;

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

listaUI.addEventListener('touchstart', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')), {passive: true});
listaUI.addEventListener('touchmove', moverSwipe, {passive: false});
listaUI.addEventListener('touchend', finalizarSwipe);
listaUI.addEventListener('mousedown', (e) => iniciarSwipe(e, e.target.closest('.caja-serie')));
listaUI.addEventListener('mousemove', moverSwipe);
listaUI.addEventListener('mouseup', finalizarSwipe);
listaUI.addEventListener('mouseleave', finalizarSwipe);

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
    if (isRunning) { 
        elapsedTime += Date.now() - startTime; clearInterval(timerInterval); isRunning = false; 
        btn.innerHTML = '<i class="ph-fill ph-play"></i> REANUDAR'; btn.classList.remove('btn-crono-pausa');
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'online' }); 
    } else { 
        startTime = Date.now(); timerInterval = setInterval(actualizarDisplayCrono, 1000); isRunning = true; 
        btn.innerHTML = '<i class="ph-fill ph-pause"></i> PAUSAR'; btn.classList.add('btn-crono-pausa'); 
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'entrenando' }); 
    }
});
document.getElementById('btn-reset-crono').addEventListener('click', () => {
    if(confirm('¿Seguro que querés reiniciar el tiempo a cero?')) { 
        clearInterval(timerInterval); isRunning = false; elapsedTime = 0; 
        document.getElementById('btn-comenzar-pausa').innerHTML = '<i class="ph-fill ph-play"></i> COMENZAR'; 
        document.getElementById('btn-comenzar-pausa').classList.remove('btn-crono-pausa'); actualizarDisplayCrono(); 
        if(auth.currentUser) updateDoc(doc(db, "usuarios", auth.currentUser.uid), { estadoSocial: 'online' });
    }
});

function inicializarIslaDescanso() {
    const cronoContainer = document.querySelector('.cronometro-container');
    if (cronoContainer && !document.getElementById('isla-descanso')) {
        const isla = document.createElement('div');
        isla.id = 'isla-descanso';
        isla.className = 'isla-descanso';
        isla.innerHTML = `
            <span id="tiempo-descanso-display">00:00</span>
            <button id="btn-config-descanso" title="Configurar tiempo"><i class="ph-fill ph-gear"></i></button>
            <button id="btn-cerrar-descanso" title="Omitir descanso"><i class="ph-fill ph-x-circle"></i></button>
        `;
        cronoContainer.appendChild(isla);

        document.getElementById('btn-config-descanso').addEventListener('click', () => {
            let minActuales = tiempoDescansoGlobal / 60;
            let input = prompt(`Configurar descanso en MINUTOS:\n\nTiempo actual: ${formatTimeDescanso(tiempoDescansoGlobal)}`, minActuales);
            if (input !== null && input.trim() !== "") {
                let nuevosMinutos = parseFloat(input.replace(',', '.'));
                if (!isNaN(nuevosMinutos) && nuevosMinutos > 0) {
                    tiempoDescansoGlobal = Math.round(nuevosMinutos * 60); 
                    guardarDatosEnNube();
                    if (document.getElementById('isla-descanso').classList.contains('visible')) iniciarRestTimer(); 
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
            setTimeout(() => { isla.classList.remove('visible'); isla.classList.remove('fin-descanso'); }, 4000); 
        }
    }, 1000);
}

/* ==========================================
   SECCIÓN 8: LAYOUT Y CARTAS 3D (FLIP)
   ========================================== */
.layout-dia { display: flex; gap: 25px; flex: 1; overflow: hidden; width: 100%; min-height: 0;}
.columna-fija { width: 330px; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; padding-right: 5px; min-height: 0;}
.columna-scroll { flex: 1; display: flex; flex-direction: column; background: transparent; overflow: hidden; min-height: 0;}

#listaEjerciciosUI { flex: 1; overflow-y: auto; padding-right: 15px; margin-top: 5px; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; align-content: start; padding-bottom: 20px;}

.ejercicio-flip-container { perspective: 1200px; width: 100%; }
.ejercicio-card-inner { position: relative; width: 100%; height: 100%; display: grid; transition: transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; }
.ejercicio-card-inner.flipped { transform: rotateY(180deg); }
.ejercicio-card-front, .ejercicio-card-back { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; width: 100%; height: 100%; }
.ejercicio-card-front { transform: rotateY(0deg); }
.ejercicio-card-back { transform: rotateY(180deg); display: flex; flex-direction: column; }

/* Tarjetas de Ejercicios Liquid Glass */
.ejercicio-item { 
    background: linear-gradient(145deg, #1e1e22 0%, #151518 100%);
    padding: 20px; border-radius: 20px; border: var(--glass-border); 
    box-shadow: 0 15px 35px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05);
}
.ejercicio-header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.titulo-ejercicio { font-size: 18px; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px; margin: 0; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,0.5);}
.badge-pr { font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 5px; font-weight: 700; margin-bottom: 15px; transition: color 0.3s;}

/* CAMBIO: Botón de info siempre amarillo por defecto */
.btn-info-carta { 
    background: linear-gradient(145deg, #eaff4d 0%, #b8d11c 100%); border: none; color: #000; 
    border-radius: 50%; width: 26px; height: 26px; font-size: 16px; font-weight: 900; transition: 0.3s; flex-shrink: 0; padding:0; display:flex; align-items:center; justify-content:center;
    box-shadow: 0 4px 10px rgba(217, 245, 34, 0.4), inset 0 1px 2px rgba(255,255,255,0.3);
}
.btn-info-carta:hover { transform: scale(1.15); box-shadow: 0 5px 15px rgba(217, 245, 34, 0.6);}

.header-back-carta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.btn-cerrar-back { background: rgba(255,255,255,0.1); color: var(--text-main); border: 1px solid rgba(255,255,255,0.2); font-size: 16px; border-radius: 50%; width: 32px; height: 32px; transition: 0.3s; padding:0; display:flex; align-items:center; justify-content:center;}
.btn-cerrar-back:hover { background: rgba(255,255,255,0.2); color: #fff; transform: scale(1.1); }

/* CORRECCIÓN: Se arregla el nombre de la clase para la X */
.btn-borrar-ejercicio { background: transparent; border: none; color: var(--text-muted); font-size: 20px; transition: 0.2s; padding: 0; display: flex; justify-content: center; align-items: center; cursor: pointer;}
.btn-borrar-ejercicio:hover { color: var(--danger); transform: scale(1.1); }
};

// ==========================================
// SECCIÓN 9: RED SOCIAL Y MOTOR EN TIEMPO REAL
// ==========================================
document.getElementById('btn-add-amigo').addEventListener('click', async () => {
    let input = prompt("Añade a tu compañero de entreno\n\nIngresa su nombre y tag exactos (Ejemplo: Maxi #3423):");
    if (!input || !input.includes('#')) return;

    let partes = input.split('#');
    let nombreBuscado = partes[0].trim();
    let tagBuscado = partes[1].trim();

    if (nombreBuscado.toLowerCase() === document.getElementById('nombre-usuario').innerText.toLowerCase() && tagBuscado === miTag) {
        return alert("⚠️ Eres un lobo solitario, pero no puedes agregarte a ti mismo.");
    }

    try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("nombre", "==", nombreBuscado), where("tag", "==", tagBuscado));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("❌ No se encontró al atleta. Revisa mayúsculas y minúsculas.");
        } else {
            querySnapshot.forEach(async (docSnap) => {
                const amigoId = docSnap.id;

                if (misAmigos.some(a => a.uid === amigoId)) return alert("⚠️ Ya son amigos.");

                const yo = { uid: auth.currentUser.uid, nombre: document.getElementById('nombre-usuario').innerText, tag: miTag };
                await updateDoc(doc(db, "usuarios", amigoId), {
                    solicitudesPendientes: arrayUnion(yo)
                });

                alert(`✅ Solicitud enviada a ${escapeHTML(nombreBuscado)}. Esperando a que acepte...`);
            });
        }
    } catch (error) { console.error(error); }
});

document.getElementById('btn-ver-solicitudes').addEventListener('click', () => {
    const panel = document.getElementById('panel-solicitudes');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

function renderizarSolicitudes() {
    const lista = document.getElementById('lista-solicitudes');
    const badge = document.getElementById('badge-notif');
    
    if (solicitudesPendientes.length > 0) {
        badge.style.display = 'block';
        lista.innerHTML = solicitudesPendientes.map((sol, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:5px;">
                <span style="font-size:12px; font-weight:700;">${escapeHTML(sol.nombre)} <span style="color:var(--text-muted); font-weight:400;">#${escapeHTML(sol.tag)}</span></span>
                <div style="display:flex; gap:8px;">
                    <button class="btn-aceptar-sol" data-idx="${idx}" style="background:var(--success-green); color:#000; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:800;"><i class="ph ph-check" style="pointer-events:none;"></i></button>
                    <button class="btn-rechazar-sol" data-idx="${idx}" style="background:var(--danger); color:#fff; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:800;"><i class="ph ph-x" style="pointer-events:none;"></i></button>
                </div>
            </div>
        `).join('');
    } else {
        badge.style.display = 'none';
        document.getElementById('panel-solicitudes').style.display = 'none'; 
        lista.innerHTML = '';
    }
}

document.getElementById('panel-solicitudes').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-aceptar-sol')) {
        const idx = e.target.getAttribute('data-idx');
        const amigoData = solicitudesPendientes[idx];
        
        solicitudesPendientes.splice(idx, 1);
        misAmigos.push(amigoData);
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { solicitudesPendientes, misAmigos });

        const yo = { uid: auth.currentUser.uid, nombre: document.getElementById('nombre-usuario').innerText, tag: miTag };
        await updateDoc(doc(db, "usuarios", amigoData.uid), { misAmigos: arrayUnion(yo) });
        
        alert(`🤝 ¡Tú y ${escapeHTML(amigoData.nombre)} ahora son compañeros de entreno!`);
    }

    if (e.target.classList.contains('btn-rechazar-sol')) {
        const idx = e.target.getAttribute('data-idx');
        solicitudesPendientes.splice(idx, 1);
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { solicitudesPendientes });
    }
});

function escucharAmigos() {
    misAmigos.forEach(amigo => {
        if (!listenersAmigos[amigo.uid]) {
            listenersAmigos[amigo.uid] = onSnapshot(doc(db, "usuarios", amigo.uid), (docSnap) => {
                if (docSnap.exists()) {
                    datosAmigosEnVivo[amigo.uid] = docSnap.data(); 
                    renderizarAmigos(); 
                }
            });
        }
    });
    renderizarAmigos();
}

function renderizarAmigos() {
    const contenedor = document.getElementById('lista-amigos');
    if (!contenedor) return;
    
    if (misAmigos.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:20px;">Aún no tienes compañeros de batalla.</p>';
        return;
    }

    contenedor.innerHTML = misAmigos.map(amigo => {
        const dataVivo = datosAmigosEnVivo[amigo.uid] || {};
        const estado = dataVivo.estadoSocial || 'offline';
        const ultConexion = dataVivo.ultimaConexion || 0;
        
        let textoEstado = "";
        let claseEstado = "offline";
        
        if (estado === 'online') {
            textoEstado = "Online"; claseEstado = "online";
        } else if (estado === 'entrenando') {
            textoEstado = "Entrenando..."; claseEstado = "entrenando";
        } else {
            if(ultConexion > 0) {
                const diffMs = Date.now() - ultConexion;
                const mins = Math.floor(diffMs / 60000);
                const horas = Math.floor(mins / 60);
                const dias = Math.floor(horas / 24);
                
                if (dias > 0) textoEstado = `hace ${dias}d`;
                else if (horas > 0) textoEstado = `hace ${horas}h`;
                else if (mins > 0) textoEstado = `hace ${mins}m`;
                else textoEstado = "Desconectado";
            } else {
                textoEstado = "Desconectado";
            }
            claseEstado = "offline";
        }

        return `
        <div class="amigo-item ${claseEstado}"> 
            <div class="amigo-avatar">${escapeHTML(amigo.nombre).charAt(0).toUpperCase()}</div>
            <div class="amigo-info">
                <span class="amigo-nombre">${escapeHTML(amigo.nombre)} <span class="amigo-tag">#${escapeHTML(amigo.tag)}</span></span>
                <span class="amigo-estado">${textoEstado}</span>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="btn-llamar" title="Entrenar Juntos"><i class="ph-fill ph-video-camera" style="pointer-events:none;"></i></button>
                <button class="btn-eliminar-amigo" data-uid="${amigo.uid}" title="Eliminar Amigo"><i class="ph ph-user-minus" style="pointer-events:none;"></i></button>
            </div>
        </div>
        `;
    }).join('');
}

document.getElementById('lista-amigos').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-llamar') || e.target.closest('.btn-llamar')) {
        const item = e.target.closest('.amigo-item');
        const amigoUid = item.querySelector('.btn-eliminar-amigo').getAttribute('data-uid');
        const amigoNombre = item.querySelector('.amigo-nombre').childNodes[0].nodeValue.trim(); 
        
        if(typeof iniciarLlamada === 'function') iniciarLlamada(amigoUid, amigoNombre);
    }

    if (e.target.classList.contains('btn-eliminar-amigo') || e.target.closest('.btn-eliminar-amigo')) {
        const btn = e.target.classList.contains('btn-eliminar-amigo') ? e.target : e.target.closest('.btn-eliminar-amigo');
        const amigoUid = btn.getAttribute('data-uid');
        if (confirm('¿Seguro que quieres eliminar a este compañero de tu lista?')) {
            misAmigos = misAmigos.filter(a => a.uid !== amigoUid);
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { misAmigos });
            try {
                const amigoRef = doc(db, "usuarios", amigoUid);
                const amigoSnap = await getDoc(amigoRef);
                if (amigoSnap.exists()) {
                    let amigosDeMiAmigo = amigoSnap.data().misAmigos || [];
                    amigosDeMiAmigo = amigosDeMiAmigo.filter(a => a.uid !== auth.currentUser.uid);
                    await updateDoc(amigoRef, { misAmigos: amigosDeMiAmigo });
                }
            } catch (error) { console.error(error); }

            if (listenersAmigos[amigoUid]) {
                listenersAmigos[amigoUid](); 
                delete listenersAmigos[amigoUid];
                delete datosAmigosEnVivo[amigoUid];
            }
            renderizarAmigos();
        }
    }
});

// ==========================================
// SECCIÓN 10: MOTOR DE VIDEOLLAMADAS (WEBRTC)
// ==========================================
const servidoresG = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

let pc = null;
let localStream = null;
let remoteStream = null;
let currentCallDocId = null;
let unsubscribeLlamadasEntrantes = null;
let unsubscribeCall = null;

const videoLocal = document.getElementById('video-local');
const videoRemoto = document.getElementById('video-remoto');
const modalEntrante = document.getElementById('modal-llamada-entrante');
const salaVideo = document.getElementById('sala-video');

async function configurarCamara() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        remoteStream = new MediaStream();
        videoLocal.srcObject = localStream;
        videoRemoto.srcObject = remoteStream;
    } catch (err) {
        alert("⚠️ Necesitas dar permisos de cámara y micrófono a tu navegador para entrenar juntos.");
        throw err;
    }
}

function crearConexion() {
    pc = new RTCPeerConnection(servidoresG);
    
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };
}

async function iniciarLlamada(amigoUid, amigoNombre) {
    alert(`Llamando a ${escapeHTML(amigoNombre)}... Enciende tu cámara.`);
    await configurarCamara();
    salaVideo.classList.remove('oculto');
    crearConexion();

    const callDocRef = doc(collection(db, "llamadas"));
    const offerCandidatesRef = collection(callDocRef, "offerCandidates");
    const answerCandidatesRef = collection(callDocRef, "answerCandidates");

    currentCallDocId = callDocRef.id;

    pc.onicecandidate = event => {
        if(event.candidate) addDoc(offerCandidatesRef, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const callData = {
        callerId: auth.currentUser.uid,
        callerName: document.getElementById('nombre-usuario').innerText,
        calleeId: amigoUid,
        offer: { type: offerDescription.type, sdp: offerDescription.sdp }
    };

    await setDoc(callDocRef, callData);

    unsubscribeCall = onSnapshot(callDocRef, (docSnap) => {
        const data = docSnap.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
        if (!docSnap.exists()) colgarLlamada(); 
    });

    onSnapshot(answerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

function activarEscuchaDeLlamadas() {
    if(unsubscribeLlamadasEntrantes) unsubscribeLlamadasEntrantes();
    
    const q = query(collection(db, "llamadas"), where("calleeId", "==", auth.currentUser.uid));
    
    unsubscribeLlamadasEntrantes = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const callData = change.doc.data();
                currentCallDocId = change.doc.id;
                document.getElementById('texto-llamante').innerText = `${escapeHTML(callData.callerName)} te está llamando para entrenar...`;
                modalEntrante.classList.remove('oculto');
            }
            if (change.type === "removed") {
                modalEntrante.classList.add('oculto');
                if (currentCallDocId === change.doc.id) colgarLlamada(false); 
            }
        });
    });
}

document.getElementById('btn-aceptar-llamada').addEventListener('click', async () => {
    modalEntrante.classList.add('oculto');
    await configurarCamara();
    salaVideo.classList.remove('oculto');
    crearConexion();

    const callDocRef = doc(db, "llamadas", currentCallDocId);
    const answerCandidatesRef = collection(callDocRef, "answerCandidates");
    const offerCandidatesRef = collection(callDocRef, "offerCandidates");

    pc.onicecandidate = event => {
        if(event.candidate) addDoc(answerCandidatesRef, event.candidate.toJSON());
    };

    const callDocSnap = await getDoc(callDocRef);
    const callData = callDocSnap.data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    await updateDoc(callDocRef, {
        answer: { type: answerDescription.type, sdp: answerDescription.sdp }
    });

    onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    unsubscribeCall = onSnapshot(callDocRef, (docSnap) => {
        if (!docSnap.exists()) colgarLlamada();
    });
});

document.getElementById('btn-rechazar-llamada').addEventListener('click', () => {
    modalEntrante.classList.add('oculto');
    if(currentCallDocId) deleteDoc(doc(db, "llamadas", currentCallDocId));
    currentCallDocId = null;
});

document.getElementById('btn-colgar').addEventListener('click', () => colgarLlamada(true));

async function colgarLlamada(borrarDoc = true) {
    salaVideo.classList.add('oculto');
    modalEntrante.classList.add('oculto');
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    if (pc) {
        pc.close();
        pc = null;
    }
    if (unsubscribeCall) {
        unsubscribeCall();
        unsubscribeCall = null;
    }
    if (borrarDoc && currentCallDocId) {
        await deleteDoc(doc(db, "llamadas", currentCallDocId));
    }
    currentCallDocId = null;
}



