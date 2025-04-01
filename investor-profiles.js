import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    radius: 1.5,
    particleCount: 2600,
    particleSize: 6.70,
    curveAmplitude: 0.4,
    curveFrequency: 9,
    curvePhases: 4,
    noiseScale: 0.8,
    noisePower: 1.2,
    backgroundColor: 0x0B0E13,
    particleColor: 0x00FEA5,
    particleGlowIntensity: 1.0,
    particleGlowRadius: 0.25,
    particleGlowColor: 0x4FFFC1,
    cameraDistance: -3,
    initialZoom: 1.6,
    finalZoom: 0.8,
    cameraNear: 1,
    cameraFar: 3,
    initialFar: 3,
    finalFar: 4.5,
    // Configuration de la bordure
    borderWidth: 0.4,        // Largeur de la bordure
    borderParticleCount: 2000, // Nombre de particules dans la bordure
    borderParticleMaxSize: 12.0,  // Taille maximale des particules de la bordure (près du cercle)
    borderParticleMinSize: 4.0,  // Taille minimale des particules de la bordure (loin du cercle)
    borderColor: 0xFFFFFF,    // Couleur de la bordure
    thicknessVariationMultiplier: 5.0, // Augmenté de 3.0 à 5.0 pour plus de variation d'épaisseur
};

// Valeurs fixes pour les courbes
const phaseOffsets = [0, Math.PI/2, Math.PI, Math.PI*3/2];
const frequencyMultipliers = [1, 0.5, 0.7, 0.3];
const amplitudeMultipliers = [1, 0.8, 0.6, 0.4];

// Variables globales
let scene, camera, renderer, controls;
let particles, borderParticles;
let clock;
let container;
let heightVariation = 0.22;
let lineThickness = 0.030;
let lastScrollY = 0;

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

// Initialisation
function init() {
    // Récupération du conteneur
    container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    // Scène principale
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

    // Positionnement initial de la caméra
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

    // Ajout de l'initialisation des contrôles
    setupControls();

    // Animation
    animate();
}

// Animation
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    // Rendu de la scène principale
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setClearColor(config.backgroundColor);
    renderer.render(scene, camera);
}

// Création des particules
function createParticles() {
    // Création des particules principales
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const mainInitialPositions = new Float32Array(config.particleCount * 3);
    const mainFinalPositions = new Float32Array(config.particleCount * 3);

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

        const angleVariation = (Math.random() - 0.5) * 0.1;
        const finalAngle = angle + angleVariation;
        
        // Distribution radiale plus aléatoire
        const randomFactor = Math.random();
        const layerOffset = (randomFactor - 0.5) * 2; // Valeur entre -1 et 1
        
        // État initial : toutes les particules sur le cercle de base
        const initialRadius = config.radius;
        
        // État final : variation radiale vers l'intérieur/extérieur
        const finalRadius = config.radius + (layerOffset * 0.04);

        // Positions initiales (toutes sur le cercle de base)
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;

        // Positions finales (déployées radialement)
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;

        // Calcul de la hauteur Y avec distribution aléatoire
        const thicknessVariation = (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.6);
        const baseThickness = lineThickness * (1 + thicknessVariation);
        const randomY = (Math.random() * 2 - 1) * baseThickness; // Distribution aléatoire sur Y
        let y = randomY;
        
        // Ajout des variations de hauteur
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            let value = Math.sin(finalAngle * freq + phaseOffsets[phase]);
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            y += value * amp;
        }

        // Ajout du bruit avec distribution plus naturelle
        const noiseValue = noise1D(finalAngle * config.noiseScale) * 0.3 + (Math.random() - 0.5) * 0.2;
        y += noiseValue * heightVariation;

        // Stockage des positions
        mainInitialPositions[i3] = initialX;
        mainInitialPositions[i3 + 1] = y;
        mainInitialPositions[i3 + 2] = initialZ;

        mainFinalPositions[i3] = finalX;
        mainFinalPositions[i3 + 1] = y;
        mainFinalPositions[i3 + 2] = finalZ;

        // Position de départ = position initiale
        positions[i3] = initialX;
        positions[i3 + 1] = y;
        positions[i3 + 2] = initialZ;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('initialPosition', new THREE.BufferAttribute(mainInitialPositions, 3));
    geometry.setAttribute('finalPosition', new THREE.BufferAttribute(mainFinalPositions, 3));

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

    // Création des particules de la bordure
    const borderGeometry = new THREE.BufferGeometry();
    const borderPositions = new Float32Array(config.borderParticleCount * 3);
    const borderSizes = new Float32Array(config.borderParticleCount);
    const borderInitialPositions = new Float32Array(config.borderParticleCount * 3);
    const borderFinalPositions = new Float32Array(config.borderParticleCount * 3);

    for (let i = 0; i < config.borderParticleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.borderParticleCount) * Math.PI * 2;
        const progress = i / (config.borderParticleCount - 1);

        // Distribution radiale autour des particules principales
        const radialAngle = Math.random() * Math.PI * 2;
        const radialOffset = Math.random() * config.borderWidth;
        
        // Calcul de la position Y basée sur les courbes (avec amplitude réduite)
        let baseY = 0;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            
            let value = Math.sin(angle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            baseY += value * amp;
        }

        // Ajout d'une variation aléatoire supplémentaire sur Y (réduite)
        baseY += (Math.random() * 2 - 1) * heightVariation;

        // Ajout du bruit avec variation réduite
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.3;
        baseY += noiseValue * (heightVariation * 1.5);
        
        // Calcul de la position de base sur le cercle
        const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
        const baseX = Math.cos(angle) * baseRadius;
        const baseZ = Math.sin(angle) * baseRadius;

        // Calcul des offsets pour la position finale
        const offsetX = Math.cos(radialAngle) * radialOffset;
        const offsetY = (Math.random() - 0.5) * config.borderWidth;
        const offsetZ = Math.sin(radialAngle) * radialOffset;

        // Position initiale (plaquée sur le cercle avec Y modérément varié)
        borderInitialPositions[i3] = baseX;
        borderInitialPositions[i3 + 1] = baseY;
        borderInitialPositions[i3 + 2] = baseZ;

        // Position finale (avec les offsets)
        borderFinalPositions[i3] = baseX + offsetX;
        borderFinalPositions[i3 + 1] = baseY; // Garde la même position Y
        borderFinalPositions[i3 + 2] = baseZ + offsetZ;

        // Position de départ = position initiale
        borderPositions[i3] = borderInitialPositions[i3];
        borderPositions[i3 + 1] = borderInitialPositions[i3 + 1];
        borderPositions[i3 + 2] = borderInitialPositions[i3 + 2];

        // Calcul de la taille des particules en fonction de la distance
        const distanceFromBase = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
        const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
        borderSizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
    }

    borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    borderGeometry.setAttribute('size', new THREE.BufferAttribute(borderSizes, 1));
    borderGeometry.setAttribute('initialPosition', new THREE.BufferAttribute(borderInitialPositions, 3));
    borderGeometry.setAttribute('finalPosition', new THREE.BufferAttribute(borderFinalPositions, 3));

    const borderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.borderColor) },
            pointTexture: { value: createParticleTexture() }
        },
        vertexShader: `
            attribute float size;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = size;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform sampler2D pointTexture;
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * texture2D(pointTexture, gl_PointCoord);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    borderParticles = new THREE.Points(borderGeometry, borderMaterial);
    scene.add(borderParticles);
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
    const scrollProgress = Math.min(100, Math.max(0, (scrolled / scrollHeight) * 100));
    const animationProgress = Math.min(90, scrollProgress);
    
    // Déterminer la direction du scroll
    const scrollingUp = scrolled < lastScrollY;
    lastScrollY = scrolled;

    if (particles) {
        // Rotation Y continue de 0° à -180° sur toute la durée du scroll (jusqu'à 100%)
        const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
        particles.rotation.y = rotationY;

        // Rotation X de 0° à -90° entre 60% et 90% de scroll (sens inverse)
        if (animationProgress > 60) {
            const rotationX = -((animationProgress - 60) / 30) * (90 * Math.PI / 180);
            particles.rotation.x = rotationX;

            // Animation de l'épaisseur pendant la rotation finale (60-90%)
            const deploymentProgress = (animationProgress - 60) / 30;
            
            // Animation des particules principales
            const mainPositions = particles.geometry.attributes.position.array;
            const mainInitialPos = particles.geometry.attributes.initialPosition.array;
            const mainFinalPos = particles.geometry.attributes.finalPosition.array;
            
            for (let i = 0; i < mainPositions.length; i += 3) {
                // Interpolation linéaire entre les positions initiales et finales
                mainPositions[i] = mainInitialPos[i] + (mainFinalPos[i] - mainInitialPos[i]) * deploymentProgress;
                mainPositions[i + 1] = mainInitialPos[i + 1];
                mainPositions[i + 2] = mainInitialPos[i + 2] + (mainFinalPos[i + 2] - mainInitialPos[i + 2]) * deploymentProgress;
            }
            particles.geometry.attributes.position.needsUpdate = true;

            // Animation des particules de bordure
            if (borderParticles && borderParticles.geometry) {
                const positions = borderParticles.geometry.attributes.position.array;
                const initialPos = borderParticles.geometry.attributes.initialPosition.array;
                const finalPos = borderParticles.geometry.attributes.finalPosition.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] = initialPos[i] + (finalPos[i] - initialPos[i]) * deploymentProgress;
                    positions[i + 1] = initialPos[i + 1] + (finalPos[i + 1] - initialPos[i + 1]) * deploymentProgress;
                    positions[i + 2] = initialPos[i + 2] + (finalPos[i + 2] - initialPos[i + 2]) * deploymentProgress;
                }
                borderParticles.geometry.attributes.position.needsUpdate = true;
            }
        } else {
            // Réinitialiser la rotation X et les positions si on remonte avant 60%
            particles.rotation.x = 0;
            
            const mainPositions = particles.geometry.attributes.position.array;
            const mainInitialPos = particles.geometry.attributes.initialPosition.array;
            
            for (let i = 0; i < mainPositions.length; i++) {
                mainPositions[i] = mainInitialPos[i];
            }
            particles.geometry.attributes.position.needsUpdate = true;
        }

        // Gestion du zoom et de la distance max
        if (animationProgress < 60) {
            // En dessous de 60%, on force le zoom initial
            camera.zoom = config.initialZoom;
            camera.far = config.initialFar;
            camera.near = Math.max(0.1, config.initialFar * 0.1);
            camera.updateProjectionMatrix();
        } else if (animationProgress >= 60 && animationProgress <= 80) {
            const progress = (animationProgress - 60) / 20; // 0 à 1 entre 60% et 80%
            
            // Animation de la distance max
            const newFar = config.initialFar + (config.finalFar - config.initialFar) * progress;
            camera.far = newFar;
            camera.near = Math.max(0.1, newFar * 0.1);
            
            // Animation du zoom avec direction
            let newZoom;
            if (scrollingUp) {
                // En remontant : de finalZoom vers initialZoom
                newZoom = config.finalZoom + (config.initialZoom - config.finalZoom) * (1 - progress);
            } else {
                // En descendant : de initialZoom vers finalZoom
                newZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * progress;
            }
            camera.zoom = newZoom;
            
            camera.updateProjectionMatrix();
        } else {
            // Au-delà de 80%, on maintient les valeurs finales
            camera.zoom = config.finalZoom;
            camera.far = config.finalFar;
            camera.near = Math.max(0.1, config.finalFar * 0.1);
            camera.updateProjectionMatrix();
        }

        // S'assurer que le point de pivot reste au centre
        particles.position.set(0, 0, 0);

        // Appliquer les mêmes rotations à la bordure
        if (borderParticles) {
            borderParticles.rotation.copy(particles.rotation);
        }
    }
}

function updateParticles() {
    if (!particles) return;
    
    const geometry = particles.geometry;
    const positions = geometry.attributes.position.array;

    // Utilisation des mêmes valeurs fixes
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

        // Ajout d'une variation aléatoire à l'angle
        const angleVariation = (Math.random() - 0.5) * 0.1;
        const finalAngle = angle + angleVariation;

        // Calcul du rayon de base avec une légère variation
        const radiusVariation = (Math.random() - 0.5) * 0.1;
        const baseRadius = config.radius * (1 + radiusVariation);
        
        // Calcul de la position de base
        const x = Math.cos(finalAngle) * baseRadius;
        const z = Math.sin(finalAngle) * baseRadius;
        
        // Distribution plus dense sur Y avec 5 couches au lieu de 3
        const layerIndex = i % 5; // 5 couches au lieu de 3
        const layerOffset = (layerIndex - 2) / 2; // Répartition entre -1 et 1
        
        // Variation d'épaisseur plus prononcée basée sur l'angle
        const thicknessVariation = (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * config.thicknessVariationMultiplier;
        const baseThickness = lineThickness * (1 + thicknessVariation);
        
        // Ajout d'une variation aléatoire à l'épaisseur
        const thicknessNoise = (Math.random() - 0.5) * 0.4;
        let y = layerOffset * baseThickness * (1 + thicknessNoise);
        
        // Ajout des variations de hauteur avec amplitude réduite
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = (heightVariation * 0.7) * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            
            let value = Math.sin(finalAngle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            y += value * amp;
        }
        
        // Ajout du bruit avec moins de variation
        const noiseValue = Math.sin(finalAngle * config.noiseScale) * 0.3 + (Math.random() - 0.5) * 0.2;
        y += noiseValue * (heightVariation * 0.7);
        
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    geometry.attributes.position.needsUpdate = true;

    // Mise à jour des positions des particules de la bordure
    if (borderParticles) {
        const borderPositions = borderParticles.geometry.attributes.position.array;
        const borderSizes = borderParticles.geometry.attributes.size.array;
        
        for (let i = 0; i < config.borderParticleCount; i++) {
            const i3 = i * 3;
            const angle = (i / config.borderParticleCount) * Math.PI * 2;
            const progress = i / (config.borderParticleCount - 1);

            const radialAngle = Math.random() * Math.PI * 2;
            const radialOffset = Math.random() * config.borderWidth;
            
            let baseY = 0;
            for (let phase = 0; phase < config.curvePhases; phase++) {
                const freq = config.curveFrequency * frequencyMultipliers[phase];
                const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
                
                let value = Math.sin(angle * freq + phaseOffsets[phase]);
                
                if (progress > 0.95) {
                    const blend = (progress - 0.95) / 0.05;
                    value = value * (1 - blend) + startValues[phase] * blend;
                }
                
                baseY += value * amp;
            }

            const noiseValue = Math.sin(angle * config.noiseScale) * 0.3;
            baseY += noiseValue * heightVariation;

            const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
            const baseX = Math.cos(angle) * baseRadius;
            const baseZ = Math.sin(angle) * baseRadius;

            const offsetX = Math.cos(radialAngle) * radialOffset;
            const offsetY = (Math.random() - 0.5) * config.borderWidth;
            const offsetZ = Math.sin(radialAngle) * radialOffset;

            borderPositions[i3] = baseX + offsetX;
            borderPositions[i3 + 1] = baseY + offsetY;
            borderPositions[i3 + 2] = baseZ + offsetZ;

            // Mise à jour de la taille des particules
            const distanceFromBase = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
            const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
            borderSizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
        }
        
        borderParticles.geometry.attributes.position.needsUpdate = true;
        borderParticles.geometry.attributes.size.needsUpdate = true;
    }
}

// Gestionnaires d'événements pour les contrôles
function setupControls() {
    // Récupération des éléments de contrôle
    const curveCountControl = document.getElementById('curve-count');
    const curveCountValue = document.getElementById('curve-count-value');
    const particleSizeControl = document.getElementById('particle-size');
    const particleSizeValue = document.getElementById('particle-size-value');
    const particleCountControl = document.getElementById('particle-count');
    const particleCountValue = document.getElementById('particle-count-value');
    const curveAmplitudeControl = document.getElementById('curve-amplitude');
    const curveAmplitudeValue = document.getElementById('curve-amplitude-value');
    const maxThicknessControl = document.getElementById('max-thickness');
    const maxThicknessValue = document.getElementById('max-thickness-value');
    const minThicknessControl = document.getElementById('min-thickness');
    const minThicknessValue = document.getElementById('min-thickness-value');
    const toggleControlsBtn = document.getElementById('toggle-controls');
    const showControlsBtn = document.getElementById('show-controls');
    const controlsPanel = document.getElementById('controls-panel');

    // Gestion de l'affichage/masquage du panneau de contrôle
    toggleControlsBtn.addEventListener('click', () => {
        controlsPanel.style.display = 'none';
        showControlsBtn.style.display = 'block';
    });

    showControlsBtn.addEventListener('click', () => {
        controlsPanel.style.display = 'block';
        showControlsBtn.style.display = 'none';
    });

    // Gestionnaires d'événements pour les contrôles
    curveCountControl.addEventListener('input', (e) => {
        config.curveFrequency = parseInt(e.target.value);
        curveCountValue.textContent = config.curveFrequency;
        updateParticles();
    });

    particleSizeControl.addEventListener('input', (e) => {
        config.particleSize = parseFloat(e.target.value);
        particleSizeValue.textContent = config.particleSize.toFixed(2);
        if (particles) {
            particles.material.size = config.particleSize;
        }
    });

    particleCountControl.addEventListener('input', (e) => {
        config.particleCount = parseInt(e.target.value);
        particleCountValue.textContent = config.particleCount;
        // Recréer les particules avec le nouveau compte
        if (particles) {
            scene.remove(particles);
            createParticles();
        }
    });

    curveAmplitudeControl.addEventListener('input', (e) => {
        heightVariation = parseFloat(e.target.value);
        curveAmplitudeValue.textContent = heightVariation.toFixed(2);
        updateParticles();
    });

    maxThicknessControl.addEventListener('input', (e) => {
        lineThickness = parseFloat(e.target.value);
        maxThicknessValue.textContent = lineThickness.toFixed(3);
        updateParticles();
    });

    minThicknessControl.addEventListener('input', (e) => {
        const minThickness = parseFloat(e.target.value);
        minThicknessValue.textContent = minThickness.toFixed(3);
        // Mettre à jour la configuration avec la nouvelle épaisseur minimale
        config.borderParticleMinSize = minThickness * 100;
        updateParticles();
    });
}

// Démarrage
document.addEventListener('DOMContentLoaded', init);
