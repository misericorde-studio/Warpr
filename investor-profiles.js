import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    radius: 1.5,
    particleCount: 1000,
    particleSize: 8.06,
    curveAmplitude: 0.4,
    curveFrequency: 24,
    curvePhases: 8,
    noiseScale: 0.8,
    noisePower: 1.2,
    backgroundColor: 0x0B0E13,
    particleColor: 0x00FEA5,
    particleGlowIntensity: 1.0,
    particleGlowRadius: 0.25,
    particleGlowColor: 0x4FFFC1,
    cameraDistance: 3,
    cameraZoom: 0.8,
    initialZoom: 1.6, // Zoom initial (plus proche)
    finalZoom: 0.8,   // Zoom final (actuel)
    cameraNear: 0.1,
    cameraFar: 1000,
    lineThickness: 1.04
};

// Variables globales
let scene, camera, renderer, controls;
let particles;
let clock;
let container;
let heightVariation = 0.2;
let lineThickness = 0.04;

// Initialisation
function init() {
    // Récupération du conteneur
    container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);

    // Caméra orthographique
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 5;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        config.cameraNear,
        config.cameraFar
    );

    // Positionnement initial de la caméra avec zoom initial
    camera.position.set(0, 0, config.cameraDistance);
    camera.lookAt(0, 0, 0);
    camera.zoom = config.initialZoom;
    camera.updateProjectionMatrix();

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Horloge
    clock = new THREE.Clock();

    // Création des particules
    createParticles();
    
    // Centrer les particules dans la scène
    if (particles) {
        particles.position.set(0, 0, 0);
    }

    // Événements
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('scroll', updateScroll, false);

    // Animation
    animate();
}

// Fonction de bruit 1D simplifiée
function noise1D(x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const fadeX = x * x * (3 - 2 * x);
    
    // Utilisation de fonctions trigonométriques pour générer des valeurs pseudo-aléatoires
    const h1 = Math.sin(X * 12.9898) * 43758.5453123;
    const h2 = Math.sin((X + 1) * 12.9898) * 43758.5453123;
    
    return lerp(h1 - Math.floor(h1), h2 - Math.floor(h2), fadeX);
}

// Interpolation linéaire
function lerp(a, b, t) {
    return a + t * (b - a);
}

// Création des particules
function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);

    // Valeurs fixes au lieu de valeurs aléatoires
    const phaseOffsets = [0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, Math.PI*5/4, Math.PI*3/2, Math.PI*7/4];
    const frequencyMultipliers = [1, 0.5, 0.75, 0.25, 0.6, 0.35, 0.8, 0.45];
    const amplitudeMultipliers = [1, 0.8, 0.6, 0.4, 0.7, 0.5, 0.9, 0.3];

    // Valeurs fixes pour la continuité
    const startValues = new Float32Array(config.curvePhases);
    const endValues = new Float32Array(config.curvePhases);
    for (let phase = 0; phase < config.curvePhases; phase++) {
        startValues[phase] = Math.sin(0 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
        endValues[phase] = Math.sin(Math.PI * 2 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
    }

    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);

        // Distribution régulière pour l'épaisseur
        const radialOffset = ((i % 3) - 1) * lineThickness;
        
        const baseRadius = config.radius + radialOffset;
        const x = Math.cos(angle) * baseRadius;
        const z = Math.sin(angle) * baseRadius;
        
        let y = 0;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            
            let value = Math.sin(angle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            y += value * amp;
        }
        
        // Utilisation d'une fonction déterministe au lieu du bruit aléatoire
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.3;
        y += noiseValue * heightVariation;
        
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        size: config.particleSize,
        color: 0xFFFFFF,
        transparent: true,
        opacity: 1,
        sizeAttenuation: false,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: false,
        map: createParticleTexture()
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Fond transparent
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 64, 64);

    // Cercle net
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Gestion du redimensionnement
function onWindowResize() {
    if (!container) return;
    
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 5;
    
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Fonction pour mettre à jour la rotation en fonction du scroll
function updateScroll() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const scrollProgress = Math.min(90, Math.max(0, (scrolled / scrollHeight) * 100));

    if (particles) {
        // Rotation Y de 0° à -40° entre 0% et 60% de scroll (sens inverse)
        if (scrollProgress <= 60) {
            const rotationY = ((60 - scrollProgress) / 60) * (40 * Math.PI / 180) - (40 * Math.PI / 180);
            particles.rotation.x = 0;
            particles.rotation.y = rotationY;
        }
        // Rotation X de 0° à 90° entre 60% et 90% de scroll
        else {
            const rotationX = ((scrollProgress - 60) / 30) * (90 * Math.PI / 180);
            particles.rotation.y = -(40 * Math.PI / 180); // Maintient la rotation Y à -40°
            particles.rotation.x = rotationX;
        }

        // Calcul du zoom progressif
        const zoomProgress = Math.min(1, scrollProgress / 90);
        const currentZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * zoomProgress;
        
        // Application du zoom à la caméra
        camera.zoom = currentZoom;
        camera.updateProjectionMatrix();

        // S'assurer que le point de pivot reste au centre
        particles.position.set(0, 0, 0);
    }
}

// Animation
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    renderer.render(scene, camera);
}

function updateParticles() {
    if (!particles) return;
    
    const geometry = particles.geometry;
    const positions = geometry.attributes.position.array;

    // Utilisation des mêmes valeurs fixes
    const phaseOffsets = [0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, Math.PI*5/4, Math.PI*3/2, Math.PI*7/4];
    const frequencyMultipliers = [1, 0.5, 0.75, 0.25, 0.6, 0.35, 0.8, 0.45];
    const amplitudeMultipliers = [1, 0.8, 0.6, 0.4, 0.7, 0.5, 0.9, 0.3];

    const startValues = new Float32Array(config.curvePhases);
    const endValues = new Float32Array(config.curvePhases);
    for (let phase = 0; phase < config.curvePhases; phase++) {
        startValues[phase] = Math.sin(0 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
        endValues[phase] = Math.sin(Math.PI * 2 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
    }

    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);

        // Distribution régulière pour l'épaisseur
        const radialOffset = ((i % 3) - 1) * lineThickness;
        
        const baseRadius = config.radius + radialOffset;
        const x = Math.cos(angle) * baseRadius;
        const z = Math.sin(angle) * baseRadius;
        
        let y = 0;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            
            let value = Math.sin(angle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            y += value * amp;
        }
        
        // Utilisation d'une fonction déterministe
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.3;
        y += noiseValue * heightVariation;
        
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    geometry.attributes.position.needsUpdate = true;
}

// Gestionnaires d'événements pour les contrôles
function setupControls() {
    const heightControl = document.getElementById('height-variation');
    const heightValue = document.getElementById('height-value');
    const thicknessControl = document.getElementById('circle-thickness');
    const thicknessValue = document.getElementById('thickness-value');

    heightControl.addEventListener('input', (e) => {
        heightVariation = parseFloat(e.target.value);
        heightValue.textContent = heightVariation.toFixed(2);
        updateParticles();
    });

    thicknessControl.addEventListener('input', (e) => {
        lineThickness = parseFloat(e.target.value);
        thicknessValue.textContent = lineThickness.toFixed(3);
        updateParticles();
    });
}

// Démarrage
document.addEventListener('DOMContentLoaded', init);
