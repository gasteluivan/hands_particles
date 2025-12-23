// Doctor Strange Magic Particles - Main Script v1.0.2
const APP_VERSION = '1.0.2';
console.log(`Magic Particles v${APP_VERSION}`);

// ============================================
// CONFIGURACIÓN - Expansión masiva + colores aleatorios
// ============================================
const isMobile = window.innerWidth < 768;

const CONFIG = {
    particleCount: isMobile ? 1000 : 1500,
    baseRadius: 1.8,
    minRadius: 0.4,
    maxRadius: 12.0,  // 5x más grande para efecto universo
    lerpSpeed: 0.08,
    rotationLerpSpeed: 0.1,
    positionLerpSpeed: 0.12,
    particleSize: isMobile ? 1.8 : 2.2,
};

// ============================================
// VARIABLES GLOBALES
// ============================================
let scene, camera, renderer;
let particles, particleGeometry, particleMaterial;
let originalPositions = [];
let currentRadius = CONFIG.baseRadius;
let targetRadius = CONFIG.baseRadius;
let currentRotation = { x: 0, y: 0, z: 0 };
let targetRotation = { x: 0, y: 0, z: 0 };
let currentPosition = { x: 0, y: 0, z: 0 };
let targetPosition = { x: 0, y: 0, z: 0 };
let handDetected = false;
let handOpenness = 0.5;
let particleSpeed = 1.0;
let time = 0;

// ============================================
// THREE.JS SETUP
// ============================================
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.z = 6;

    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "low-power"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    createParticles();
    window.addEventListener('resize', onWindowResize);
}

// Generar color aleatorio vibrante
function getRandomColor() {
    const hue = Math.random(); // 0-1 para todo el espectro
    const saturation = 0.7 + Math.random() * 0.3; // 70-100% saturación
    const lightness = 0.5 + Math.random() * 0.3; // 50-80% luminosidad

    const color = new THREE.Color();
    color.setHSL(hue, saturation, lightness);
    return color;
}

function createParticles() {
    particleGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    const sizes = new Float32Array(CONFIG.particleCount);
    const randoms = new Float32Array(CONFIG.particleCount);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / CONFIG.particleCount);
        const theta = Math.sqrt(CONFIG.particleCount * Math.PI) * phi;
        const radiusVariation = 0.8 + Math.random() * 0.4;

        const x = Math.cos(theta) * Math.sin(phi) * radiusVariation;
        const y = Math.sin(theta) * Math.sin(phi) * radiusVariation;
        const z = Math.cos(phi) * radiusVariation;

        originalPositions.push({ x, y, z });

        positions[i * 3] = x * CONFIG.baseRadius;
        positions[i * 3 + 1] = y * CONFIG.baseRadius;
        positions[i * 3 + 2] = z * CONFIG.baseRadius;

        // Color completamente aleatorio
        const randomColor = getRandomColor();
        colors[i * 3] = randomColor.r;
        colors[i * 3 + 1] = randomColor.g;
        colors[i * 3 + 2] = randomColor.b;

        sizes[i] = CONFIG.particleSize * (0.3 + Math.random() * 0.7);
        randoms[i] = Math.random() * Math.PI * 2;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

    // Shader con glow reducido
    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uSpeed: { value: 1.0 }
        },
        vertexShader: `
            attribute float size;
            attribute float random;
            varying vec3 vColor;
            varying float vAlpha;
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uSpeed;

            void main() {
                vColor = color;
                
                vec3 pos = position;
                float wave = sin(uTime * uSpeed * 1.5 + random * 6.28) * 0.03 * uSpeed;
                pos += normalize(pos) * wave;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                
                float sizeAtten = size * uPixelRatio * (120.0 / -mvPosition.z);
                float pulse = 1.0 + sin(uTime * 2.0 + random * 6.28) * 0.1 * uSpeed;
                
                vAlpha = 0.5 + 0.3 * (1.0 / (1.0 + abs(mvPosition.z) * 0.15));
                
                gl_PointSize = max(1.0, sizeAtten * pulse);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                if (dist > 0.5) discard;
                
                // Glow más suave y menos intenso
                float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                alpha = pow(alpha, 1.2);
                
                // Sin glow adicional, solo el color base
                vec3 finalColor = vColor * 0.85;
                
                gl_FragColor = vec4(finalColor, alpha * vAlpha * 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

// ============================================
// MEDIAPIPE HANDS
// ============================================
async function initMediaPipe() {
    const video = document.getElementById('webcam');
    const status = document.getElementById('status');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = stream;

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onHandResults);

        const cam = new Camera(video, {
            onFrame: async () => await hands.send({ image: video }),
            width: 640,
            height: 480
        });

        await cam.start();

        document.getElementById('loading').style.display = 'none';
        status.textContent = '¡Listo! Muestra tu mano';

    } catch (error) {
        console.error('Error:', error);
        status.textContent = 'Error: ' + error.message;
        document.getElementById('loading').textContent = '¡Se requiere cámara!';
    }
}

function onHandResults(results) {
    const status = document.getElementById('status');

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const lm = results.multiHandLandmarks[0];

        const palmBase = lm[0];
        const avgDist = (
            distance3D(lm[4], palmBase) +
            distance3D(lm[8], palmBase) +
            distance3D(lm[12], palmBase) +
            distance3D(lm[16], palmBase) +
            distance3D(lm[20], palmBase)
        ) / 5;

        handOpenness = Math.min(1, Math.max(0, (avgDist - 0.1) / 0.25));
        targetRadius = CONFIG.minRadius + (CONFIG.maxRadius - CONFIG.minRadius) * handOpenness;
        particleSpeed = 1.5 - handOpenness * 1.0;

        const palm = lm[9];
        targetPosition.x = -(palm.x - 0.5) * 4;
        targetPosition.y = -(palm.y - 0.5) * 3;
        targetPosition.z = -palm.z * 2;

        const dx = lm[17].x - lm[5].x;
        const dy = lm[17].y - lm[5].y;
        targetRotation.z = Math.atan2(dy, dx);
        targetRotation.y = (palm.x - 0.5) * 0.5;

        status.textContent = `Mano | Apertura: ${(handOpenness * 100).toFixed(0)}%`;
    } else {
        handDetected = false;
        targetRadius = CONFIG.baseRadius;
        targetPosition.x = targetPosition.y = targetPosition.z = 0;
        targetRotation.z = targetRotation.y = 0;
        particleSpeed = 1.0;
        status.textContent = 'Sin mano detectada';
    }
}

function distance3D(p1, p2) {
    return Math.sqrt(
        (p1.x - p2.x) ** 2 +
        (p1.y - p2.y) ** 2 +
        (p1.z - p2.z) ** 2
    );
}

// ============================================
// LOOP DE ANIMACIÓN
// ============================================
function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    currentRadius += (targetRadius - currentRadius) * CONFIG.lerpSpeed;
    currentRotation.x += (targetRotation.x - currentRotation.x) * CONFIG.rotationLerpSpeed;
    currentRotation.y += (targetRotation.y - currentRotation.y) * CONFIG.rotationLerpSpeed;
    currentRotation.z += (targetRotation.z - currentRotation.z) * CONFIG.rotationLerpSpeed;
    currentPosition.x += (targetPosition.x - currentPosition.x) * CONFIG.positionLerpSpeed;
    currentPosition.y += (targetPosition.y - currentPosition.y) * CONFIG.positionLerpSpeed;
    currentPosition.z += (targetPosition.z - currentPosition.z) * CONFIG.positionLerpSpeed;

    const positions = particleGeometry.attributes.position.array;
    const randoms = particleGeometry.attributes.random.array;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const orig = originalPositions[i];
        const r = randoms[i];
        const turb = particleSpeed * 0.04;

        positions[i * 3] = (orig.x + Math.sin(time * 2 + r) * turb) * currentRadius;
        positions[i * 3 + 1] = (orig.y + Math.cos(time * 2.5 + r * 1.3) * turb) * currentRadius;
        positions[i * 3 + 2] = (orig.z + Math.sin(time * 1.8 + r * 0.7) * turb) * currentRadius;
    }

    particleGeometry.attributes.position.needsUpdate = true;

    particles.rotation.set(
        currentRotation.x,
        currentRotation.y + time * 0.05,
        currentRotation.z
    );
    particles.position.set(currentPosition.x, currentPosition.y, currentPosition.z);

    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uSpeed.value = particleSpeed;

    renderer.render(scene, camera);
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
    initThreeJS();
    await initMediaPipe();
    animate();
}

init();
