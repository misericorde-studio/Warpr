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
    thicknessVariationMultiplier: 3.0, // Multiplicateur pour la variation d'épaisseur
};

// Variables globales
let scene, camera, renderer, controls;
let axesScene, axesCamera;
let particles, borderParticles;
let clock;
let container;
let heightVariation = 0.2;
let lineThickness = 0.04;
let lastScrollY = 0;
let axesHelper;
let axesInitialized = false;

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
    
    // Initialisation de la scène des axes
    initAxesHelper();

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

// Initialisation du helper des axes
function initAxesHelper() {
    // Création de la scène des axes
    axesScene = new THREE.Scene();
    
    // Caméra orthographique pour les axes
    axesCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    axesCamera.position.set(0, 0, 1);
    axesCamera.lookAt(0, 0, 0);

    // Helper des axes
    axesHelper = new THREE.AxesHelper(0.8);
    axesScene.add(axesHelper);

    // Création des labels avec des sprites
    function createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        context.font = 'Bold 40px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.2, 0.2, 1);
        return sprite;
    }

    // Label X
    const xLabel = createTextSprite('X', '#ff0000');
    xLabel.position.set(0.9, 0, 0);
    axesScene.add(xLabel);

    // Label Y
    const yLabel = createTextSprite('Y', '#00ff00');
    yLabel.position.set(0, 0.9, 0);
    axesScene.add(yLabel);

    // Label Z
    const zLabel = createTextSprite('Z', '#0000ff');
    zLabel.position.set(0, 0, 0.9);
    axesScene.add(zLabel);

    axesInitialized = true;
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
    // Création des particules principales
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);

    // Valeurs fixes pour la continuité
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

        // Ajout d'une variation aléatoire à l'angle
        const angleVariation = (Math.random() - 0.5) * 0.1; // ±0.05 radians de variation
        const finalAngle = angle + angleVariation;

        // Calcul du rayon de base avec une légère variation
        const radiusVariation = (Math.random() - 0.5) * 0.1; // ±5% de variation
        const baseRadius = config.radius * (1 + radiusVariation);
        
        // Calcul de la position de base
        const x = Math.cos(finalAngle) * baseRadius;
        const z = Math.sin(finalAngle) * baseRadius;
        
        // Distribution régulière pour l'épaisseur avec variation sur Y
        const layerOffset = ((i % 3) - 1);
        const thicknessVariation = Math.abs(Math.cos(finalAngle)) * config.thicknessVariationMultiplier;
        const baseThickness = lineThickness * (1 + thicknessVariation);
        
        // Ajout d'une variation aléatoire à l'épaisseur
        const thicknessNoise = (Math.random() - 0.5) * 0.3; // ±15% de variation
        let y = layerOffset * baseThickness * (1 + thicknessNoise);
        
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
        
        // Ajout du bruit avec plus de variation
        const noiseValue = Math.sin(finalAngle * config.noiseScale) * 0.3 + (Math.random() - 0.5) * 0.2;
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

    // Création des particules de la bordure
    const borderGeometry = new THREE.BufferGeometry();
    const borderPositions = new Float32Array(config.borderParticleCount * 3);
    const borderSizes = new Float32Array(config.borderParticleCount);
    const initialPositions = new Float32Array(config.borderParticleCount * 3);
    const finalPositions = new Float32Array(config.borderParticleCount * 3);

    for (let i = 0; i < config.borderParticleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.borderParticleCount) * Math.PI * 2;
        const progress = i / (config.borderParticleCount - 1);

        // Distribution radiale autour des particules principales
        const radialAngle = Math.random() * Math.PI * 2;
        const radialOffset = Math.random() * config.borderWidth;
        
        // Calcul de la position de base sur le cercle
        const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
        const baseX = Math.cos(angle) * baseRadius;
        const baseZ = Math.sin(angle) * baseRadius;

        // Calcul des offsets pour la position finale
        const offsetX = Math.cos(radialAngle) * radialOffset;
        const offsetY = (Math.random() - 0.5) * config.borderWidth;
        const offsetZ = Math.sin(radialAngle) * radialOffset;

        // Position initiale (plaquée sur le cercle mais répartie sur Y)
        const ySpread = (Math.random() * 2 - 1) * 2; // Répartition sur l'axe Y entre -2 et 2
        initialPositions[i3] = baseX; // Position X plaquée sur le cercle
        initialPositions[i3 + 1] = ySpread; // Position Y aléatoire
        initialPositions[i3 + 2] = baseZ; // Position Z plaquée sur le cercle

        // Position finale (avec les offsets)
        finalPositions[i3] = baseX + offsetX;
        finalPositions[i3 + 1] = ySpread; // Garde la même position Y
        finalPositions[i3 + 2] = baseZ + offsetZ;

        // Position de départ = position initiale
        borderPositions[i3] = initialPositions[i3];
        borderPositions[i3 + 1] = initialPositions[i3 + 1];
        borderPositions[i3 + 2] = initialPositions[i3 + 2];

        // Calcul de la taille des particules en fonction de la distance
        const distanceFromBase = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
        const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
        borderSizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
    }

    borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    borderGeometry.setAttribute('size', new THREE.BufferAttribute(borderSizes, 1));
    borderGeometry.setAttribute('initialPosition', new THREE.BufferAttribute(initialPositions, 3));
    borderGeometry.setAttribute('finalPosition', new THREE.BufferAttribute(finalPositions, 3));

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

// Animation
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // Rendu de la scène principale en plein écran
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setClearColor(config.backgroundColor);
    renderer.render(scene, camera);

    // Rendu de la scène des axes si initialisée
    if (axesInitialized && axesScene && axesCamera) {
        // Sauvegarde du scissor actuel
        const currentScissor = renderer.getScissorTest();
        
        // Configuration pour le rendu des axes
        const axesWidth = container.clientWidth * 0.15;
        const axesHeight = axesWidth;
        const margin = 20;
        
        renderer.setScissorTest(true);
        renderer.setScissor(
            margin,
            container.clientHeight - axesHeight - margin,
            axesWidth,
            axesHeight
        );
        renderer.setViewport(
            margin,
            container.clientHeight - axesHeight - margin,
            axesWidth,
            axesHeight
        );
        renderer.setClearColor(0x000000, 0);
        renderer.render(axesScene, axesCamera);
        
        // Restauration du scissor
        renderer.setScissorTest(currentScissor);
    }
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

            // Animation du déploiement des particules de bordure pendant la rotation finale
            if (borderParticles && borderParticles.geometry) {
                const positions = borderParticles.geometry.attributes.position.array;
                const initialPos = borderParticles.geometry.attributes.initialPosition.array;
                const finalPos = borderParticles.geometry.attributes.finalPosition.array;
                
                // Calculer le facteur de déploiement (0 à 1) pendant la rotation finale
                const deploymentProgress = (animationProgress - 60) / 30;
                
                for (let i = 0; i < positions.length; i += 3) {
                    // Interpolation entre position initiale et finale
                    positions[i] = initialPos[i] + (finalPos[i] - initialPos[i]) * deploymentProgress;
                    positions[i + 1] = initialPos[i + 1] + (finalPos[i + 1] - initialPos[i + 1]) * deploymentProgress;
                    positions[i + 2] = initialPos[i + 2] + (finalPos[i + 2] - initialPos[i + 2]) * deploymentProgress;
                }
                
                borderParticles.geometry.attributes.position.needsUpdate = true;
            }
        } else {
            particles.rotation.x = 0;
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

        // Ajout d'une variation aléatoire à l'angle
        const angleVariation = (Math.random() - 0.5) * 0.1;
        const finalAngle = angle + angleVariation;

        // Calcul du rayon de base avec une légère variation
        const radiusVariation = (Math.random() - 0.5) * 0.1;
        const baseRadius = config.radius * (1 + radiusVariation);
        
        // Calcul de la position de base
        const x = Math.cos(finalAngle) * baseRadius;
        const z = Math.sin(finalAngle) * baseRadius;
        
        // Distribution régulière pour l'épaisseur avec variation sur Y
        const layerOffset = ((i % 3) - 1);
        const thicknessVariation = Math.abs(Math.cos(finalAngle)) * config.thicknessVariationMultiplier;
        const baseThickness = lineThickness * (1 + thicknessVariation);
        
        // Ajout d'une variation aléatoire à l'épaisseur
        const thicknessNoise = (Math.random() - 0.5) * 0.3;
        let y = layerOffset * baseThickness * (1 + thicknessNoise);
        
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
        
        // Ajout du bruit avec plus de variation
        const noiseValue = Math.sin(finalAngle * config.noiseScale) * 0.3 + (Math.random() - 0.5) * 0.2;
        y += noiseValue * heightVariation;
        
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
    const heightControl = document.getElementById('height-variation');
    const heightValue = document.getElementById('height-value');
    const thicknessControl = document.getElementById('circle-thickness');
    const thicknessValue = document.getElementById('thickness-value');
    const distanceControl = document.getElementById('camera-distance');
    const distanceValue = document.getElementById('distance-value');

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

    distanceControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.initialFar = value;
        config.cameraFar = value;
        distanceValue.textContent = value.toFixed(1);
        camera.far = value;
        camera.near = Math.max(0.1, value * 0.1);
        camera.updateProjectionMatrix();
    });
}

// Démarrage
document.addEventListener('DOMContentLoaded', init);
